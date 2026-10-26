import type { SupabaseClient } from "@supabase/supabase-js"
import { courtesyOnly, isTapback, notAQuestion } from "@/lib/courtesy-text"
import { HINT_TYPES, hintFromRows, type HintRow } from "@/lib/lead-event-hint"
import { holdState, loadQuiet } from "@/lib/lead-hold"
import { fetchLastByPeer, toE164, type LastByPeer } from "@/lib/sms-thread"
import { CUSTOMER_FORM_TYPES, FORM_LABELS, formSummary } from "@/lib/customer-forms"
import { getCityTravel } from "@/config/city-travel"
import { fetchOrderLints, gapsWithLint, type OrderLint } from "@/lib/order-lint-client"

// The lead scan (线索扫描 skill, 2026-10-01): every open lead sorted into one
// bucket, each bucket with one action. The buckets encode what the 09-27
// audit found - deposits follow a step the customer took, not a text we
// sent - so the scan exists first to catch those steps (a reply, a call, a
// second quote, an opened deposit page), then to remove what blocks the next
// one, and only last to send the single follow-up a silent lead is owed.
//
//   A  欠回复   the customer spoke last (text or call) - answer now
//   C  热信号   re-quote, deposit page, payment failure, planner activity
//   G  已付未齐 paid, party soon, address / menu / time still missing
//   B  承诺到期 they named a day to get back to us and it has passed
//   E  派对临近 party within 7 days, no deposit
//   D  到期跟进 silent, under the 3-text cap, one follow-up due
//   H  停       hold, cap reached, dead number, fresh (our turn is done)
//   F           an objection the words carry (tables, budget, the minimum):
//               a flag on D / E, because the follow-up is then a concession
//
// Classification is data; what to say is the skills' job. Nothing here sends.

export type Bucket = "A" | "B" | "C" | "D" | "E" | "G" | "H"

export type ScanItem = {
  leadId: string
  name: string
  phone: string | null
  email: string | null
  city: string | null
  guests: number | null
  status: string
  createdAt: string
  bucket: Bucket
  /** D / E whose wording should be the concession, not the ladder line. */
  objection: boolean
  flags: string[]
  reason: string
  lastSpeaker: "customer" | "us" | null
  lastAt: string | null
  /** Our texts since the customer last spoke (automated ones included). */
  run: number
  holdUntil: string | null
  callback: string | null
  eventDate: string | null
  daysToEvent: number | null
  quoted: { total: number; adults: number; kids: number; at: string; city: string | null } | null
  nextActionAt: string | null
}

export type OrderGap = {
  orderId: string
  orderNo: string | null
  name: string | null
  phone: string | null
  leadId: string | null
  eventStart: string | null
  daysToEvent: number | null
  gaps: string[]
}

export type ScanResult = {
  serverTime: string
  pool: number
  summary: Record<Bucket | "F", number>
  items: ScanItem[]
  orders: OrderGap[]
  /** false when the invoice app's order lint could not be asked (G then lists the scan's own gaps only). */
  orderLint?: false
}

type LeadRow = {
  id: string
  created_at: string
  full_name: string | null
  phone: string | null
  email: string | null
  status: string
  city_or_zip: string | null
  guest_count: number | null
  hold_until: string | null
  hold_set_at: string | null
  acked_until: string | null
  sms_blocked_at: string | null
}
type TP = { lead_id: string; touchpoint_type: string; occurred_at: string; raw_payload_json: Record<string, unknown> | null }
type OrderRow = {
  id: string
  order_no: string | null
  customer_name: string | null
  customer_phone: string | null
  event_start: string | null
  event_address: string | null
  invoice_data: Record<string, unknown> | null
  source_metadata: Record<string, unknown> | null
}

const POOL_DAYS = 60
const CAP = 3
/** A follow-up is "day 2": not before 20 hours after our last text. */
const FOLLOWUP_WAIT_MS = 20 * 3600_000
const SIGNAL_WINDOW_MS = 48 * 3600_000
const COURTESY_WINDOW_MS = 2 * 3600_000
const ORDER_HORIZON_DAYS = 14
/**
 * Twilio stamps a text when the carrier takes it (date_sent), a second or two
 * after the timeline logged the same send. Only a Twilio send later than this
 * is one the timeline missed (a text from the phone app).
 */
const TWILIO_LAG_MS = 2 * 60_000

const SCAN_TYPES = Array.from(
  new Set([
    ...HINT_TYPES,
    "sms_outbound",
    "email_outbound",
    "email_inbound",
    "deposit_checkout_started",
    "payment_failed",
    "planner_opened",
    "planner_edited",
    "planner_menu_complete",
    "address_detected",
  ]),
)
const SIGNAL_TYPES = new Set(["deposit_checkout_started", "payment_failed", "planner_opened", "planner_edited", "planner_menu_complete", "address_detected"])
const DEFAULT_CITY = /^(southern california|la & orange county|los angeles & orange county|socal)$/i
const TABLES_RE = /\b(tables?|chairs?|set ?up|setup|linens?|tableware)\b/i
const BUDGET_RE = /\b(budget|afford|cheaper|expensive|pricey|too much|discount|lower|best price|price match)\b/i
const AUTOMATED = /^Real Hibachi:/
const DAY_MS = 86400_000

const str = (v: unknown) => (typeof v === "string" ? v : "")

/** The page's auto "leave" quote carrying the untouched defaults: a revisit, not a re-quote. */
export function isDefaultLeaveQuote(p: Record<string, unknown> | null | undefined): boolean {
  const q = p ?? {}
  return q.auto === "leave" && Number(q.adults) === 15 && !Number(q.kids) && !q.eventDate
}
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0)
const slug = (city: string) => city.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
const later = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b)
const digits10 = (phone: string | null | undefined) => String(phone ?? "").replace(/\D/g, "").slice(-10)

function daysUntil(date: string | null, now: number): number | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  // Party dates are wall-clock days; compare on Pacific calendar days.
  const today = new Date(new Date(now).toLocaleString("en-US", { timeZone: "America/Los_Angeles" }))
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const [y, m, d] = date.split("-").map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - todayUtc) / DAY_MS)
}

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await build(from, from + 999)
    if (!data?.length) break
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

export async function scanLeads(supabase: SupabaseClient, now = Date.now(), opts: { write?: boolean; lint?: boolean } = {}): Promise<ScanResult> {
  const since = new Date(now - POOL_DAYS * DAY_MS).toISOString()
  const [leads, quiet, byPeer, orders] = await Promise.all([
    fetchAll<LeadRow>((from, to) =>
      supabase
        .from("leads")
        .select("id, created_at, full_name, phone, email, status, city_or_zip, guest_count, hold_until, hold_set_at, acked_until, sms_blocked_at")
        .not("status", "in", "(won,lost,disqualified)")
        .is("merged_into", null)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .range(from, to),
    ),
    loadQuiet(supabase, now),
    fetchLastByPeer(1000, 0).catch(() => new Map<string, LastByPeer>()),
    fetchAll<OrderRow>((from, to) =>
      supabase
        .from("orders")
        .select("id, order_no, customer_name, customer_phone, event_start, event_address, invoice_data, source_metadata")
        .eq("deposit_status", "paid_verified")
        .or("order_status.is.null,order_status.neq.cancelled")
        .gte("event_start", new Date(now - DAY_MS).toISOString())
        .lte("event_start", new Date(now + ORDER_HORIZON_DAYS * DAY_MS).toISOString())
        .order("event_start", { ascending: true })
        .range(from, to),
    ),
  ])

  const ids = leads.map((l) => l.id)
  const touchpoints: TP[] = []
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40)
    touchpoints.push(
      ...(await fetchAll<TP>((from, to) =>
        supabase
          .from("lead_touchpoints")
          .select("lead_id, touchpoint_type, occurred_at, raw_payload_json")
          .in("lead_id", chunk)
          .in("touchpoint_type", SCAN_TYPES)
          .gte("occurred_at", since)
          .order("occurred_at", { ascending: true })
          .range(from, to),
      )),
    )
  }
  const byLead = new Map<string, TP[]>()
  for (const t of touchpoints) {
    const list = byLead.get(t.lead_id) ?? []
    list.push(t)
    byLead.set(t.lead_id, list)
  }
  // A paid order on the same number means the lead is a customer, whatever
  // its status says - unless the order was cancelled (Isabella Reyna locked and
  // cancelled 11/7 the same afternoon on 10-18; her lead went back to "in talks").
  const paidPhones = new Set<string>()
  const { data: paidAll } = await supabase
    .from("orders")
    .select("customer_phone")
    .eq("deposit_status", "paid_verified")
    .or("order_status.is.null,order_status.neq.cancelled")
    .gte("created_at", since)
  for (const o of (paidAll ?? []) as Array<{ customer_phone: string | null }>) {
    const d = digits10(o.customer_phone)
    if (d) paidPhones.add(d)
  }

  const items: ScanItem[] = []
  for (const lead of leads) {
    const tps = byLead.get(lead.id) ?? []
    const phone = toE164(lead.phone)
    const inbound = tps
      .filter((t) => t.touchpoint_type === "sms_inbound")
      .map((t) => ({ at: t.occurred_at, body: str(t.raw_payload_json?.Body ?? t.raw_payload_json?.body), media: num(t.raw_payload_json?.NumMedia ?? t.raw_payload_json?.media) }))
    const outbound = tps.filter((t) => t.touchpoint_type === "sms_outbound").map((t) => ({ at: t.occurred_at, body: str(t.raw_payload_json?.body ?? t.raw_payload_json?.Body) }))
    const calls = tps.filter((t) => t.touchpoint_type === "call_inbound").map((t) => t.occurred_at)
    // Email is a conversation too (support@ in via the Gmail script, out via
    // desk email): a lead we have only emailed is not "never contacted", and
    // an email from them is them speaking. Jackson Rogow (email only) sat in A
    // "从没联系过" after three replies (2026-10-12).
    const emailsIn = tps.filter((t) => t.touchpoint_type === "email_inbound").map((t) => t.occurred_at)
    const emailsOut = tps.filter((t) => t.touchpoint_type === "email_outbound").map((t) => t.occurred_at)
    const lastEmailInAt = emailsIn.length ? emailsIn[emailsIn.length - 1] : null
    const lastEmailOutAt = emailsOut.length ? emailsOut[emailsOut.length - 1] : null
    const notes = tps.filter((t) => t.touchpoint_type === "agent_note").map((t) => ({ at: t.occurred_at, note: str(t.raw_payload_json?.note) }))
    const quotes = tps.filter((t) => t.touchpoint_type === "landing_quote_text")
    // Only quotes the customer shaped say anything about the party: a revisit
    // that leaves without touching the estimator still fires the page's auto
    // "leave" quote with the defaults (15 adults, no date). Read as a re-quote
    // it made 912-944-5781 (entered 30 for 10/17) "headcount_down" and
    // 626-818-0077 a C signal, and follow-ups were written to a 15 nobody chose
    // (2026-10-09).
    const shapedQuotes = quotes.filter((t) => !isDefaultLeaveQuote(t.raw_payload_json))
    const signals = tps.filter((t) => SIGNAL_TYPES.has(t.touchpoint_type))

    // Twilio is the truth for who spoke last; the timeline can lag a text sent
    // from the phone app.
    const tw = phone ? byPeer.get(phone) : undefined
    let lastInAt = later(inbound.length ? inbound[inbound.length - 1].at : null, tw?.lastInAt ?? null)
    let lastInBody = inbound.length ? inbound[inbound.length - 1].body : ""
    if (tw?.last.direction === "inbound" && tw.lastInAt && (!inbound.length || tw.lastInAt > inbound[inbound.length - 1].at)) lastInBody = tw.last.body
    const dbLastOut = outbound.length ? outbound[outbound.length - 1].at : null
    const lastOutAt = later(later(dbLastOut, tw?.lastOutAt ?? null), lastEmailOutAt)
    // A reaction or a "thanks" after a real message (or photos) is not the
    // thing to judge: "Loved …" 30 s after three patio photos put 909-268-7235
    // in H "最后一条是点赞" for two days (2026-10-05). When the newest inbound
    // with content came after our last text, judge that one. An MMS has an
    // empty body: say so instead of reading it as courtesy. The timeline keeps
    // what is older than Twilio's last 1000 texts, so the newest one with
    // content is the later of the two records.
    const timelineRealIn = [...inbound].reverse().find((m) => m.media > 0 || !notAQuestion(m.body)) ?? null
    const realIn = timelineRealIn && (!tw?.lastRealIn || timelineRealIn.at > tw.lastRealIn.at) ? timelineRealIn : (tw?.lastRealIn ?? null)
    if (realIn && (!lastOutAt || realIn.at > lastOutAt) && (isTapback(lastInBody) || courtesyOnly(lastInBody))) {
      lastInBody = realIn.body.trim() || (realIn.media > 0 ? `[${realIn.media} photo(s)]` : lastInBody)
    }
    const manualOut = outbound.filter((m) => !AUTOMATED.test(m.body))
    const lastManualOutAt = manualOut.length ? manualOut[manualOut.length - 1].at : null
    const lastCallAt = calls.length ? calls[calls.length - 1] : null
    // Forms on the site after our first text are the customer talking too
    // (lib/customer-forms.ts); the first form is the lead itself.
    const firstOutAt = outbound.length ? outbound[0].at : null
    const forms = tps.filter((t) => (CUSTOMER_FORM_TYPES as readonly string[]).includes(t.touchpoint_type) && firstOutAt && t.occurred_at > firstOutAt)
    const lastForm = forms.length ? forms[forms.length - 1] : null
    const lastFormAt = lastForm?.occurred_at ?? null
    const lastCustomerAt = later(later(later(lastInAt, lastCallAt), lastFormAt), lastEmailInAt)

    // A reaction ("Liked …", 👍) is a gesture, not a reply (owner 2026-09-25):
    // it does not restart the 3-text count. A lead whose last word is a
    // reaction gets the follow-up ladder (below), so one who likes every text
    // would otherwise be followed up forever. A thanks does restart it: it is
    // a message, and we answer it.
    const reactionLast = isTapback(lastInBody) && lastInAt === lastCustomerAt
    const lastWordIn = [...inbound].reverse().find((m) => m.media > 0 || !isTapback(m.body))
    const countFrom = reactionLast ? later(later(later(later(lastWordIn?.at ?? null, realIn?.at ?? null), lastCallAt), lastFormAt), lastEmailInAt) : lastCustomerAt
    let run = outbound.filter((m) => !countFrom || m.at > countFrom).length
    // Compared straight, the carrier's stamp counted every desk / workbench text
    // twice: 603-714-3132 read "3 sent, cap reached" after 2 (10-04). Only a
    // text after the customer's last word is part of the run.
    if (tw?.lastOutAt && (!countFrom || Date.parse(tw.lastOutAt) > Date.parse(countFrom)) && (!dbLastOut || Date.parse(tw.lastOutAt) - Date.parse(dbLastOut) > TWILIO_LAG_MS)) run += 1

    const callbackNote = [...notes].reverse().find((n) => /^\s*\[callback\]/i.test(n.note)) ?? null
    const hint = hintFromRows([...tps].reverse().filter((t) => HINT_TYPES.includes(t.touchpoint_type)) as HintRow[])
    const eventDate = hint && /^\d{4}-\d{2}-\d{2}$/.test(hint.date) ? hint.date : null
    const daysToEvent = daysUntil(eventDate, now)

    const latestQuote = quotes.length ? quotes[quotes.length - 1] : null
    const latestShaped = shapedQuotes.length ? shapedQuotes[shapedQuotes.length - 1] : null
    const qp = latestQuote?.raw_payload_json ?? {}
    const computed = (qp.computed ?? {}) as Record<string, unknown>
    const quoted = latestQuote
      ? { total: num(computed.total), adults: num(qp.adults), kids: num(qp.kids), at: latestQuote.occurred_at, city: str(qp.cityName) || null }
      : null

    // ---- flags -------------------------------------------------------------
    const flags: string[] = []
    const name = (lead.full_name ?? "").trim()
    if (!name || /^unknown contact$/i.test(name) || /^\+?\d[\d\s()-]{6,}$/.test(name)) flags.push("name_unknown")
    if (DEFAULT_CITY.test((lead.city_or_zip ?? "").trim())) flags.push("city_default")
    if (quoted && quoted.city && num(qp.travelFee) === 0 && qp.travelPending !== true) {
      const t = getCityTravel(slug(quoted.city))
      if (t && t.fee > 0) flags.push(`travel_underquoted:$${t.fee}`)
    }
    if (phone && paidPhones.has(digits10(phone))) flags.push("has_paid_order")
    if (inbound.some((m) => TABLES_RE.test(m.body))) flags.push("tables_asked")
    if (inbound.some((m) => BUDGET_RE.test(m.body))) flags.push("budget_words")
    if (quoted && quoted.total === 599 && quoted.adults + quoted.kids <= 8) flags.push("at_minimum")
    if (shapedQuotes.length >= 2) {
      const heads = (t: TP) => num(t.raw_payload_json?.adults) + num(t.raw_payload_json?.kids)
      if (heads(shapedQuotes[shapedQuotes.length - 1]) < heads(shapedQuotes[0])) flags.push("headcount_down")
    }
    const objectionWords = flags.some((f) => f === "tables_asked" || f === "budget_words" || f === "at_minimum" || f === "headcount_down")

    // ---- the bucket ----------------------------------------------------------
    let bucket: Bucket
    let reason: string
    let nextActionAt: string | null = new Date(now).toISOString()
    const customerLast = Boolean(lastCustomerAt && (!lastOutAt || lastCustomerAt > lastOutAt))
    const lastIsCall = Boolean(lastCallAt && (!lastInAt || lastCallAt > lastInAt))
    const lastIsForm = Boolean(lastFormAt && lastFormAt === lastCustomerAt)
    const lastIsEmail = Boolean(lastEmailInAt && lastEmailInAt === lastCustomerAt)
    const lastInIsTapback = !lastIsCall && isTapback(lastInBody)
    const lastInIsCourtesy = !lastIsCall && !lastInIsTapback && courtesyOnly(lastInBody)
    // Two last words we do not answer: a reaction never (owner 2026-09-25), a
    // thanks once its 2-hour window has passed - the window only decides
    // whether the one-line close is still owed (leads §1.6). Neither is the
    // customer coming back, so the rest of the ladder reads the lead as if we
    // spoke last: a hold or a [callback] set before it still stands - both are
    // measured from the customer's last real message - and a follow-up keeps
    // the 20-hour spacing and the 3-text cap. Filed as stops instead (no next
    // action), 626-428-5292 went 25 days without a word after "I appreciate
    // it!" with a [callback] on file (five more with her, 2026-10-24), and
    // 805-455-1668 four weeks after liking our "take your time", her own
    // [callback] on file too (2026-10-25).
    const doneWith = customerLast && !lastIsForm && !lastIsEmail && (lastInIsTapback || (lastInIsCourtesy && now - Date.parse(lastInAt!) > COURTESY_WINDOW_MS))
    const spokeAt = doneWith ? later(later(later(realIn?.at ?? null, lastCallAt), lastFormAt), lastEmailInAt) : lastCustomerAt
    const hold = holdState(lead, spokeAt, now)
    const holdActive = hold === "active"
    if (doneWith && lastInIsTapback) flags.push("tapback_last")

    if (lead.sms_blocked_at) {
      bucket = "H"
      reason = "号码打不通，短信已停发（改邮件）"
      nextActionAt = null
    } else if (flags.includes("has_paid_order")) {
      bucket = "H"
      reason = "同号已有付押金订单，状态该是 won"
      nextActionAt = null
    } else if (!phone && !str(lead.email).trim()) {
      // A "Text us" tap leaves a placeholder lead that waits for the text; when
      // the text never comes there is no number and no email to answer. The
      // 10-05 one (92315, 12/28) sat in A "从没联系过" for four days (2026-10-09).
      bucket = "H"
      reason = "没留电话也没留邮箱，联系不上（点了发短信但没发出来）"
      nextActionAt = null
    } else if (!lastOutAt && !lastCustomerAt) {
      bucket = "A"
      reason = "从没联系过，走首条（T0）"
    } else if (customerLast && lastIsForm) {
      bucket = "A"
      reason = `客人在网站回了：${FORM_LABELS[lastForm!.touchpoint_type] ?? lastForm!.touchpoint_type} ${formSummary(lastForm!.touchpoint_type, lastForm!.raw_payload_json)}`.slice(0, 160)
    } else if (customerLast && lastIsEmail) {
      bucket = "A"
      reason = "客人发了邮件，欠回复（用邮件回）"
    } else if (customerLast && lastIsCall) {
      bucket = "A"
      reason = `来电 ${lastCallAt!.slice(0, 16)} 之后我们没再写过`
    } else if (customerLast && !doneWith && quiet.quiet(phone, Date.parse(lastInAt!)) && !lastInIsCourtesy) {
      // Not for a reaction or a thanks we are done with: the desk acks those
      // (leads §1.6), and "不用回" here is a stop with no next action.
      bucket = "H"
      reason = lead.acked_until && Date.parse(lead.acked_until) >= Date.parse(lastInAt!) ? "已标「不用回」" : "挂起中（客人自设节奏）"
      nextActionAt = lead.hold_until
    } else if (customerLast && !doneWith) {
      bucket = "A"
      reason = lastInIsCourtesy ? "客气话，回一句收尾" : "客人最后说话，欠回复"
    } else if (
      signals.some((s) => now - Date.parse(s.occurred_at) < SIGNAL_WINDOW_MS && (!lastManualOutAt || s.occurred_at > lastManualOutAt)) ||
      (shapedQuotes.length >= 2 && latestShaped && now - Date.parse(latestShaped.occurred_at) < SIGNAL_WINDOW_MS && (!lastManualOutAt || latestShaped.occurred_at > lastManualOutAt))
    ) {
      bucket = "C"
      const sig = [...signals].reverse().find((s) => !lastManualOutAt || s.occurred_at > lastManualOutAt)
      reason = sig ? `${sig.touchpoint_type} ${sig.occurred_at.slice(0, 16)}` : `重算了报价 ${latestShaped!.occurred_at.slice(0, 16)}（${num(latestShaped!.raw_payload_json?.adults)} 人 $${num(((latestShaped!.raw_payload_json?.computed ?? {}) as Record<string, unknown>).total)}）`
    } else if (!phone) {
      // Email only, and we spoke last: the ladder below is texts. A follow-up
      // email is a person's call, not a scan bucket.
      bucket = "H"
      reason = "只有邮箱，我们最后说话：等他回信（邮件跟进人工定）"
      nextActionAt = null
    } else if (holdActive) {
      bucket = "H"
      reason = `挂起到 ${lead.hold_until!.slice(0, 10)}${callbackNote ? "（客人自设节奏）" : ""}`
      nextActionAt = lead.hold_until
    } else if (callbackNote && (!spokeAt || spokeAt <= callbackNote.at)) {
      bucket = "B"
      reason = `承诺到期：${callbackNote.note.replace(/^\s*\[callback\]\s*/i, "").slice(0, 90)}`
    } else if (hold === "dormant") {
      // Our own hold ran out and they never spoke since: dormant, not due
      // (lib/lead-hold.ts holdState). Before E too - a party date getting close
      // is not news from them (f_deadline needs some). A revisit or a deposit
      // page open still lands in C above.
      bucket = "H"
      reason = `休眠：挂起 ${lead.hold_until!.slice(0, 10)} 到期，之后客人没说过话——不再主动发，他开口立即接`
      nextActionAt = null
    } else if (daysToEvent !== null && daysToEvent >= 0 && daysToEvent <= 7) {
      bucket = "E"
      reason = `派对 ${eventDate} 还有 ${daysToEvent} 天，没付押金${run >= CAP ? "（已满 3 条，要 force，先给老板看）" : ""}`
      if (run >= CAP) flags.push("cap_reached")
    } else if (run >= CAP) {
      bucket = "H"
      reason = `已连发 ${run} 条无回复，满 3 条封顶${lead.hold_until ? "" : "——还没挂起，挂 14 天"}`
      if (!lead.hold_until) flags.push("needs_hold")
      nextActionAt = lead.hold_until
    } else if (lastOutAt && now - Date.parse(lastOutAt) < FOLLOWUP_WAIT_MS) {
      bucket = "H"
      reason = `我们 ${lastOutAt.slice(0, 16)} 刚发过，第 2 天再看`
      nextActionAt = new Date(Date.parse(lastOutAt) + FOLLOWUP_WAIT_MS).toISOString()
    } else if (outbound.filter((m) => now - Date.parse(m.at) < DAY_MS).length >= 2) {
      // The send route refuses a third unprompted text inside 24 hours and the
      // instant quote counts, so a lead that got the quote and our first text
      // yesterday afternoon is not due until the quote ages out.
      const recent = outbound.filter((m) => now - Date.parse(m.at) < DAY_MS).map((m) => Date.parse(m.at)).sort((a, b) => a - b)
      bucket = "H"
      reason = "24 小时内已发 2 条（含自动报价），刹车会拦，等最早那条过 24 小时"
      nextActionAt = new Date(recent[0] + DAY_MS).toISOString()
    } else {
      bucket = "D"
      reason = `沉默 ${Math.floor((now - Date.parse(lastOutAt!)) / 3600_000)} 小时，第 ${run + 1} 条${run + 1 >= CAP ? "（最后一条）" : ""}到期${doneWith ? (lastInIsTapback ? "（客人最后只点了个赞，那个不回）" : "（客人最后回的是客气话，那句不补）") : ""}`
    }
    const objection = (bucket === "D" || bucket === "E") && objectionWords

    items.push({
      leadId: lead.id,
      name: name || phone || lead.id.slice(0, 8),
      phone,
      email: lead.email,
      city: lead.city_or_zip,
      guests: lead.guest_count,
      status: lead.status,
      createdAt: lead.created_at,
      bucket,
      objection,
      flags,
      reason,
      lastSpeaker: lastCustomerAt && (!lastOutAt || lastCustomerAt > lastOutAt) ? "customer" : lastOutAt ? "us" : null,
      lastAt: later(lastCustomerAt, lastOutAt),
      run,
      holdUntil: lead.hold_until,
      callback: callbackNote ? callbackNote.note.slice(0, 160) : null,
      eventDate,
      daysToEvent,
      quoted,
      nextActionAt,
    })
  }

  // ---- G: paid, party soon, something missing ------------------------------
  // What the scan sees on the row (address, menu, time), then what the invoice
  // app's order lint says the customer is owed and the order does not carry
  // (D-1017-02: a free appetizer owed by rule, a deal item not on the party,
  // travel never measured...). Blocking items read "!!".
  const orderGaps: OrderGap[] = []
  const lints = opts.lint === false ? new Map<string, OrderLint>() : await fetchOrderLints(orders.map((o) => o.id))
  for (const o of orders) {
    const inv = o.invoice_data ?? {}
    const guests = Array.isArray(inv.guests) ? (inv.guests as unknown[]) : []
    const quick = Array.isArray(inv.quickCountItems) ? (inv.quickCountItems as Array<Record<string, unknown>>) : []
    const hasMenu = guests.length > 0 || quick.some((q) => q.category === "protein" && num(q.qty) > 0)
    const address = (o.event_address ?? "").trim()
    const addressOk = address.length >= 8 && /\d/.test(address) && !/^\d{5}$/.test(address)
    const meta = o.source_metadata ?? {}
    const base: string[] = []
    if (!addressOk) base.push(address ? `地址只有 "${address}"` : "没有地址")
    if (!hasMenu) base.push("菜单空")
    if (meta.event_time_tbd === true) base.push("时间待定")
    const gaps = gapsWithLint(base, lints?.get(o.id))
    if (!gaps.length) continue
    const eventDay = o.event_start ? o.event_start.slice(0, 10) : null
    orderGaps.push({
      orderId: o.id,
      orderNo: o.order_no,
      name: o.customer_name,
      phone: toE164(o.customer_phone),
      leadId: str(meta.lead_id) || null,
      eventStart: o.event_start,
      daysToEvent: daysUntil(eventDay, now),
      gaps,
    })
  }

  const order: Bucket[] = ["A", "C", "B", "E", "D", "H", "G"]
  items.sort((a, b) => order.indexOf(a.bucket) - order.indexOf(b.bucket) || (a.daysToEvent ?? 9999) - (b.daysToEvent ?? 9999) || (a.lastAt ?? "").localeCompare(b.lastAt ?? ""))
  const summary = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: orderGaps.length, H: 0 } as Record<Bucket | "F", number>
  for (const it of items) {
    summary[it.bucket] += 1
    if (it.objection) summary.F += 1
  }

  if (opts.write) {
    // The three columns the lead list already has and nothing ever wrote.
    await Promise.all(
      items.map((it) =>
        supabase
          .from("leads")
          .update({ segment: it.bucket + (it.objection ? "F" : ""), next_action_at: it.nextActionAt, updated_at: new Date(now).toISOString() })
          .eq("id", it.leadId),
      ),
    )
  }

  return {
    serverTime: new Date(now).toISOString(),
    pool: leads.length,
    summary,
    items,
    orders: orderGaps,
    // false: the invoice app's order lint did not answer, so G shows only what the scan sees itself
    ...(lints === null && orders.length > 0 ? { orderLint: false } : {}),
  }
}
