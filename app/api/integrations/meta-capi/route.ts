import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { can, resolveAdminActor } from "@/lib/admin-auth"
import { CRON_PURPOSE_META_CAPI, isCronCall } from "@/lib/cron-key"
import { inChunks } from "@/lib/in-chunks"
import { buildEvent, isDecline, metaCapiToken, sendCapiEvents, type CapiEvent } from "@/lib/meta-capi"
import {
  META_CAPI_CADENCE,
  META_CAPI_HEALTH_KEY,
  TOKEN_NOT_SET,
  failingMail,
  metaRefused,
  readRefused,
  recoveredMail,
  sentNotOnFile,
  sweepOutcome,
  type SweepRead,
} from "@/lib/meta-capi-health"
import { recordSweepHealth } from "@/lib/sweep-health-store"

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
// is not a no, Purchase + Schedule when a Meta customer's date is locked.
//
// A read the database refuses ends the sweep before anything is sent (500,
// naming the read). It is not an empty answer: an event sent without the
// click's browser, without the booking's payment id or without the list of
// what was already sent goes on file as sent and is never corrected, while the
// next sweep, 15 minutes later, finds the same events again. From 2026-10-26
// to 2026-11-12 the click lookup was refused on every sweep (its URL had grown
// past what the API answers, lib/in-chunks.ts), the error was dropped, and 35
// events went out as system_generated with the browser on file.
//
// pg_cron never reads what the sweep answers, so the cron sweep keeps count
// itself: anything but ok:true is a failure in workbench_settings
// (meta_capi.health), the 4th in a row mails ops, then one mail every 12
// hours, and one when a sweep works again (lib/meta-capi-health.ts). A run by
// hand, a dry run and a test-event run are not the schedule and are not
// counted.

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

type Answer = { status: number; body: { ok: boolean; error?: string; sent?: number } & Record<string, unknown> }

async function sweep(dry: boolean, testEventCode: string | undefined): Promise<Answer> {
  if (!dry && !metaCapiToken()) return { status: 200, body: { ok: false, error: TOKEN_NOT_SET } }

  const supabase = createServerSupabaseClient()
  if (!supabase) return { status: 500, body: { ok: false, error: "supabase not configured" } }
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86400_000).toISOString()
  const refused = (read: SweepRead, error: { message: string }): Answer => ({ status: 500, body: { ok: false, error: readRefused(read, error.message) } })

  // Every Meta lead that could still produce an event: clicked in the last
  // 7 days, or older but its customer booked in the last 7 days (below).
  const { data: leadRows, error: leadErr } = await supabase
    .from("leads")
    .select("id, created_at, first_seen_at, email, phone, fbclid, utm_source, status, normalized_phone")
    .not("fbclid", "is", null)
    .is("merged_into", null)
    .gte("created_at", new Date(Date.now() - 60 * 86400_000).toISOString())
    .limit(2000)
  if (leadErr) return refused("leads", leadErr)
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
  // A click id is about 190 characters: the list is cut by its length in the URL, not by a count.
  for (const part of inChunks(fbclids)) {
    const { data, error } = await supabase.from("meta_click_context").select("fbclid, fbp, user_agent, ip").in("fbclid", part)
    if (error) return refused("meta_click_context", error)
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
  for (const part of inChunks(recentIds)) {
    const { data, error } = await supabase
      .from("lead_touchpoints")
      .select("lead_id, occurred_at, raw_payload_json")
      .in("lead_id", part)
      .in("touchpoint_type", ["sms_inbound", "email_inbound"])
      .order("occurred_at", { ascending: true })
    if (error) return refused("lead_touchpoints", error)
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
  const { data: orderRows, error: orderErr } = await supabase
    .from("orders")
    .select("id, created_at, quoted_total_cents, customer_email, customer_phone, source_ref, source_metadata")
    .eq("deposit_status", "paid_verified")
    .gte("created_at", since)
    .limit(500)
  if (orderErr) return refused("orders", orderErr)
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
  for (const part of inChunks(bookingIds)) {
    const { data, error } = await supabase.from("bookings").select("id, payment_intent_id, stripe_session_id").in("id", part)
    if (error) return refused("bookings", error)
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
    const user = userFor(lead, o.customer_email, o.customer_phone)
    candidates.push({
      eventName: "Purchase",
      // Same id as the pixel's Purchase (deposit success page), so Meta dedupes.
      eventId: (o.source_ref && sessionOf.get(o.source_ref)) || `order-${o.id}`,
      eventTime: o.created_at,
      valueCents: value,
      user,
      leadId: lead.id,
      orderId: o.id,
    })
    // The pixel never sends Schedule, so this one only comes from here.
    candidates.push({ eventName: "Schedule", eventId: `lock-${o.id}`, eventTime: o.created_at, valueCents: value, user, leadId: lead.id, orderId: o.id })
  }

  // ---- Already sent? ----------------------------------------------------------
  const ids = candidates.map((c) => c.eventId)
  const sent = new Set<string>()
  for (const part of inChunks(ids)) {
    let q = supabase.from("meta_capi_events").select("event_name, event_id").in("event_id", part).eq("ok", true)
    q = testEventCode ? q.eq("test_event_code", testEventCode) : q.is("test_event_code", null)
    const { data, error } = await q
    if (error) return refused("meta_capi_events", error)
    for (const r of (data ?? []) as Array<{ event_name: string; event_id: string }>) sent.add(`${r.event_name}|${r.event_id}`)
  }
  const todo = candidates.filter((c) => !sent.has(`${c.eventName}|${c.eventId}`))

  const summary = {
    contact: todo.filter((c) => c.eventName === "Contact").length,
    purchase: todo.filter((c) => c.eventName === "Purchase").length,
    schedule: todo.filter((c) => c.eventName === "Schedule").length,
    withBrowserContext: todo.filter((c) => c.user.userAgent).length,
  }
  if (dry) {
    return {
      status: 200,
      body: {
        ok: true,
        dry: true,
        ...summary,
        events: todo.map((c) => ({ event: c.eventName, at: c.eventTime, lead: c.leadId, order: c.orderId ?? null, value: c.valueCents ?? null, website: Boolean(c.user.userAgent) })),
      },
    }
  }

  let okCount = 0
  const errors: unknown[] = []
  const failures: string[] = []
  for (let i = 0; i < todo.length; i += 50) {
    const batch = todo.slice(i, i + 50)
    const res = await sendCapiEvents(batch.map(buildEvent), testEventCode)
    if (!res.ok) {
      // Nothing goes on file for a batch Meta did not take. meta_capi_events
      // holds one row per real event (unique on event_name + event_id), so a
      // row for the refusal would keep the later success off the file and the
      // event would go out again on every sweep. The next sweep finds it still
      // unsent; what Meta said is in this answer and in the health record.
      errors.push(res.body)
      failures.push(metaRefused(res))
      continue
    }
    okCount += batch.length
    const { error: fileError } = await supabase.from("meta_capi_events").insert(
      batch.map((c) => ({
        event_name: c.eventName,
        event_id: c.eventId,
        lead_id: c.leadId,
        order_id: c.orderId ?? null,
        event_time: c.eventTime,
        value_cents: c.valueCents ?? null,
        test_event_code: testEventCode ?? null,
        ok: true,
        response: res.body as object,
      })),
    )
    if (fileError) {
      // Sent and not on file: the next sweep sends this batch again. No more
      // batches now - each would be one more that cannot be put on file.
      failures.push(sentNotOnFile(batch.length, fileError.message))
      break
    }
  }
  return {
    status: 200,
    body: { ok: failures.length === 0, ...(failures.length ? { error: [...new Set(failures)].slice(0, 3).join(" | ") } : {}), sent: okCount, ...summary, errors: errors.slice(0, 3) },
  }
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

  let answer: Answer
  try {
    answer = await sweep(dry, testEventCode)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[meta-capi] sweep crashed", error)
    answer = { status: 500, body: { ok: false, error: message } }
  }
  if (cron && !dry && !testEventCode) {
    const sent = answer.body.sent ?? 0
    await recordSweepHealth(
      { key: META_CAPI_HEALTH_KEY, name: "meta-capi", cadence: META_CAPI_CADENCE, failingMail, recoveredMail: (prev, nowMs) => recoveredMail(prev, nowMs, sent) },
      sweepOutcome(answer.body),
    )
  }
  return NextResponse.json(answer.body, { status: answer.status })
}
