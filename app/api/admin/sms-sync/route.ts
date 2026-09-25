import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { ourSmsNumber, toE164, type SmsMessage } from "@/lib/sms-thread"
import { reconcileThread } from "@/lib/sms-reconcile"

export const dynamic = "force-dynamic"

// ============================================================
// POST /api/admin/sms-sync  { hours?: number }   (staff only)
// ============================================================
// Backfill for lib/sms-reconcile: walks the 213 line's traffic in a window and
// copies anything the lead timelines are missing. Opening a conversation heals
// that one thread; this heals the ones nobody opened.
//
// Two Twilio list calls total (one per direction), then one insert per lead
// that is behind, so it is cheap enough to run by hand or from a schedule.

type TwilioMessage = {
  sid: string
  direction: string
  body: string
  from: string
  to: string
  status: string
  date_sent: string | null
  date_created: string
  num_media?: string
}

async function list(query: string): Promise<TwilioMessage[]> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) return []
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json?${query}&PageSize=200`, {
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` },
    cache: "no-store",
  })
  if (!res.ok) return []
  const data = (await res.json().catch(() => ({}))) as { messages?: TwilioMessage[] }
  return data.messages ?? []
}

/** Last ten digits: the only key that matches "+1562…" against "562-…". */
function key(value: string | null | undefined): string {
  const d = (value ?? "").replace(/\D/g, "")
  return d.length >= 10 ? d.slice(-10) : ""
}

export async function POST(request: NextRequest) {
  if (!(await resolveAdminActor(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })

  const body = (await request.json().catch(() => ({}))) as { hours?: number; phone?: string }
  const hours = Math.min(Math.max(Number(body.hours) || 72, 1), 24 * 30)
  const since = Date.now() - hours * 3600_000
  const ours = ourSmsNumber()
  const only = toE164(body.phone ?? null)

  const [outbound, inbound] = await Promise.all([
    list(`From=${encodeURIComponent(ours)}`),
    list(`To=${encodeURIComponent(ours)}`),
  ])

  // Group every message in the window by the customer's number.
  const byPeer = new Map<string, SmsMessage[]>()
  const add = (m: TwilioMessage, direction: "inbound" | "outbound", peer: string) => {
    const at = new Date(m.date_sent ?? m.date_created)
    if (Number.isNaN(at.getTime()) || at.getTime() < since) return
    const e164 = toE164(peer)
    if (!e164 || (only && e164 !== only)) return
    const list = byPeer.get(e164) ?? []
    list.push({
      sid: m.sid,
      direction,
      body: m.body ?? "",
      at: at.toISOString(),
      status: m.status,
      media: Number(m.num_media ?? 0) || 0,
      peer: e164,
    })
    byPeer.set(e164, list)
  }
  for (const m of outbound) add(m, "outbound", m.to)
  for (const m of inbound) add(m, "inbound", m.from)
  if (byPeer.size === 0) return NextResponse.json({ ok: true, hours, peers: 0, leads: 0, inserted: 0 })

  // Match those numbers to leads. One read of the leads that have a phone at
  // all beats a query per peer, and the last-ten-digits key is what the rest
  // of the workbench matches on.
  const { data: leadRows } = await supabase
    .from("leads")
    .select("id, phone, merged_into")
    .not("phone", "is", null)
    .order("created_at", { ascending: false })
    .limit(2000)
  const leadByKey = new Map<string, string>()
  for (const row of (leadRows ?? []) as Array<{ id: string; phone: string | null; merged_into: string | null }>) {
    if (row.merged_into) continue
    const k = key(row.phone)
    if (k && !leadByKey.has(k)) leadByKey.set(k, row.id)
  }

  let inserted = 0
  let leads = 0
  const unmatched: string[] = []
  for (const [peer, messages] of byPeer) {
    const leadId = leadByKey.get(key(peer))
    if (!leadId) {
      unmatched.push(peer)
      continue
    }
    leads += 1
    try {
      inserted += (await reconcileThread(supabase, leadId, messages)).inserted
    } catch (err) {
      console.error("[sms-sync] reconcile failed", peer, err)
    }
  }

  return NextResponse.json({ ok: true, hours, peers: byPeer.size, leads, inserted, unmatched: unmatched.slice(0, 20) })
}
