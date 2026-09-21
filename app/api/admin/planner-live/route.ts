import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { resolveAdminActor } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Planner · 谁现在在动 (2026-09-21). Every tap in the party planner lands in
// planner_events (device id `sid`, step name, small props). Grouped by
// device this becomes a session the workbench can show live on the order or
// lead it belongs to - and, for people who never left a phone number, as an
// anonymous session worth watching in Clarity for bugs.
//
//   GET ?hours=24 -> { sessions, byOrder, byLead, liveCount, recentCount, anonymousLive, clarityProject }
//
// "live" = something happened in the last LIVE_MS and the last step is not
// `leave`; "just_left" = left within LIVE_MS; "recent" = within RECENT_MS.
// Linking: the beacon may carry the private key (`key_id`, resolved server
// side to `lead_id`); a key's contact (email/phone) lives in invoice_tokens,
// so orders are matched by phone/email as well.

const LIVE_MS = 3 * 60_000
const RECENT_MS = 60 * 60_000
const CLARITY_PROJECT = process.env.CLARITY_PROJECT_ID ?? "y9dgbtwodj"

type Row = { sid: string; event: string; entry: string | null; props: Record<string, unknown> | null; created_at: string; key_id: string | null; lead_id: string | null; order_id: string | null }

export type PlannerSession = {
  sid: string
  state: "live" | "just_left" | "recent" | "earlier"
  firstAt: string
  lastAt: string
  minutesAgo: number
  events: number
  lastEvent: string
  entry: string | null
  steps: Array<{ event: string; at: string; sheet?: string }>
  guests: number | null
  picked: number | null
  joined: number | null
  secs: number | null
  phase: string | null
  identified: boolean
  edited: boolean
  keyId: string | null
  leadId: string | null
  orderId: string | null
  leadName: string | null
  leadPhone: string | null
  orderNo: string | null
  customerName: string | null
  eventDate: string | null
  claritySession: string | null
  clarityUser: string | null
  utmSource: string | null
}

const digits10 = (v: string | null | undefined) => {
  const d = (v ?? "").replace(/\D/g, "")
  return d.length >= 10 ? d.slice(-10) : d
}
const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null)
const strOrNull = (v: unknown) => (typeof v === "string" && v ? v : null)

export async function GET(request: NextRequest) {
  const actor = resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "supabase not configured" }, { status: 500 })
  const hours = Math.min(168, Math.max(1, Number(request.nextUrl.searchParams.get("hours") ?? 24) || 24))
  const since = new Date(Date.now() - hours * 3600_000).toISOString()
  const now = Date.now()

  const { data, error } = await supabase
    .from("planner_events")
    .select("sid, event, entry, props, created_at, key_id, lead_id, order_id")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(4000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = (data ?? []) as Row[]

  // Group by device, newest first inside each group.
  const bySid = new Map<string, Row[]>()
  for (const r of rows) (bySid.get(r.sid) ?? bySid.set(r.sid, []).get(r.sid)!).push(r)

  const keyIds = new Set<string>()
  const leadIds = new Set<string>()
  const draft: Array<PlannerSession & { phone: string | null; email: string | null }> = []
  for (const [sid, list] of bySid) {
    const newest = list[0]
    const oldest = list[list.length - 1]
    const lastMs = Date.parse(newest.created_at)
    const age = now - lastMs
    const state: PlannerSession["state"] = age < LIVE_MS ? (newest.event === "leave" ? "just_left" : "live") : age < RECENT_MS ? "recent" : "earlier"
    const pick = <T,>(f: (r: Row) => T | null | undefined): T | null => {
      for (const r of list) {
        const v = f(r)
        if (v !== null && v !== undefined) return v
      }
      return null
    }
    const props = (r: Row) => (r.props ?? {}) as Record<string, unknown>
    const keyId = pick((r) => r.key_id)
    const leadId = pick((r) => r.lead_id)
    if (keyId) keyIds.add(keyId)
    if (leadId) leadIds.add(leadId)
    draft.push({
      sid,
      state,
      firstAt: oldest.created_at,
      lastAt: newest.created_at,
      minutesAgo: Math.round(age / 60_000),
      events: list.length,
      lastEvent: newest.event,
      entry: pick((r) => r.entry),
      steps: list.slice(0, 10).map((r) => ({ event: r.event, at: r.created_at, sheet: strOrNull(props(r).sheet) ?? undefined })),
      guests: pick((r) => numOrNull(props(r).guests)),
      picked: pick((r) => numOrNull(props(r).picked)),
      joined: pick((r) => numOrNull(props(r).joined)),
      secs: pick((r) => (r.event === "leave" ? numOrNull(props(r).secs) : null)),
      phase: pick((r) => strOrNull(props(r).phase)),
      identified: list.some((r) => props(r).identified === true),
      edited: list.some((r) => props(r).edited === true || r.event === "first_edit"),
      keyId,
      leadId,
      orderId: pick((r) => r.order_id),
      leadName: null,
      leadPhone: null,
      orderNo: null,
      customerName: null,
      eventDate: null,
      claritySession: pick((r) => strOrNull(props(r).clarity_session)),
      clarityUser: pick((r) => strOrNull(props(r).clarity_user)),
      utmSource: pick((r) => strOrNull(props(r).utm_source)),
      phone: null,
      email: null,
    })
  }

  // Resolve keys (invoice_tokens holds the contact behind a private link).
  const keyContacts = new Map<string, { email?: string; phone?: string; leadId?: string; externalOrderId?: string }>()
  if (keyIds.size) {
    const { data: toks } = await supabase.from("invoice_tokens").select("token, invoice_data").in("token", Array.from(keyIds))
    for (const t of toks ?? []) {
      const w = t.invoice_data as { __kind?: string; contact?: { email?: string; phone?: string; leadId?: string; externalOrderId?: string } } | null
      if (w?.__kind === "order_key" && w.contact) keyContacts.set(t.token, w.contact)
    }
  }
  for (const s of draft) {
    const c = s.keyId ? keyContacts.get(s.keyId) : undefined
    if (c) {
      s.phone = c.phone ?? null
      s.email = c.email ?? null
      if (!s.leadId && c.leadId) {
        s.leadId = c.leadId
        leadIds.add(c.leadId)
      }
    }
  }
  const leadMap = new Map<string, { id: string; full_name: string | null; phone: string | null; email: string | null }>()
  if (leadIds.size) {
    const { data: leads } = await supabase.from("leads").select("id, full_name, phone, email").in("id", Array.from(leadIds))
    for (const l of leads ?? []) leadMap.set(l.id, l)
  }
  // A key minted for a booked customer carries phone/email but often no
  // leadId; find the lead by contact so the session lands on the lead too.
  const contactLeads = draft.filter((s) => !s.leadId && (s.phone || s.email))
  if (contactLeads.length) {
    const { data: recentLeads } = await supabase.from("leads").select("id, full_name, phone, email").is("merged_into", null).order("created_at", { ascending: false }).limit(400)
    for (const s of contactLeads) {
      const p = digits10(s.phone)
      const e = (s.email ?? "").trim().toLowerCase()
      const hit = (recentLeads ?? []).find((l) => (p && digits10(l.phone) === p) || (e && (l.email ?? "").trim().toLowerCase() === e))
      if (hit) {
        s.leadId = hit.id
        leadMap.set(hit.id, hit)
      }
    }
  }
  // Orders: match by explicit order_id, then the lead behind the key, then phone/email.
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_no, source_ref, customer_name, customer_phone, customer_email, event_start, order_status, source_metadata")
    .neq("order_status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(300)
  const orderList = orders ?? []
  const sessions: PlannerSession[] = draft.map((s) => {
    const lead = s.leadId ? leadMap.get(s.leadId) : undefined
    const phone = digits10(s.phone ?? lead?.phone)
    const email = (s.email ?? lead?.email ?? "").trim().toLowerCase()
    const ext = s.keyId ? keyContacts.get(s.keyId)?.externalOrderId : undefined
    let order = s.orderId ? orderList.find((o) => o.id === s.orderId) : undefined
    if (!order && ext) order = orderList.find((o) => o.id === ext || o.order_no === ext || (o as { source_ref?: string | null }).source_ref === ext)
    if (!order && s.leadId) order = orderList.find((o) => ((o.source_metadata ?? {}) as Record<string, unknown>).lead_id === s.leadId)
    if (!order && (phone || email)) order = orderList.find((o) => (phone && digits10(o.customer_phone) === phone) || (email && (o.customer_email ?? "").trim().toLowerCase() === email))
    const { phone: _p, email: _e, ...rest } = s
    void _p
    void _e
    const realName = (v: string | null | undefined) => {
      const n = (v ?? "").trim()
      return n && !/^\+?\d[\d\s().-]{6,}$/.test(n) && !/^(unknown contact|unknown|guest)$/i.test(n) ? n : null
    }
    return {
      ...rest,
      orderId: order?.id ?? s.orderId,
      orderNo: order?.order_no ?? null,
      customerName: realName(order?.customer_name) ?? realName(lead?.full_name) ?? null,
      eventDate: order?.event_start ? String(order.event_start).slice(0, 10) : null,
      leadName: lead?.full_name ?? null,
      leadPhone: lead?.phone ?? null,
    }
  })
  sessions.sort((a, b) => Date.parse(b.lastAt) - Date.parse(a.lastAt))

  const rank = { live: 0, just_left: 1, recent: 2, earlier: 3 }
  const byOrder: Record<string, PlannerSession> = {}
  const byLead: Record<string, PlannerSession> = {}
  for (const s of sessions) {
    if (s.orderId && (!byOrder[s.orderId] || rank[s.state] < rank[byOrder[s.orderId].state])) byOrder[s.orderId] = s
    if (s.leadId && (!byLead[s.leadId] || rank[s.state] < rank[byLead[s.leadId].state])) byLead[s.leadId] = s
  }
  const liveCount = sessions.filter((s) => s.state === "live").length
  const recentCount = sessions.filter((s) => s.state === "recent" || s.state === "just_left").length
  const anonymousLive = sessions.filter((s) => s.state === "live" && !s.leadId && !s.orderId).length
  return NextResponse.json({ ok: true, hours, now: new Date(now).toISOString(), sessions, byOrder, byLead, liveCount, recentCount, anonymousLive, clarityProject: CLARITY_PROJECT })
}
