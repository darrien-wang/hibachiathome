import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { resolveAdminActor } from "@/lib/admin-auth"
import { fetchGoogleCampaignDays, googleAdsCustomerId } from "@/lib/google-ads-rest"
import { PAID_CHANNELS, isPaidChannel } from "@/lib/channels"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ad_spend_daily is the one place paid spend lives, whatever the channel.
//   GET  ?from&to[&channel]          rows in the window
//   POST {rows:[...]}                upsert manual / CSV rows (any channel)
//   POST ?action=sync_google&days=N  pull campaign×day from the Google Ads API
// The daily report calls sync_google with ?key=; the workbench calls it from
// the 渠道 page. Other channels arrive as CSV until they have a connector.

type SpendRowInput = {
  channel: string
  date: string
  accountId?: string
  campaignId?: string
  campaignName?: string
  adGroupId?: string
  adGroupName?: string
  impressions?: number
  clicks?: number
  costCents?: number
  platformConversions?: number
  platformConversionValueCents?: number
  source?: "csv" | "manual"
  note?: string
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function ptToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" })
}

function daysAgo(n: number): string {
  const d = new Date(Date.now() - n * 86400000)
  return d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" })
}

const int = (v: unknown) => {
  const n = Math.round(Number(v ?? 0))
  return Number.isFinite(n) ? n : 0
}

export async function GET(request: NextRequest) {
  if (!resolveAdminActor(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })
  const p = request.nextUrl.searchParams
  const from = DATE_RE.test(p.get("from") ?? "") ? (p.get("from") as string) : daysAgo(30)
  const to = DATE_RE.test(p.get("to") ?? "") ? (p.get("to") as string) : ptToday()
  const channel = p.get("channel")
  let q = supabase
    .from("ad_spend_daily")
    .select("id, channel, account_id, campaign_id, campaign_name, ad_group_id, ad_group_name, date, impressions, clicks, cost_cents, platform_conversions, platform_conversion_value_cents, source, note, created_by, updated_at")
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: false })
    .limit(2000)
  if (channel && isPaidChannel(channel)) q = q.eq("channel", channel)
  const { data, error } = await q
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, from, to, rows: data ?? [] })
}

export async function POST(request: NextRequest) {
  const actor = resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })
  const action = request.nextUrl.searchParams.get("action")

  if (action === "sync_google") {
    const days = Math.min(400, Math.max(1, int(request.nextUrl.searchParams.get("days") ?? 14)))
    const from = daysAgo(days)
    const to = ptToday()
    try {
      const rows = await fetchGoogleCampaignDays(from, to)
      const accountId = googleAdsCustomerId()
      const now = new Date().toISOString()
      const upserts = rows.map((r) => ({
        channel: "google_ads",
        account_id: accountId,
        campaign_id: r.campaignId,
        campaign_name: r.campaignName,
        ad_group_id: "",
        ad_group_name: null,
        date: r.date,
        impressions: r.impressions,
        clicks: r.clicks,
        cost_cents: r.costCents,
        platform_conversions: r.conversions,
        platform_conversion_value_cents: r.conversionValueCents,
        source: "api",
        created_by: `sync:${actor.alias}`,
        updated_at: now,
      }))
      if (upserts.length) {
        const { error } = await supabase.from("ad_spend_daily").upsert(upserts, { onConflict: "channel,account_id,campaign_id,ad_group_id,date" })
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      }
      const cost = upserts.reduce((a, r) => a + r.cost_cents, 0)
      return NextResponse.json({ ok: true, channel: "google_ads", from, to, rows: upserts.length, costCents: cost })
    } catch (error) {
      return NextResponse.json({ ok: false, error: String(error) }, { status: 200 })
    }
  }

  let body: { rows?: SpendRowInput[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 })
  }
  const rows = Array.isArray(body.rows) ? body.rows : []
  if (!rows.length) return NextResponse.json({ ok: false, error: "rows required" }, { status: 400 })
  if (rows.length > 1000) return NextResponse.json({ ok: false, error: "max 1000 rows per call" }, { status: 400 })
  const problems: string[] = []
  const now = new Date().toISOString()
  const upserts = rows.flatMap((r, i) => {
    if (!isPaidChannel(r.channel)) {
      problems.push(`row ${i + 1}: channel must be one of ${PAID_CHANNELS.join(", ")}`)
      return []
    }
    if (!DATE_RE.test(r.date ?? "")) {
      problems.push(`row ${i + 1}: date must be YYYY-MM-DD`)
      return []
    }
    return [
      {
        channel: r.channel,
        account_id: (r.accountId ?? "").trim(),
        campaign_id: (r.campaignId ?? "").trim(),
        campaign_name: r.campaignName?.trim() || null,
        ad_group_id: (r.adGroupId ?? "").trim(),
        ad_group_name: r.adGroupName?.trim() || null,
        date: r.date,
        impressions: int(r.impressions),
        clicks: int(r.clicks),
        cost_cents: int(r.costCents),
        platform_conversions: Number(r.platformConversions ?? 0) || 0,
        platform_conversion_value_cents: int(r.platformConversionValueCents),
        source: r.source === "csv" ? "csv" : "manual",
        note: r.note?.trim() || null,
        created_by: actor.alias,
        updated_at: now,
      },
    ]
  })
  if (problems.length && !upserts.length) return NextResponse.json({ ok: false, error: problems.join("; ") }, { status: 400 })
  const { error } = await supabase.from("ad_spend_daily").upsert(upserts, { onConflict: "channel,account_id,campaign_id,ad_group_id,date" })
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  const cost = upserts.reduce((a, r) => a + r.cost_cents, 0)
  return NextResponse.json({ ok: true, rows: upserts.length, costCents: cost, skipped: problems })
}

export async function DELETE(request: NextRequest) {
  const actor = resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })
  const id = request.nextUrl.searchParams.get("id") ?? ""
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 })
  // API-synced rows come back on the next sync; only hand-entered rows are deletable.
  const { error } = await supabase.from("ad_spend_daily").delete().eq("id", id).neq("source", "api")
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
