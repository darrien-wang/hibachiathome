import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { resolveAdminActor } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Planner · 谁在动 (2026-09-21). Every tap in the party planner lands in
// planner_events (device id `sid`, step name, small props, and since tonight
// the private key / plan id / share id plus device, city, ip). Grouped by
// device this becomes a session the workbench can show live on the order or
// lead it belongs to, and, for people who never left a phone number, as an
// anonymous session worth watching in Clarity for bugs.
//
//   GET ?hours=24 -> { sessions, byOrder, byLead, liveCount, recentCount, anonymousLive, clarityProject }
//
// Who is who:
//   host      came through the private key / a known contact / the plan's own host
//   guest     came through a share link - named after the host ("Christine 分享的客人")
//   anonymous cold visitor - told apart by device · city · #short id
//   staff     ?role=staff view
// "live" = something happened in the last LIVE_MS and the last step is not
// `leave`; "just_left" = left within LIVE_MS; "recent" = within RECENT_MS.

const LIVE_MS = 3 * 60_000
const RECENT_MS = 60 * 60_000
const CLARITY_PROJECT = process.env.CLARITY_PROJECT_ID ?? "y9dgbtwodj"

type Row = {
  sid: string
  event: string
  entry: string | null
  props: Record<string, unknown> | null
  created_at: string
  key_id: string | null
  lead_id: string | null
  order_id: string | null
  plan_id: string | null
  share_id: string | null
  ip: string | null
  device: string | null
  city: string | null
}

export type PlannerSession = {
  sid: string
  shortId: string
  state: "live" | "just_left" | "recent" | "earlier"
  role: "host" | "guest" | "anonymous" | "staff"
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
  planId: string | null
  shareId: string | null
  leadId: string | null
  orderId: string | null
  leadName: string | null
  leadPhone: string | null
  orderNo: string | null
  customerName: string | null
  eventDate: string | null
  /** For guests: whose party. For hosts: their own name again. */
  hostName: string | null
  /** Other devices on the same plan inside the window. */
  othersOnPlan: number
  device: string | null
  city: string | null
  ip: string | null
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
const realName = (v: string | null | undefined) => {
  const n = (v ?? "").trim()
  return n && !/^\+?\d[\d\s().-]{6,}$/.test(n) && !/^(unknown contact|unknown|guest)$/i.test(n) ? n : null
}

type Contact = { email?: string; phone?: string; leadId?: string; externalOrderId?: string }
type Host = { hostName?: string; hostPhone?: string; hostEmail?: string; keyId?: string; eventDate?: string }

export async function GET(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "supabase not configured" }, { status: 500 })
  const hours = Math.min(168, Math.max(1, Number(request.nextUrl.searchParams.get("hours") ?? 24) || 24))
  const since = new Date(Date.now() - hours * 3600_000).toISOString()
  const now = Date.now()

  const { data, error } = await supabase
    .from("planner_events")
    .select("sid, event, entry, props, created_at, key_id, lead_id, order_id, plan_id, share_id, ip, device, city")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(6000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = (data ?? []) as Row[]

  const bySid = new Map<string, Row[]>()
  for (const r of rows) (bySid.get(r.sid) ?? bySid.set(r.sid, []).get(r.sid)!).push(r)

  const keyIds = new Set<string>()
  const planIds = new Set<string>()
  const leadIds = new Set<string>()
  type Draft = PlannerSession & { phone: string | null; email: string | null; staff: boolean }
  const draft: Draft[] = []
  for (const [sid, list] of bySid) {
    const newest = list[0]
    const oldest = list[list.length - 1]
    const age = now - Date.parse(newest.created_at)
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
    const planId = pick((r) => r.plan_id)
    const leadId = pick((r) => r.lead_id)
    if (keyId) keyIds.add(keyId)
    if (planId) planIds.add(planId)
    if (leadId) leadIds.add(leadId)
    const entry = pick((r) => r.entry)
    draft.push({
      sid,
      shortId: sid.slice(0, 6),
      state,
      role: "anonymous",
      firstAt: oldest.created_at,
      lastAt: newest.created_at,
      minutesAgo: Math.round(age / 60_000),
      events: list.length,
      lastEvent: newest.event,
      entry,
      steps: list.slice(0, 10).map((r) => ({ event: r.event, at: r.created_at, sheet: strOrNull(props(r).sheet) ?? undefined })),
      guests: pick((r) => numOrNull(props(r).guests)),
      picked: pick((r) => numOrNull(props(r).picked)),
      joined: pick((r) => numOrNull(props(r).joined)),
      secs: pick((r) => (r.event === "leave" ? numOrNull(props(r).secs) : null)),
      phase: pick((r) => strOrNull(props(r).phase)),
      identified: list.some((r) => props(r).identified === true),
      edited: list.some((r) => props(r).edited === true || r.event === "first_edit"),
      keyId,
      planId,
      shareId: pick((r) => r.share_id),
      leadId,
      orderId: pick((r) => r.order_id),
      leadName: null,
      leadPhone: null,
      orderNo: null,
      customerName: null,
      eventDate: null,
      hostName: null,
      othersOnPlan: 0,
      device: pick((r) => r.device),
      city: pick((r) => r.city),
      ip: pick((r) => r.ip),
      claritySession: pick((r) => strOrNull(props(r).clarity_session)),
      clarityUser: pick((r) => strOrNull(props(r).clarity_user)),
      utmSource: pick((r) => strOrNull(props(r).utm_source)),
      phone: null,
      email: null,
      staff: entry === "staff",
    })
  }

  // Keys (private links) and plans (party host records) both live in
  // invoice_tokens; read them in one go.
  const tokens = [...Array.from(keyIds), ...Array.from(planIds).map((p) => "ph_" + p.replace(/^lp_/, ""))]
  const keyContacts = new Map<string, Contact>()
  const planHosts = new Map<string, Host>()
  if (tokens.length) {
    const { data: toks } = await supabase.from("invoice_tokens").select("token, invoice_data").in("token", tokens)
    for (const t of toks ?? []) {
      const w = t.invoice_data as { __kind?: string; contact?: Contact; host?: Host; liveId?: string } | null
      if (w?.__kind === "order_key" && w.contact) keyContacts.set(t.token, w.contact)
      if (w?.__kind === "party_host" && w.host) planHosts.set("lp_" + t.token.replace(/^ph_/, ""), w.host)
    }
  }
  // A host's key may itself be unknown to us yet: fetch those too.
  const hostKeys = Array.from(planHosts.values()).map((h) => h.keyId).filter((k): k is string => !!k && !keyContacts.has(k))
  if (hostKeys.length) {
    const { data: toks } = await supabase.from("invoice_tokens").select("token, invoice_data").in("token", hostKeys)
    for (const t of toks ?? []) {
      const w = t.invoice_data as { __kind?: string; contact?: Contact } | null
      if (w?.__kind === "order_key" && w.contact) keyContacts.set(t.token, w.contact)
    }
  }

  for (const s of draft) {
    const own = s.keyId ? keyContacts.get(s.keyId) : undefined
    const host = s.planId ? planHosts.get(s.planId) : undefined
    const hostContact = host?.keyId ? keyContacts.get(host.keyId) : undefined
    // Own key wins; otherwise the party's host is who this session belongs to.
    const c = own ?? hostContact
    s.phone = c?.phone ?? host?.hostPhone ?? null
    s.email = c?.email ?? host?.hostEmail ?? null
    if (!s.leadId && c?.leadId) s.leadId = c.leadId
    if (s.leadId) leadIds.add(s.leadId)
    if (host?.hostName) s.hostName = realName(host.hostName)
    if (!s.eventDate && host?.eventDate) s.eventDate = host.eventDate
    s.role = s.staff ? "staff" : s.entry === "share" ? "guest" : s.entry === "key" || s.entry === "known" || own || (s.planId && host && !s.shareId) ? "host" : "anonymous"
  }

  const leadMap = new Map<string, { id: string; full_name: string | null; phone: string | null; email: string | null }>()
  if (leadIds.size) {
    const { data: leads } = await supabase.from("leads").select("id, full_name, phone, email").in("id", Array.from(leadIds))
    for (const l of leads ?? []) leadMap.set(l.id, l)
  }
  const needLead = draft.filter((s) => !s.leadId && (s.phone || s.email))
  if (needLead.length) {
    const { data: recentLeads } = await supabase.from("leads").select("id, full_name, phone, email").is("merged_into", null).order("created_at", { ascending: false }).limit(400)
    for (const s of needLead) {
      const p = digits10(s.phone)
      const e = (s.email ?? "").trim().toLowerCase()
      const hit = (recentLeads ?? []).find((l) => (p && digits10(l.phone) === p) || (e && (l.email ?? "").trim().toLowerCase() === e))
      if (hit) {
        s.leadId = hit.id
        leadMap.set(hit.id, hit)
      }
    }
  }
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_no, source_ref, customer_name, customer_phone, customer_email, event_start, order_status, source_metadata")
    .neq("order_status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(300)
  const orderList = orders ?? []

  const planCounts = new Map<string, number>()
  for (const s of draft) if (s.planId) planCounts.set(s.planId, (planCounts.get(s.planId) ?? 0) + 1)

  const sessions: PlannerSession[] = draft.map((s) => {
    const lead = s.leadId ? leadMap.get(s.leadId) : undefined
    const phone = digits10(s.phone ?? lead?.phone)
    const email = (s.email ?? lead?.email ?? "").trim().toLowerCase()
    const c = s.keyId ? keyContacts.get(s.keyId) : s.planId && planHosts.get(s.planId)?.keyId ? keyContacts.get(planHosts.get(s.planId)!.keyId!) : undefined
    const ext = c?.externalOrderId
    let order = s.orderId ? orderList.find((o) => o.id === s.orderId) : undefined
    if (!order && ext) order = orderList.find((o) => o.id === ext || o.order_no === ext || o.source_ref === ext)
    if (!order && s.leadId) order = orderList.find((o) => ((o.source_metadata ?? {}) as Record<string, unknown>).lead_id === s.leadId)
    if (!order && (phone || email)) order = orderList.find((o) => (phone && digits10(o.customer_phone) === phone) || (email && (o.customer_email ?? "").trim().toLowerCase() === email))
    const name = realName(order?.customer_name) ?? realName(lead?.full_name) ?? s.hostName
    const { phone: _p, email: _e, staff: _s, ...rest } = s
    void _p
    void _e
    void _s
    return {
      ...rest,
      orderId: order?.id ?? s.orderId,
      orderNo: order?.order_no ?? null,
      customerName: name,
      hostName: s.role === "guest" ? (s.hostName ?? name) : name,
      eventDate: order?.event_start ? String(order.event_start).slice(0, 10) : s.eventDate,
      leadName: lead?.full_name ?? null,
      leadPhone: lead?.phone ?? null,
      othersOnPlan: s.planId ? Math.max(0, (planCounts.get(s.planId) ?? 1) - 1) : 0,
    }
  })
  sessions.sort((a, b) => Date.parse(b.lastAt) - Date.parse(a.lastAt))

  const rank = { live: 0, just_left: 1, recent: 2, earlier: 3 }
  const byOrder: Record<string, PlannerSession> = {}
  const byLead: Record<string, PlannerSession> = {}
  for (const s of sessions) {
    if (s.role === "staff") continue
    if (s.orderId && (!byOrder[s.orderId] || rank[s.state] < rank[byOrder[s.orderId].state])) byOrder[s.orderId] = s
    if (s.leadId && (!byLead[s.leadId] || rank[s.state] < rank[byLead[s.leadId].state])) byLead[s.leadId] = s
  }
  const liveCount = sessions.filter((s) => s.state === "live" && s.role !== "staff").length
  const recentCount = sessions.filter((s) => (s.state === "recent" || s.state === "just_left") && s.role !== "staff").length
  const anonymousLive = sessions.filter((s) => s.state === "live" && s.role === "anonymous").length
  return NextResponse.json({ ok: true, hours, now: new Date(now).toISOString(), sessions, byOrder, byLead, liveCount, recentCount, anonymousLive, clarityProject: CLARITY_PROJECT })
}
