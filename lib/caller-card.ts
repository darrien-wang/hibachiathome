// 来电卡片 (owner 2026-10-10).
//
// 10-10 11:15 April (35 boys, Mon 10/12, quoted $1,337.40, mid-negotiation) called the 213 line.
// The owner picked up in the workbench App, which showed only her number, asked her whether she had
// paid a deposit and re-checked a date we had already texted her about - and we apologized by text
// afterwards. Now the ring itself says who is calling, and the App and the web softphone show it on
// the incoming and in-call screens:
//
//   April Costigan
//   35人 · 10月12日 周一 · 报价 $1,225 · 还没锁单
//
// The first cut said this in the answering agent's ear before the bridge (<Client url>); a caller
// waiting through those six seconds was too long (owner, same day). The card now travels as a
// <Parameter> on each App leg of the inbound <Dial> (app/api/twilio/voice, lib/caller-card-param.ts),
// looked up while the call's lead is written. The backup <Number> is a plain phone and gets none. A
// number we know nothing about - its lead is only this call - gets no card.
//
// Every part is optional:
//   name   the order's, the lead's, a past order's, or the one we greeted them by in a text
//          ("Hi April, ..." - April's lead is still named by her number)
//   heads  the order's adults + kids, else the lead's guest count
//   date   the order's event_start and its time (wall time stored as UTC: read, never converted),
//          else the party date the workbench derives (lib/lead-event-hint.ts)
//   price  the order's total, else the newest price the customer was shown for that party size -
//          by our texts, or by the site's estimator. Not the deposit link's estimate: April's last
//          link still says $1,802 (the deal's catalog base) while the text that carried it says $1,225.
//   lock   已锁单 when a paid deposit holds the party, 还没锁单 otherwise
// A party that has gone by is history, not news: its date and any price from before it are left
// out, and a number we have done a party for is a 老客人.

import type { SupabaseClient } from "@supabase/supabase-js"
import { CALLER_CARD_PARAM, encodeCallerCard, type CallerCard } from "@/lib/caller-card-param"
import { HINT_TYPES, hintFromRows } from "@/lib/lead-event-hint"
import { isDefaultLeaveQuote } from "@/lib/lead-scan"
import { isPlaceholderName } from "@/lib/leads"
import { toE164 } from "@/lib/sms-thread"
import { escapeXml } from "@/lib/twilio-identity"
import { channelLabel } from "@/lib/channels"

export type CallerFacts = {
  /** The name as we have it, "" when we have none. */
  name: string
  heads: number | null
  /** The party's wall date, YYYY-MM-DD. */
  date: string | null
  /** A booked party's wall-clock start, HH:MM. */
  time: string | null
  /** A booked party with no date yet. */
  dateTbd: boolean
  /** Dollars. */
  price: number | null
  /** A paid deposit holds the party. */
  locked: boolean
  /** The facts are a booked order's (总价), not a lead's quote (报价). */
  order: boolean
  /** We have already done a party for this number. */
  returning: boolean
  /** The customer's newest text to us, for the second line of the card; null when they never texted. */
  lastText: { body: string; at: string } | null
  /** The lead's attributed channel (lead_attribution.channel), e.g. google_ads; null when unknown. */
  channel: string | null
}

const PT = "America/Los_Angeles"
const WEEKDAYS = "日一二三四五六"
const MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
// order_status values that mean the party is off (as lib/deposit-lock.ts)
const CLOSED_STATUSES = new Set(["cancelled", "canceled", "refunded", "void", "voided", "closed"])

// ---- the card --------------------------------------------------------------------------------

function ymd(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10)
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number)
  return ymd(y, m, d + days)
}

/** Today's date in Pacific time, YYYY-MM-DD. */
export function pacificDate(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: PT, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms))
}

/** 今天 / 明天 / 10月12日 周一 for a wall date. */
export function cardDate(date: string, today: string): string {
  if (date === today) return "今天"
  if (date === addDays(today, 1)) return "明天"
  const [y, m, d] = date.split("-").map(Number)
  return `${m}月${d}日 周${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}`
}

/** $1,225 / $1,337.40 - cents only when it was quoted with cents. */
export function money(n: number): string {
  const cents = Math.round(n * 100) % 100 !== 0
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 })}`
}

/** "April Costigan"; "" for a stand-in ("+16262220069", "Guest"). */
export function displayName(raw: string | null | undefined): string {
  const name = (raw ?? "").trim().replace(/\s+/g, " ")
  return isPlaceholderName(name) || /^(sms lead|caller)$/i.test(name) ? "" : name.slice(0, 40)
}

/** What the ring screen shows under the number, or null when we know nothing about the caller. */
export function callerCard(f: CallerFacts, today: string): CallerCard | null {
  const heads = f.heads && f.heads > 0 ? f.heads : null
  const price = f.price && f.price >= 1 ? f.price : null
  if (!f.name && !heads && !f.date && !f.dateTbd && !price && !f.locked && !f.returning) return null
  const parts: string[] = []
  if (f.returning) parts.push("老客人")
  if (heads) parts.push(`${heads}人`)
  if (f.date) parts.push(f.time ? `${cardDate(f.date, today)} ${f.time}` : cardDate(f.date, today))
  else if (f.dateTbd) parts.push("日期待定")
  if (price) parts.push(`${f.order ? "总价" : "报价"} ${money(price)}`)
  parts.push(f.locked ? "已锁单" : "还没锁单")
  return { name: f.name, line: parts.join(" · ") }
}

/** 今天 / 昨天 / 10月12日 for the day a text arrived. */
export function textDate(date: string, today: string): string {
  if (date === today) return "今天"
  if (date === addDays(today, -1)) return "昨天"
  const [, m, d] = date.split("-").map(Number)
  return `${m}月${d}日`
}

/**
 * The card's second line (owner 2026-10-20: "电话打过来我不知道什么情况"): what the customer last
 * texted us and where the lead came from - "昨天短信：Can we do Nov 6 at 7? · Google Ads".
 * A caller who never texted reads "还没回过短信". "" when we know neither.
 */
export function callerCardLine2(f: CallerFacts, today: string): string {
  const parts: string[] = []
  if (f.lastText) {
    const body = f.lastText.body.replace(/\s+/g, " ").trim()
    const snippet = body.length > 48 ? `${body.slice(0, 47)}…` : body
    parts.push(`${textDate(f.lastText.at.slice(0, 10), today)}短信：${snippet || "[图片]"}`)
  } else if (f.name || f.heads || f.date || f.channel) {
    parts.push("还没回过短信")
  }
  if (f.channel) parts.push(channelLabel(f.channel))
  return parts.join(" · ")
}

/** Both lines for the ring screen; a number we know nothing about is told so ("新号码 · 无记录"). */
export function callerCardFull(f: CallerFacts, today: string): CallerCard {
  const first = callerCard(f, today)
  const second = callerCardLine2(f, today)
  if (!first && !second) return { name: "", line: "新号码 · 无记录" }
  return { name: first?.name ?? "", line: [first?.line, second].filter(Boolean).join("\n") }
}

// ---- reading what we told them -------------------------------------------------------------------

const MONEY = /\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/g
/** A party's price is never below the $599 minimum; under this it is a rate, a fee or a discount. */
const PRICE_FLOOR = 300

/**
 * The party's price in one of our texts, or null. Rules read off the 10-01..10-10 workbench texts:
 * the amount by "Total" wins (an itemized quote opens with the food subtotal), then "$X all in",
 * then the last "= $X", then "it's / comes to / brings it to $X", then the first amount left.
 * Never the price it replaced ("instead of", "down from", "was") or a balance.
 */
export function priceInText(body: string | null | undefined): number | null {
  const text = body ?? ""
  const found: Array<{ value: number; before: string; after: string }> = []
  for (const m of text.matchAll(MONEY)) {
    const value = Number(m[1].replace(/,/g, "")) + (m[2] ? Number(m[2].padEnd(2, "0")) / 100 : 0)
    if (value < PRICE_FLOOR) continue
    const start = m.index ?? 0
    const end = start + m[0].length
    found.push({ value, before: text.slice(Math.max(0, start - 24), start), after: text.slice(end, end + 24) })
  }
  const live = found.filter(
    (a) =>
      !/(instead of|\bfrom|\bwas|\bbalance\b(?: is| of| due)?:?)\s*(?:the\s*)?$/i.test(a.before) &&
      !/^\s*(?:after (?:your|the) deposit|balance\b|on the day\b)/i.test(a.after),
  )
  const pick = (test: (a: (typeof live)[number]) => boolean, last = false) => {
    const hits = live.filter(test)
    return hits.length ? hits[last ? hits.length - 1 : 0].value : null
  }
  return (
    pick((a) => /\btotal\b[^$\n]{0,20}$/i.test(a.before), true) ??
    pick((a) => /^[^$\n.]{0,20}\btotal\b/i.test(a.after)) ??
    pick((a) => /^\s*(?:[a-z]+\s+){0,2}all[\s-]in\b/i.test(a.after)) ??
    pick((a) => /=\s*$/.test(a.before), true) ??
    pick((a) => /(?:comes to|brings it to|brings you to|puts (?:it|you) at|price is|that's|it's|is now|would be|will be)\s*$/i.test(a.before)) ??
    (live.length ? live[0].value : null)
  )
}

const COUNTED = /\b(\d{1,3})\s+(?:adults?|guests?|people|boys|girls)\b(?:\s*(?:and|\+|&|,|plus)\s*(\d{1,2}|an?|one)\s+(?:kids?|child(?:ren)?)\b)?/i
const FOR_N =
  /\bfor\s+(?:all\s+|your\s+)?(\d{1,3})\b(?![/:.,%-]?\d)(?!\+)(?!\s*(?:hours?|hrs?|min(?:ute)?s?|am|pm|days?|weeks?|miles?|mi|chefs?|trays?|proteins?|tables?|chairs?)\b)/i

/** The party size a text prices: "25 adults + 3 kids" -> 28, "for all 35" -> 35; null when it names none. */
export function statedHeadcount(body: string | null | undefined): number | null {
  const text = body ?? ""
  const counted = COUNTED.exec(text)
  if (counted) return Number(counted[1]) + (counted[2] ? (/^\d+$/.test(counted[2]) ? Number(counted[2]) : 1) : 0)
  const forN = FOR_N.exec(text)
  return forN ? Number(forN[1]) : null
}

// Case-sensitive on purpose: a name is capitalized, "Hi there" is not.
const GREETING = /^\s*(?:[Hh]i|[Hh]ey|[Hh]ello)\s+([A-Z][A-Za-z'’-]{1,24})(?:\s+[A-Z][A-Za-z'’-]{1,24})?\s*[,!.:;–—-]/
const NOT_A_NAME = /^(there|all|everyone|team|folks|guys|again|mr|mrs|ms|miss|dr)$/i

/** The name we greeted them by: "Hi April, it's Bling - ..." -> "April". */
export function greetedName(body: string | null | undefined): string {
  const m = GREETING.exec(body ?? "")
  return m && !NOT_A_NAME.test(m[1]) ? m[1] : ""
}

function validDate(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number)
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && ymd(y, m, d) === iso
}

/**
 * A timeline date hint as YYYY-MM-DD. A note's "10/12" or "Oct 12" has no year: it is the first
 * such day on or after the week before the note was written, so "1/9" noted on 10-08 is next
 * January and a "10/3" noted on 10-09 is the party that just went by.
 */
export function partyDateFromHint(hint: string, writtenAt: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(hint)) return validDate(hint) ? hint : null
  const named = /^([a-z]+)\.?\s+(\d{1,2})/i.exec(hint)
  const slashed = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(hint)
  let year = 0
  let month = 0
  let day = 0
  if (named) {
    // The hint's pattern takes any word that starts like a month: "OWNER DECISION 09-28" in a note
    // came back as "DECISION 09". Only a month itself is one, and "may 5" is the verb.
    const word = named[1].toLowerCase()
    const index = MONTH_NAMES.findIndex((full) => word === full || word === full.slice(0, 3) || (word === "sept" && full === "september"))
    month = named[1] === "may" ? 0 : index + 1
    day = Number(named[2])
  } else if (slashed) {
    month = Number(slashed[1])
    day = Number(slashed[2])
    if (slashed[3]) year = Number(slashed[3].length === 2 ? `20${slashed[3]}` : slashed[3])
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  if (!year) {
    const from = addDays(writtenAt.slice(0, 10), -7)
    year = Number(from.slice(0, 4))
    if (ymd(year, month, day) < from) year += 1
  }
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  return validDate(iso) ? iso : null
}

// ---- the lookup -------------------------------------------------------------------------------

type LeadRow = {
  id: string
  full_name: string | null
  guest_count: number | null
  adult_count: number | null
  child_count: number | null
  little_count: number | null
}
type OrderRow = {
  customer_name: string | null
  source_metadata: Record<string, unknown> | null
  customer_phone: string | null
  event_start: string | null
  order_status: string | null
  deposit_status: string | null
  quoted_total_cents: number | null
  guest_adult_count: number | null
  guest_child_count: number | null
}
export type TimelineRow = { touchpoint_type: string; occurred_at: string; raw_payload_json: Record<string, unknown> | null }
/** A price the customer was shown, with the party size it was for when the text says. */
export type ShownPrice = { value: number; at: string; heads: number | null }

const LOOKUP_TYPES = Array.from(new Set([...HINT_TYPES, "sms_outbound", "sms_inbound"]))
const digits10 = (phone: string | null | undefined) => String(phone ?? "").replace(/\D/g, "").slice(-10)
const str = (v: unknown) => (typeof v === "string" ? v : "")

/**
 * What a lead's timeline (newest first) has told us: the name we greeted them by, the party date
 * the workbench shows, and every price they were shown - in our texts, or by the site's estimator
 * with a party they shaped (an untouched default "leave" quote is not one) - newest first.
 */
export function readTimeline(rows: TimelineRow[]): { greeted: string; date: string | null; shown: ShownPrice[] } {
  let greeted = ""
  let date: string | null = null
  const shown: ShownPrice[] = []
  for (const row of rows) {
    const p = row.raw_payload_json ?? {}
    if (row.touchpoint_type === "sms_outbound") {
      const body = str(p.body) || str(p.Body)
      const value = priceInText(body)
      if (value) shown.push({ value, at: row.occurred_at, heads: statedHeadcount(body) })
      if (!greeted) greeted = greetedName(body)
    }
    if (row.touchpoint_type === "landing_quote_text" && !isDefaultLeaveQuote(p)) {
      const total = Number((p.computed as Record<string, unknown> | undefined)?.total)
      const heads = (Number(p.adults) || 0) + (Number(p.kids) || 0)
      if (Number.isFinite(total) && total > 0) shown.push({ value: total, at: row.occurred_at, heads: heads > 0 ? heads : null })
    }
    if (!date && HINT_TYPES.includes(row.touchpoint_type)) {
      const hint = hintFromRows([row])
      if (hint) date = partyDateFromHint(hint.date, row.occurred_at)
    }
  }
  return { greeted, date, shown }
}

/**
 * The newest price for the party we are about to describe. A price we gave for a quite different
 * headcount is passed over - 912-944-5781 is 30 for 10/17, and our newest priced text was "Saw you
 * ran it for 15 - that's $838.50 all in ... Is it closer to 15 or 30?" - unless nothing matches.
 */
export function pickPrice(shown: ShownPrice[], heads: number | null): ShownPrice | null {
  const near = (n: number) => heads === null || Math.abs(n - heads) <= Math.max(2, Math.round(heads * 0.2))
  return shown.find((s) => s.heads === null || near(s.heads)) ?? shown[0] ?? null
}

/** What we know about whoever is calling from `phone` (E.164). Throws on a lookup error. */
export async function loadCallerFacts(supabase: SupabaseClient, phone: string, now = Date.now()): Promise<CallerFacts> {
  const d10 = digits10(phone)
  const today = pacificDate(now)
  const [leadRes, orderRes] = await Promise.all([
    // The lead the desk and the missed-call text read: newest, not merged away.
    supabase
      .from("leads")
      .select("id, full_name, guest_count, adult_count, child_count, little_count")
      .eq("normalized_phone", d10)
      .is("merged_into", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("orders")
      .select("customer_name, customer_phone, source_metadata, event_start, order_status, deposit_status, quoted_total_cents, guest_adult_count, guest_child_count")
      .ilike("customer_phone", `%${d10}%`)
      .order("created_at", { ascending: false })
      .limit(10),
  ])
  if (leadRes.error) throw new Error(`lead lookup: ${leadRes.error.message}`)
  if (orderRes.error) throw new Error(`order lookup: ${orderRes.error.message}`)
  const lead = leadRes.data as LeadRow | null
  const orders = ((orderRes.data ?? []) as OrderRow[]).filter(
    (o) => digits10(o.customer_phone) === d10 && !CLOSED_STATUSES.has(str(o.order_status).toLowerCase()),
  )

  let rows: TimelineRow[] = []
  let channel: string | null = null
  if (lead) {
    const [tl, attribution] = await Promise.all([
      supabase
        .from("lead_touchpoints")
        .select("touchpoint_type, occurred_at, raw_payload_json")
        .eq("lead_id", lead.id)
        .in("touchpoint_type", LOOKUP_TYPES)
        .order("occurred_at", { ascending: false })
        .limit(200),
      // Where the lead came from, as the scorecard classifies it (rh_resolve_channel).
      supabase.from("lead_attribution").select("channel").eq("id", lead.id).maybeSingle(),
    ])
    if (tl.error) throw new Error(`timeline lookup: ${tl.error.message}`)
    rows = (tl.data ?? []) as TimelineRow[]
    const resolved = (attribution.data as { channel: string | null } | null)?.channel ?? null
    channel = resolved && resolved !== "unresolved" ? resolved : null
  }
  const timeline = readTimeline(rows)
  const lastIn = rows.find((r) => r.touchpoint_type === "sms_inbound")
  const lastText = lastIn ? { body: str(lastIn.raw_payload_json?.Body) || str(lastIn.raw_payload_json?.body), at: lastIn.occurred_at } : null

  // event_start is the party's wall-clock time stored as UTC: the date and the time are read off it.
  const dayOf = (o: OrderRow) => str(o.event_start).slice(0, 10)
  const live =
    orders.filter((o) => !o.event_start || dayOf(o) >= today).sort((a, b) => (dayOf(a) || "9999").localeCompare(dayOf(b) || "9999"))[0] ?? null
  const past = orders.filter((o) => o.event_start && dayOf(o) < today)
  const returning = past.some((o) => o.deposit_status === "paid_verified")

  const name = [live?.customer_name, lead?.full_name, past[0]?.customer_name, timeline.greeted].map(displayName).find(Boolean) ?? ""
  const split = (lead?.adult_count ?? 0) + (lead?.child_count ?? 0) + (lead?.little_count ?? 0)
  const leadHeads = lead?.guest_count && lead.guest_count > 0 ? lead.guest_count : split > 0 ? split : null

  if (live) {
    const orderHeads = (live.guest_adult_count ?? 0) + (live.guest_child_count ?? 0)
    const heads = orderHeads > 0 ? orderHeads : leadHeads
    const cents = live.quoted_total_cents ?? 0
    const time = str(live.event_start).slice(11, 16)
    return {
      name,
      heads,
      date: live.event_start ? dayOf(live) : null,
      time: /^\d\d:\d\d$/.test(time) && live.source_metadata?.event_time_tbd !== true ? time : null,
      dateTbd: !live.event_start,
      // Some orders carry no total yet (the invoice was never saved): the price we texted stands.
      price: cents > 0 ? cents / 100 : (pickPrice(timeline.shown, heads)?.value ?? null),
      locked: live.deposit_status === "paid_verified",
      order: true,
      returning,
      lastText,
      channel,
    }
  }

  // A party date that has gone by - the lead's, or the last one we did for them - is not a party
  // to talk about, and neither is a price given before it.
  const quote = pickPrice(timeline.shown, leadHeads)
  const date = timeline.date && timeline.date >= today ? timeline.date : null
  const gone = [...past.map(dayOf), ...(timeline.date && !date ? [timeline.date] : [])].sort()
  const lastGone = gone[gone.length - 1] ?? null
  const price = quote && !(lastGone && quote.at.slice(0, 10) <= lastGone) ? quote.value : null
  return { name, heads: leadHeads, date, time: null, dateTbd: false, price, locked: false, order: false, returning, lastText, channel }
}

/**
 * The card for a call from `from`, or null - an unknown number, a lookup error, or a lookup slower
 * than `budgetMs`: the caller is waiting on this TwiML, so the call rings without a card rather
 * than late. Never throws.
 */
export async function callerCardFor(
  supabase: SupabaseClient,
  from: string | null | undefined,
  budgetMs = 1500,
  now = Date.now(),
): Promise<CallerCard | null> {
  const phone = toE164(from)
  if (!phone) return null
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const facts = await Promise.race([
      loadCallerFacts(supabase, phone, now),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`lookup over ${budgetMs} ms`)), budgetMs)
      }),
    ])
    const card = callerCardFull(facts, pacificDate(now))
    console.log("[caller-card]", { caller: `…${phone.slice(-4)}`, card, ms: Date.now() - now })
    return card
  } catch (error) {
    console.error("[caller-card] ringing without a card", { caller: `…${phone.slice(-4)}`, error: String(error) })
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** One softphone leg of the inbound <Dial>: the identity, and the caller card when there is one. */
export function clientLeg(identity: string, card: CallerCard | null): string {
  const param = card ? `<Parameter name="${CALLER_CARD_PARAM}" value="${escapeXml(encodeCallerCard(card))}"/>` : ""
  return `<Client><Identity>${escapeXml(identity)}</Identity>${param}</Client>`
}
