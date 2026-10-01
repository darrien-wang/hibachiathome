import type { SupabaseClient } from "@supabase/supabase-js"
import { courtesyOnly, isTapback } from "@/lib/courtesy-text"
import { HINT_TYPES, hintFromRows, type HintRow } from "@/lib/lead-event-hint"
import { loadQuiet } from "@/lib/lead-hold"
import { fetchLastByPeer, toE164 } from "@/lib/sms-thread"
import { getCityTravel } from "@/config/city-travel"

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

const SCAN_TYPES = Array.from(
  new Set([
    ...HINT_TYPES,
    "sms_outbound",
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

export async function scanLeads(supabase: SupabaseClient, now = Date.now(), opts: { write?: boolean } = {}): Promise<ScanResult> {
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
    fetchLastByPeer(1000, 0).catch(() => new Map<string, { lastInAt: string | null; lastOutAt: string | null; last: { at: string; direction: "inbound" | "outbound"; body: string } }>()),
    fetchAll<OrderRow>((from, to) =>
      supabase
        .from("orders")
        .select("id, order_no, customer_name, customer_phone, event_start, event_address, invoice_data, source_metadata")
        .eq("deposit_status", "paid_verified")
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
  // its status says.
  const paidPhones = new Set<string>()
  const { data: paidAll } = await supabase.from("orders").select("customer_phone").eq("deposit_status", "paid_verified").gte("created_at", since)
  for (const o of (paidAll ?? []) as Array<{ customer_phone: string | null }>) {
    const d = digits10(o.customer_phone)
    if (d) paidPhones.add(d)
  }

  const items: ScanItem[] = []
  for (const lead of leads) {
    const tps = byLead.get(lead.id) ?? []
    const phone = toE164(lead.phone)
    const inbound = tps.filter((t) => t.touchpoint_type === "sms_inbound").map((t) => ({ at: t.occurred_at, body: str(t.raw_payload_json?.Body ?? t.raw_payload_json?.body) }))
    const outbound = tps.filter((t) => t.touchpoint_type === "sms_outbound").map((t) => ({ at: t.occurred_at, body: str(t.raw_payload_json?.body ?? t.raw_payload_json?.Body) }))
    const calls = tps.filter((t) => t.touchpoint_type === "call_inbound").map((t) => t.occurred_at)
    const notes = tps.filter((t) => t.touchpoint_type === "agent_note").map((t) => ({ at: t.occurred_at, note: str(t.raw_payload_json?.note) }))
    const quotes = tps.filter((t) => t.touchpoint_type === "landing_quote_text")
    const signals = tps.filter((t) => SIGNAL_TYPES.has(t.touchpoint_type))

    // Twilio is the truth for who spoke last; the timeline can lag a text sent
    // from the phone app.
    const tw = phone ? byPeer.get(phone) : undefined
    let lastInAt = later(inbound.length ? inbound[inbound.length - 1].at : null, tw?.lastInAt ?? null)
    let lastInBody = inbound.length ? inbound[inbound.length - 1].body : ""
    if (tw?.last.direction === "inbound" && tw.lastInAt && (!inbound.length || tw.lastInAt > inbound[inbound.length - 1].at)) lastInBody = tw.last.body
    const dbLastOut = outbound.length ? outbound[outbound.length - 1].at : null
    const lastOutAt = later(dbLastOut, tw?.lastOutAt ?? null)
    const manualOut = outbound.filter((m) => !AUTOMATED.test(m.body))
    const lastManualOutAt = manualOut.length ? manualOut[manualOut.length - 1].at : null
    const lastCallAt = calls.length ? calls[calls.length - 1] : null
    const lastCustomerAt = later(lastInAt, lastCallAt)

    let run = outbound.filter((m) => !lastInAt || m.at > lastInAt).length
    if (tw?.lastOutAt && (!dbLastOut || tw.lastOutAt > dbLastOut)) run += 1

    const holdActive = Boolean(lead.hold_until && Date.parse(lead.hold_until) > now && !(lastCustomerAt && lead.hold_set_at && lastCustomerAt > lead.hold_set_at))
    const callbackNote = [...notes].reverse().find((n) => /^\s*\[callback\]/i.test(n.note)) ?? null
    const hint = hintFromRows([...tps].reverse().filter((t) => HINT_TYPES.includes(t.touchpoint_type)) as HintRow[])
    const eventDate = hint && /^\d{4}-\d{2}-\d{2}$/.test(hint.date) ? hint.date : null
    const daysToEvent = daysUntil(eventDate, now)

    const latestQuote = quotes.length ? quotes[quotes.length - 1] : null
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
    if (quotes.length >= 2) {
      const first = num(quotes[0].raw_payload_json?.adults) + num(quotes[0].raw_payload_json?.kids)
      const last = quoted ? quoted.adults + quoted.kids : first
      if (last < first) flags.push("headcount_down")
    }
    const objectionWords = flags.some((f) => f === "tables_asked" || f === "budget_words" || f === "at_minimum" || f === "headcount_down")

    // ---- the bucket ----------------------------------------------------------
    let bucket: Bucket
    let reason: string
    let nextActionAt: string | null = new Date(now).toISOString()
    const customerLast = Boolean(lastCustomerAt && (!lastOutAt || lastCustomerAt > lastOutAt))
    const lastIsCall = Boolean(lastCallAt && (!lastInAt || lastCallAt > lastInAt))
    const lastInIsTapback = !lastIsCall && isTapback(lastInBody)
    const lastInIsCourtesy = !lastIsCall && !lastInIsTapback && courtesyOnly(lastInBody)

    if (lead.sms_blocked_at) {
      bucket = "H"
      reason = "号码打不通，短信已停发（改邮件）"
      nextActionAt = null
    } else if (flags.includes("has_paid_order")) {
      bucket = "H"
      reason = "同号已有付押金订单，状态该是 won"
      nextActionAt = null
    } else if (!lastOutAt && !lastCustomerAt) {
      bucket = "A"
      reason = "从没联系过，走首条（T0）"
    } else if (customerLast && lastInIsTapback) {
      bucket = "H"
      reason = "最后一条是点赞，不用回"
      nextActionAt = null
      flags.push("tapback_last")
    } else if (customerLast && lastIsCall) {
      bucket = "A"
      reason = `来电 ${lastCallAt!.slice(0, 16)} 之后我们没再写过`
    } else if (customerLast && lastInIsCourtesy && now - Date.parse(lastInAt!) > COURTESY_WINDOW_MS) {
      bucket = "H"
      reason = "最后一条是客气话，已过 2 小时，不再补"
      nextActionAt = null
    } else if (customerLast && quiet.quiet(phone, Date.parse(lastInAt!)) && !lastInIsCourtesy) {
      bucket = "H"
      reason = lead.acked_until && Date.parse(lead.acked_until) >= Date.parse(lastInAt!) ? "已标「不用回」" : "挂起中（客人自设节奏）"
      nextActionAt = lead.hold_until
    } else if (customerLast) {
      bucket = "A"
      reason = lastInIsCourtesy ? "客气话，回一句收尾" : "客人最后说话，欠回复"
    } else if (
      signals.some((s) => now - Date.parse(s.occurred_at) < SIGNAL_WINDOW_MS && (!lastManualOutAt || s.occurred_at > lastManualOutAt)) ||
      (quotes.length >= 2 && latestQuote && now - Date.parse(latestQuote.occurred_at) < SIGNAL_WINDOW_MS && (!lastManualOutAt || latestQuote.occurred_at > lastManualOutAt))
    ) {
      bucket = "C"
      const sig = [...signals].reverse().find((s) => !lastManualOutAt || s.occurred_at > lastManualOutAt)
      reason = sig ? `${sig.touchpoint_type} ${sig.occurred_at.slice(0, 16)}` : `重算了报价 ${latestQuote!.occurred_at.slice(0, 16)}（${quoted?.adults ?? "?"} 人 $${quoted?.total ?? "?"}）`
    } else if (holdActive) {
      bucket = "H"
      reason = `挂起到 ${lead.hold_until!.slice(0, 10)}${callbackNote ? "（客人自设节奏）" : ""}`
      nextActionAt = lead.hold_until
    } else if (callbackNote && (!lastCustomerAt || lastCustomerAt <= callbackNote.at)) {
      bucket = "B"
      reason = `承诺到期：${callbackNote.note.replace(/^\s*\[callback\]\s*/i, "").slice(0, 90)}`
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
    } else {
      bucket = "D"
      reason = `沉默 ${Math.floor((now - Date.parse(lastOutAt!)) / 3600_000)} 小时，第 ${run + 1} 条${run + 1 >= CAP ? "（最后一条）" : ""}到期`
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
  const orderGaps: OrderGap[] = []
  for (const o of orders) {
    const inv = o.invoice_data ?? {}
    const guests = Array.isArray(inv.guests) ? (inv.guests as unknown[]) : []
    const quick = Array.isArray(inv.quickCountItems) ? (inv.quickCountItems as Array<Record<string, unknown>>) : []
    const hasMenu = guests.length > 0 || quick.some((q) => q.category === "protein" && num(q.qty) > 0)
    const address = (o.event_address ?? "").trim()
    const addressOk = address.length >= 8 && /\d/.test(address) && !/^\d{5}$/.test(address)
    const meta = o.source_metadata ?? {}
    const gaps: string[] = []
    if (!addressOk) gaps.push(address ? `地址只有 "${address}"` : "没有地址")
    if (!hasMenu) gaps.push("菜单空")
    if (meta.event_time_tbd === true) gaps.push("时间待定")
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

  return { serverTime: new Date(now).toISOString(), pool: leads.length, summary, items, orders: orderGaps }
}
