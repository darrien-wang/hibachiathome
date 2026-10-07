import { type NextRequest, NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveAdminActor } from "@/lib/admin-auth"
import { isTapback } from "@/lib/courtesy-text"
import { computeInbox, type InboxEvent } from "@/lib/inbox"
import { loadLeadEventHint, type LeadEventHint } from "@/lib/lead-event-hint"
import { loadQuiet } from "@/lib/lead-hold"
import { reconcileThread } from "@/lib/sms-reconcile"
import { fetchSmsThreads, toE164, type SmsMessage } from "@/lib/sms-thread"
import { createServerSupabaseClient } from "@/lib/supabase"
import { getDrivingMiles } from "@/lib/travel-distance"
import { homeBaseOrigin } from "@/config/home-base"
import { PARTY_SIZE_CUSTOM_FROM, calcSimpleEstimate, calcTravelFee, checkWeekdayEligibility } from "@/config/pricing-rules"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// The sales desk in one call (响应速度架构 2026-09-27, Phase 1). Before this,
// answering one customer took five to seven round trips - inbox, lead, its
// timeline, the Twilio thread, a price - and every agent session stitched
// them together by hand. Now each waiting item comes back as one card with
// everything a reply needs: the lead and what it has told us, the whole
// conversation with tapbacks marked, the price the instant quote already
// gave (or an engine price for what we know), any orders on the same
// contact, and the facts the brakes will judge the next text by.
//
//   GET /api/admin/desk                 one card per waiting item (lib/inbox.ts)
//   GET /api/admin/desk?lead=<id>       one card for that lead
//   GET /api/admin/desk?phone=<e164>    one card for that number
//
// No rules live here - what to say is the leads skill's job.

const LEAD_COLUMNS =
  "id, created_at, full_name, phone, email, status, lead_source, lead_channel, lead_type, city_or_zip, guest_count, latest_message, utm_campaign, utm_term, hold_until, hold_set_at, acked_until, sms_blocked_at, merged_into"
const ORDER_COLUMNS =
  "id, order_no, customer_name, customer_phone, customer_email, event_start, event_address, guest_adult_count, guest_child_count, order_status, deposit_status, details_status, quoted_total_cents, balance_due_cents, source_metadata, created_at"
const TAG = /\[(callback|occasion|why|data|SOP:[^\]]+)\]/i
const AUTO_QUOTE = /price is \$([\d,.]+) for (.+?) \((.+?)\)\./
const ORIGIN_ZIP = homeBaseOrigin()

type LeadRow = {
  id: string
  created_at: string
  full_name: string | null
  phone: string | null
  email: string | null
  status: string
  lead_source: string | null
  lead_channel: string | null
  lead_type: string | null
  city_or_zip: string | null
  guest_count: number | null
  latest_message: string | null
  utm_campaign: string | null
  utm_term: string | null
  hold_until: string | null
  hold_set_at: string | null
  acked_until: string | null
  sms_blocked_at: string | null
  merged_into: string | null
}
type OrderRow = Record<string, unknown> & { id: string; order_no: string | null }
type Touchpoint = { touchpoint_type: string; occurred_at: string; raw_payload_json: Record<string, unknown> | null }

const digits10 = (phone: string | null | undefined) => String(phone ?? "").replace(/\D/g, "").slice(-10)

async function leadById(supabase: SupabaseClient, id: string): Promise<LeadRow | null> {
  const { data } = await supabase.from("leads").select(LEAD_COLUMNS).eq("id", id).maybeSingle()
  return (data as LeadRow | null) ?? null
}

async function leadByPhone(supabase: SupabaseClient, phone: string): Promise<LeadRow | null> {
  const { data } = await supabase
    .from("leads")
    .select(LEAD_COLUMNS)
    .eq("normalized_phone", digits10(phone))
    .is("merged_into", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as LeadRow | null) ?? null
}

async function ordersFor(supabase: SupabaseClient, phone: string | null, email: string | null, orderId: string | null): Promise<OrderRow[]> {
  const filters: string[] = []
  const d = digits10(phone)
  if (d.length === 10) filters.push(`customer_phone.ilike.%${d}%`)
  if (email) filters.push(`customer_email.ilike.${email.trim().toLowerCase()}`)
  if (orderId) filters.push(`id.eq.${orderId}`)
  if (!filters.length) return []
  const { data } = await supabase.from("orders").select(ORDER_COLUMNS).or(filters.join(",")).order("created_at", { ascending: false }).limit(5)
  return (data ?? []) as OrderRow[]
}

/** The instant quote already priced this party with the date the customer typed. */
function quotedFrom(thread: SmsMessage[]) {
  for (let i = thread.length - 1; i >= 0; i--) {
    const m = thread[i]
    if (m.direction !== "outbound") continue
    const hit = AUTO_QUOTE.exec(m.body ?? "")
    if (hit) return { at: m.at, total: hit[1], guests: hit[2], plan: hit[3] }
  }
  return null
}

/**
 * An engine price for what the lead has told us: guest_count as adults (the
 * lead has no adult/kid split), the timeline's date when it is a real date,
 * travel only when city_or_zip is a ZIP. Same functions as /api/agent/price.
 */
async function priceFor(row: LeadRow, hint: LeadEventHint | null) {
  const adults = row.guest_count ?? 0
  if (adults < 1) return null
  if (adults >= PARTY_SIZE_CUSTOM_FROM) return { customQuote: true, adults }
  const date = hint && /^\d{4}-\d{2}-\d{2}$/.test(hint.date) ? hint.date : null
  const zip = /^\d{5}$/.test(row.city_or_zip ?? "") ? (row.city_or_zip as string) : null
  let travelFee = 0
  let travelKnown = false
  if (zip) {
    try {
      travelFee = Math.round(calcTravelFee((await getDrivingMiles(ORIGIN_ZIP, zip)).drivingMiles))
      travelKnown = true
    } catch {
      travelKnown = false
    }
  }
  const one = (weekday: boolean) => {
    const est = calcSimpleEstimate({ adults, kids: 0, weekdaySpecial: weekday, travelFee })
    return { plan: weekday ? "Weekday Special (Mon-Thu)" : "Standard", total: est.total, foodSubtotal: est.subtotal, partySizeDiscount: est.partySizeDiscountApplied, minimumApplied: est.minApplied, travelFee: est.travelFee }
  }
  const eligibility = date ? checkWeekdayEligibility(date, { adult: adults, child: 0, toddler: 0 }) : null
  return {
    adults,
    date,
    zip,
    travelKnown,
    options: eligibility ? [one(eligibility.isEligible)] : [one(false), one(true)],
  }
}

async function buildCard(
  supabase: SupabaseClient,
  quiet: Awaited<ReturnType<typeof loadQuiet>>,
  input: { lead: LeadRow | null; phone: string | null; orderId?: string | null; events?: InboxEvent[] },
  now: number,
) {
  const lead = input.lead
  const phone = toE164(lead?.phone ?? input.phone)
  const phones = phone ? [phone] : []
  const [thread, touchpoints, hint, orders] = await Promise.all([
    phones.length ? fetchSmsThreads(phones, 80).catch(() => [] as SmsMessage[]) : Promise.resolve([] as SmsMessage[]),
    lead
      ? supabase
          .from("lead_touchpoints")
          .select("touchpoint_type, occurred_at, raw_payload_json")
          .eq("lead_id", lead.id)
          .in("touchpoint_type", ["agent_note", "agent_first_response", "call_inbound", "call_recording", "email_inbound", "email_outbound"])
          .order("occurred_at", { ascending: false })
          .limit(60)
          .then((r) => (r.data ?? []) as Touchpoint[])
      : Promise.resolve([] as Touchpoint[]),
    lead ? loadLeadEventHint(supabase, lead.id) : Promise.resolve(null),
    ordersFor(supabase, phone, lead?.email ?? null, input.orderId ?? null),
  ])
  thread.sort((a, b) => a.at.localeCompare(b.at))
  // Opening the conversation heals its timeline, exactly as the workbench does.
  if (lead && thread.length) reconcileThread(supabase, lead.id, thread).catch(() => undefined)

  const tags = touchpoints
    .filter((t) => t.touchpoint_type === "agent_note" || t.touchpoint_type === "agent_first_response")
    .map((t) => ({ at: t.occurred_at, note: String(t.raw_payload_json?.note ?? "") }))
    .filter((t) => TAG.test(t.note))
    .slice(0, 8)
  const calls = touchpoints.filter((t) => t.touchpoint_type === "call_inbound").map((t) => t.occurred_at).slice(0, 3)
  // Emails on the lead (support@ in via the Gmail script, out via desk email), newest last.
  const emails = touchpoints
    .filter((t) => t.touchpoint_type === "email_inbound" || t.touchpoint_type === "email_outbound")
    .map((t) => ({
      at: t.occurred_at,
      direction: t.touchpoint_type === "email_inbound" ? "inbound" : "outbound",
      subject: String(t.raw_payload_json?.subject ?? ""),
      snippet: String(t.raw_payload_json?.snippet ?? t.raw_payload_json?.text ?? "").replace(/\s+/g, " ").slice(0, 160),
      from: String(t.raw_payload_json?.from ?? t.raw_payload_json?.to ?? ""),
      gmailUrl: typeof t.raw_payload_json?.gmailUrl === "string" ? (t.raw_payload_json.gmailUrl as string) : null,
    }))
    .reverse()
    .slice(-12)
  const firstResponseAt = touchpoints.find((t) => t.touchpoint_type === "agent_first_response")?.occurred_at ?? null

  const last = thread[thread.length - 1] ?? null
  let unansweredRun = 0
  for (let i = thread.length - 1; i >= 0 && thread[i].direction === "outbound"; i--) unansweredRun++
  const dayAgo = now - 24 * 3600_000
  const ourLast24h = thread.filter((m) => m.direction === "outbound" && Date.parse(m.at) >= dayAgo && !/^Real Hibachi:/.test(m.body ?? "")).length
  const lastInbound = [...thread].reverse().find((m) => m.direction === "inbound") ?? null

  return {
    key: lead ? `lead:${lead.id}` : phone ? `phone:${phone}` : `order:${input.orderId}`,
    kinds: Array.from(new Set((input.events ?? []).map((e) => e.kind))),
    waitedMinutes: input.events?.length ? Math.max(...input.events.map((e) => e.waitedMinutes)) : null,
    urgent: (input.events ?? []).some((e) => e.urgent),
    justArrived: (input.events ?? []).some((e) => e.justArrived),
    lead: lead
      ? {
          id: lead.id,
          full_name: lead.full_name,
          phone,
          email: lead.email,
          status: lead.status,
          lead_source: lead.lead_source,
          lead_channel: lead.lead_channel,
          utm_campaign: lead.utm_campaign,
          utm_term: lead.utm_term,
          city_or_zip: lead.city_or_zip,
          guest_count: lead.guest_count,
          latest_message: lead.latest_message,
          created_at: lead.created_at,
          first_response_at: firstResponseAt,
          hold_until: lead.hold_until,
          acked_until: lead.acked_until,
          sms_blocked_at: lead.sms_blocked_at,
          event_hint: hint,
        }
      : null,
    phone,
    tags,
    calls,
    emails,
    thread: thread.map((m) => ({ sid: m.sid, direction: m.direction, at: m.at, body: m.body, status: m.status, tapback: m.direction === "inbound" && isTapback(m.body ?? "") })),
    quoted: quotedFrom(thread),
    price: lead ? await priceFor(lead, hint) : null,
    orders,
    stats: {
      lastSpeaker: last ? (last.direction === "inbound" ? "customer" : "us") : null,
      lastAt: last?.at ?? null,
      unansweredRun,
      ourLast24h,
      onHold: Boolean(lead?.hold_until && Date.parse(lead.hold_until) > now && !(lastInbound && lead.hold_set_at && Date.parse(lastInbound.at) > Date.parse(lead.hold_set_at))),
      quiet: lastInbound ? quiet.quiet(phone, Date.parse(lastInbound.at), lastInbound.body) : false,
    },
  }
}

export async function GET(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })
  const now = Date.now()
  const q = request.nextUrl.searchParams
  const quiet = await loadQuiet(supabase, now)

  // ---- one card ------------------------------------------------------------
  const leadParam = q.get("lead")?.trim()
  const phoneParam = toE164(q.get("phone"))
  if (leadParam || phoneParam) {
    let lead: LeadRow | null = null
    if (leadParam && /^[0-9a-f-]{36}$/i.test(leadParam)) lead = await leadById(supabase, leadParam)
    if (!lead && phoneParam) lead = await leadByPhone(supabase, phoneParam)
    if (!lead && !phoneParam) return NextResponse.json({ ok: false, error: "lead not found" }, { status: 404 })
    const card = await buildCard(supabase, quiet, { lead, phone: phoneParam }, now)
    return NextResponse.json({ ok: true, serverTime: new Date(now).toISOString(), cards: [card] })
  }

  // ---- everything waiting ----------------------------------------------------
  // A person is reading this, so show texts that are still inside the grace
  // window (flagged, so the card can say they may still be typing) and skip
  // the Twilio cache - the desk is asked on demand, not polled.
  const { counts, events } = await computeInbox(supabase, now, { includeFresh: true, noCache: true })
  const groups = new Map<string, { leadId: string | null; phone: string | null; orderId: string | null; events: InboxEvent[] }>()
  for (const ev of events) {
    if (ev.kind === "reddit") continue
    const key = ev.leadId ? `lead:${ev.leadId}` : ev.phone ? `phone:${ev.phone}` : ev.orderId ? `order:${ev.orderId}` : null
    if (!key) continue
    const g = groups.get(key) ?? { leadId: ev.leadId ?? null, phone: ev.phone ?? null, orderId: ev.orderId ?? null, events: [] }
    g.events.push(ev)
    if (!g.orderId && ev.orderId) g.orderId = ev.orderId
    groups.set(key, g)
  }
  // A deposit or change on a number that also has a lead card folds into it.
  const byPhone = new Map<string, string>()
  for (const [key, g] of groups) if (g.leadId && g.phone) byPhone.set(g.phone, key)
  for (const [key, g] of Array.from(groups)) {
    if (g.leadId || !g.phone) continue
    const target = byPhone.get(g.phone)
    if (target && target !== key) {
      const t = groups.get(target)!
      t.events.push(...g.events)
      if (!t.orderId) t.orderId = g.orderId
      groups.delete(key)
    }
  }

  const cards = []
  for (const g of groups.values()) {
    let lead: LeadRow | null = null
    if (g.leadId) lead = await leadById(supabase, g.leadId)
    if (!lead && g.phone) lead = await leadByPhone(supabase, g.phone)
    cards.push(await buildCard(supabase, quiet, { lead, phone: g.phone, orderId: g.orderId, events: g.events }, now))
  }
  cards.sort((a, b) => (b.urgent === a.urgent ? (b.waitedMinutes ?? 0) - (a.waitedMinutes ?? 0) : b.urgent ? 1 : -1))
  return NextResponse.json({ ok: true, serverTime: new Date(now).toISOString(), counts, redditNew: counts.redditNew, cards })
}
