import { createHash, timingSafeEqual } from "node:crypto"
import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Microsoft Ads (Bing) spend, pushed in by a script that runs inside the
// Microsoft Advertising account (Tools > Scripts, account 189366721) on a
// schedule - D-1009-08. Microsoft's own API would need a developer token, an
// Entra app registration and an OAuth refresh token that has to be kept
// alive; the script needs none of that and runs on Microsoft's servers.
//
//   POST { accountId, rows: [{ date, campaignId, campaignName, impressions, clicks, cost }] }
//   header x-push-key: the key whose SHA-256 is integration_push_keys.msads_spend_script
//
// The key can do exactly one thing: upsert microsoft_ads rows for that account.

const KEY_NAME = "msads_spend_script"
const ACCOUNT_ID = "189366721"
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
// A day's spend above this is a script or currency bug, not a real day.
const MAX_DAY_COST_CENTS = 200_000

type Row = { date?: unknown; campaignId?: unknown; campaignName?: unknown; impressions?: unknown; clicks?: unknown; cost?: unknown }

const int = (v: unknown) => {
  const n = Math.round(Number(v ?? 0))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex")
  const y = Buffer.from(b, "hex")
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y)
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })

  const provided = request.headers.get("x-push-key")?.trim() ?? ""
  if (!provided) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  const { data: keyRow } = await supabase.from("integration_push_keys").select("key_sha256").eq("name", KEY_NAME).maybeSingle()
  const stored = (keyRow as { key_sha256: string } | null)?.key_sha256 ?? ""
  if (!sameHash(createHash("sha256").update(provided).digest("hex"), stored)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  let body: { accountId?: unknown; rows?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 })
  }
  if (String(body.accountId ?? "") !== ACCOUNT_ID) {
    return NextResponse.json({ ok: false, error: `accountId must be ${ACCOUNT_ID}` }, { status: 400 })
  }
  const rows = Array.isArray(body.rows) ? (body.rows as Row[]) : []
  // last_used_at doubles as the script's heartbeat, so an empty run counts too
  // (before Bing spends anything every run is empty).
  if (!rows.length) {
    await supabase.from("integration_push_keys").update({ last_used_at: new Date().toISOString() }).eq("name", KEY_NAME)
    return NextResponse.json({ ok: true, rows: 0, costCents: 0 })
  }
  if (rows.length > 500) return NextResponse.json({ ok: false, error: "max 500 rows" }, { status: 400 })

  const now = new Date().toISOString()
  const problems: string[] = []
  const upserts = rows.flatMap((r, i) => {
    const date = String(r.date ?? "")
    const campaignId = String(r.campaignId ?? "").trim()
    // cost arrives in dollars (the script reports getCost()).
    const costCents = Math.round(Number(r.cost ?? 0) * 100)
    if (!DATE_RE.test(date) || !campaignId || !Number.isFinite(costCents) || costCents < 0 || costCents > MAX_DAY_COST_CENTS) {
      problems.push(`row ${i + 1}`)
      return []
    }
    return [
      {
        channel: "microsoft_ads",
        account_id: ACCOUNT_ID,
        campaign_id: campaignId,
        campaign_name: String(r.campaignName ?? "").trim().slice(0, 200) || null,
        ad_group_id: "",
        ad_group_name: null,
        date,
        impressions: int(r.impressions),
        clicks: int(r.clicks),
        cost_cents: costCents,
        platform_conversions: 0,
        platform_conversion_value_cents: 0,
        source: "api",
        note: "msads script",
        created_by: "msads_script",
        updated_at: now,
      },
    ]
  })
  if (upserts.length) {
    const { error } = await supabase.from("ad_spend_daily").upsert(upserts, { onConflict: "channel,account_id,campaign_id,ad_group_id,date" })
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  await supabase.from("integration_push_keys").update({ last_used_at: now }).eq("name", KEY_NAME)
  return NextResponse.json({ ok: true, rows: upserts.length, costCents: upserts.reduce((a, r) => a + r.cost_cents, 0), skipped: problems })
}
