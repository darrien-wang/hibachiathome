import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { can, resolveAdminActor } from "@/lib/admin-auth"
import { CRON_PURPOSE_META_CAPI, isCronCall } from "@/lib/cron-key"
import { buildEvent, isDecline, metaCapiToken, sendCapiEvents, type CapiEvent } from "@/lib/meta-capi"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Meta Conversions API sweep (D-1014-01, lib/meta-capi.ts explains why).
//
//   POST ?action=context  {fbclid, fbp}   public: the browser of a Meta ad click
//                                         records its user agent / IP / _fbp once
//   POST ?consumer=cron                   pg_cron every 15 min (derived key "meta-capi")
//   POST (admin) [?dry=1] [?test_event_code=TEST123]   run it by hand
//
// The sweep looks back 7 days (Meta's limit for event_time) and sends each
// event once: Contact when a Meta lead first writes back with something that
// is not a no, Purchase when a Meta customer's date is locked.

const LOOKBACK_DAYS = 7
const DEFAULT_BOOKING_VALUE_CENTS = 60_000

type LeadRow = {
  id: string
  created_at: string
  first_seen_at: string | null
  email: string | null
  phone: string | null
  fbclid: string | null
  utm_source: string | null
  status: string | null
  normalized_phone: string | null
}

const digits10 = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "").slice(-10)

async function saveContext(request: NextRequest) {
  let body: { fbclid?: unknown; fbp?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  const fbclid = String(body.fbclid ?? "").trim()
  const fbpRaw = String(body.fbp ?? "").trim()
  if (fbclid.length < 10 || fbclid.length > 500 || !/^[\w.-]+$/.test(fbclid)) return NextResponse.json({ ok: false }, { status: 400 })
  const fbp = /^fb\.\d\.\d{10,14}\.\d{5,25}$/.test(fbpRaw) ? fbpRaw : null
  const ip = (request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || null
  const userAgent = request.headers.get("user-agent")?.slice(0, 400) || null
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 })
  const now = new Date().toISOString()
  const { data: existing } = await supabase.from("meta_click_context").select("fbclid, fbp").eq("fbclid", fbclid).maybeSingle()
  if (existing) {
    await supabase
      .from("meta_click_context")
      .update({ last_seen_at: now, ...(fbp && !(existing as { fbp: string | null }).fbp ? { fbp } : {}) })
      .eq("fbclid", fbclid)
  } else {
    await supabase.from("meta_click_context").insert({ fbclid, fbp, user_agent: userAgent, ip, first_seen_at: now, last_seen_at: now })
  }
  return NextResponse.json({ ok: true })
}

export async function POST(request: NextRequest) {
  const params = request.nextUrl.searchParams
  if (params.get("action") === "context") return saveContext(request)

  const cron = isCronCall(request, CRON_PURPOSE_META_CAPI)
  if (!cron) {
    const actor = await resolveAdminActor(request)
    if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    if (!can(actor, "board")) return NextResponse.json({ error: "没有看板权限" }, { status: 403 })
  }
  const dry = params.get("dry") === "1"
  const testEventCode = params.get("test_event_code")?.trim() || undefined
  if (!dry && !metaCapiToken()) return NextResponse.json({ ok: false, error: "META_CAPI_TOKEN not set" }, { status: 200 })

  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86400_000).toISOString()

  // Every Meta lead that could still produce an event: clicked in the last
  // 7 days, or older but its customer booked in the last 7 days (below).
  const { data: leadRows, error: leadErr } = await supabase
    .from("leads")
    .select("id, created_at, first_seen_at, email, phone, fbclid, utm_source, status, normalized_phone")
    .not("fbclid", "is", null)
    .is("merged_into", null)
    .gte("created_at", new Date(Date.now() - 60 * 86400_000).toISOString())
    .limit(2000)
  if (leadErr) return NextResponse.json({ ok: false, error: leadErr.message }, { status: 500 })
  const leads = ((leadRows ?? []) as LeadRow[]).filter((l) => l.status !== "disqualified")
  const byPhone = new Map<string, LeadRow>()
  const byEmail = new Map<string, LeadRow>()
  for (const l of leads) {
    const p = digits10(l.phone)
    if (p && !byPhone.has(p)) byPhone.set(p, l)
    const e = (l.email ?? "").trim().toLowerCase()
    if (e && !byEmail.has(e)) byEmail.set(e, l)
  }

  const fbclids = Array.from(new Set(leads.map((l) => l.fbclid).filter(Boolean))) as string[]
  const ctx = new Map<string, { fbp: string | null; user_agent: string | null; ip: string | null }>()
  for (let i = 0; i < fbclids.length; i += 200) {
    const { data } = await supabase.from("meta_click_context").select("fbclid, fbp, user_agent, ip").in("fbclid", fbclids.slice(i, i + 200))
    for (const r of (data ?? []) as Array<{ fbclid: string; fbp: string | null; user_agent: string | null; ip: string | null }>) ctx.set(r.fbclid, r)
  }
  const userFor = (l: LeadRow, email?: string | null, phone?: string | null) => {
    const c = l.fbclid ? ctx.get(l.fbclid) : undefined
    return {
      email: email ?? l.email,
      phone: phone ?? l.phone,
      fbclid: l.fbclid,
      clickedAt: l.first_seen_at ?? l.created_at,
      fbp: c?.fbp ?? null,
      userAgent: c?.user_agent ?? null,
      ip: c?.ip ?? null,
      externalId: l.id,
    }
  }

  const candidates: Array<CapiEvent & { leadId: string; orderId?: string }> = []

  // ---- Contact: first real reply ------------------------------------------
  const recent = leads.filter((l) => l.created_at >= since)
  const recentIds = recent.map((l) => l.id)
  const inbound = new Map<string, Array<{ at: string; text: string }>>()
  for (let i = 0; i < recentIds.length; i += 200) {
    const { data } = await supabase
      .from("lead_touchpoints")
      .select("lead_id, occurred_at, raw_payload_json")
      .in("lead_id", recentIds.slice(i, i + 200))
      .in("touchpoint_type", ["sms_inbound", "email_inbound"])
      .order("occurred_at", { ascending: true })
    for (const r of (data ?? []) as Array<{ lead_id: string; occurred_at: string; raw_payload_json: Record<string, unknown> | null }>) {
      const p = r.raw_payload_json ?? {}
      const text = String(p.Body ?? p.body ?? p.text ?? p.snippet ?? p.subject ?? "")
      const list = inbound.get(r.lead_id) ?? []
      list.push({ at: r.occurred_at, text })
      inbound.set(r.lead_id, list)
    }
  }
  for (const l of recent) {
    const reply = (inbound.get(l.id) ?? []).find((m) => m.at >= l.created_at && m.at >= since && !isDecline(m.text))
    if (!reply) continue
    candidates.push({ eventName: "Contact", eventId: `reply-${l.id}`, eventTime: reply.at, user: userFor(l), leadId: l.id })
  }

  // ---- Purchase: a Meta customer locked a date ------------------------------
  const { data: orderRows } = await supabase
    .from("orders")
    .select("id, created_at, quoted_total_cents, customer_email, customer_phone, source_ref, source_metadata")
    .eq("deposit_status", "paid_verified")
    .gte("created_at", since)
    .limit(500)
  const orders = (orderRows ?? []) as Array<{
    id: string
    created_at: string
    quoted_total_cents: number | null
    customer_email: string | null
    customer_phone: string | null
    source_ref: string | null
    source_metadata: Record<string, unknown> | null
  }>
  const bookingIds = orders.map((o) => o.source_ref).filter((s): s is string => Boolean(s && /^[0-9a-f-]{36}$/i.test(s)))
  const sessionOf = new Map<string, string>()
  if (bookingIds.length) {
    const { data } = await supabase.from("bookings").select("id, payment_intent_id, stripe_session_id").in("id", bookingIds)
    for (const b of (data ?? []) as Array<{ id: string; payment_intent_id: string | null; stripe_session_id: string | null }>) {
      const tx = b.payment_intent_id || b.stripe_session_id
      if (tx) sessionOf.set(b.id, tx)
    }
  }
  for (const o of orders) {
    const leadId = typeof o.source_metadata?.lead_id === "string" ? (o.source_metadata.lead_id as string) : null
    const lead =
      (leadId ? leads.find((l) => l.id === leadId) : undefined) ??
      byPhone.get(digits10(o.customer_phone)) ??
      byEmail.get((o.customer_email ?? "").trim().toLowerCase())
    if (!lead) continue // not a Meta customer
    const value = (o.quoted_total_cents ?? 0) > 0 ? (o.quoted_total_cents as number) : DEFAULT_BOOKING_VALUE_CENTS
    candidates.push({
      eventName: "Purchase",
      // Same id as the pixel's Purchase (deposit success page), so Meta dedupes.
      eventId: (o.source_ref && sessionOf.get(o.source_ref)) || `order-${o.id}`,
      eventTime: o.created_at,
      valueCents: value,
      user: userFor(lead, o.customer_email, o.customer_phone),
      leadId: lead.id,
      orderId: o.id,
    })
  }

  // ---- Already sent? ----------------------------------------------------------
  const ids = candidates.map((c) => c.eventId)
  const sent = new Set<string>()
  for (let i = 0; i < ids.length; i += 200) {
    let q = supabase.from("meta_capi_events").select("event_name, event_id").in("event_id", ids.slice(i, i + 200)).eq("ok", true)
    q = testEventCode ? q.eq("test_event_code", testEventCode) : q.is("test_event_code", null)
    const { data } = await q
    for (const r of (data ?? []) as Array<{ event_name: string; event_id: string }>) sent.add(`${r.event_name}|${r.event_id}`)
  }
  const todo = candidates.filter((c) => !sent.has(`${c.eventName}|${c.eventId}`))

  const summary = {
    contact: todo.filter((c) => c.eventName === "Contact").length,
    purchase: todo.filter((c) => c.eventName === "Purchase").length,
    withBrowserContext: todo.filter((c) => c.user.userAgent).length,
  }
  if (dry) {
    return NextResponse.json({
      ok: true,
      dry: true,
      ...summary,
      events: todo.map((c) => ({ event: c.eventName, at: c.eventTime, lead: c.leadId, order: c.orderId ?? null, value: c.valueCents ?? null, website: Boolean(c.user.userAgent) })),
    })
  }

  let okCount = 0
  const errors: unknown[] = []
  for (let i = 0; i < todo.length; i += 50) {
    const batch = todo.slice(i, i + 50)
    const res = await sendCapiEvents(batch.map(buildEvent), testEventCode)
    if (res.ok) okCount += batch.length
    else errors.push(res.body)
    await supabase.from("meta_capi_events").insert(
      batch.map((c) => ({
        event_name: c.eventName,
        event_id: c.eventId,
        lead_id: c.leadId,
        order_id: c.orderId ?? null,
        event_time: c.eventTime,
        value_cents: c.valueCents ?? null,
        test_event_code: testEventCode ?? null,
        ok: res.ok,
        response: res.body as object,
      })),
    )
  }
  return NextResponse.json({ ok: errors.length === 0, sent: okCount, ...summary, errors: errors.slice(0, 3) })
}
