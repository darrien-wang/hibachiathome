// 来电耳语 (owner 2026-10-10).
//
// 10-10 11:15 April (35 boys, Mon 10/12, quoted $1,337.40, mid-negotiation) called the 213 line.
// The owner picked up in the workbench App, which shows only the number, asked her whether she had
// paid a deposit and re-checked a date we had already texted her about - and we apologized by text
// afterwards. Now whoever answers a call from a number we know hears one Mandarin sentence before
// the caller is put through:
//
//   "April，三十五人，周一十月十二号，报价一千二百二十五，还没锁单"
//
// It rides on <Client url> / <Number url> (app/api/twilio/voice, voice-status): Twilio plays the
// url's TwiML to the answering leg only, then bridges. The caller hears ringing for those seconds;
// their recording notice already played before the <Dial>. A number we know nothing about - its
// lead is only this call - gets nothing. TwiML: app/api/twilio/voice-whisper/route.ts.
//
// Every part is optional:
//   name   the order's, the lead's, a past order's, or the one we greeted them by in a text
//          ("Hi April, ..." - April's lead is still named by her number); else 尾号 (spokenName)
//   heads  the order's adults + kids, else the lead's guest count
//   date   the order's event_start (wall time stored as UTC: read, never converted), else the party
//          date the workbench derives (lib/lead-event-hint.ts)
//   price  the order's total, else the newest price the customer was shown for that party size -
//          by our texts, or by the site's estimator. Not the deposit link's estimate: April's last
//          link still says $1,802 (the deal's catalog base) while the text that carried it says $1,225.
//   lock   已锁单 when a paid deposit holds the party, 还没锁单 otherwise
// A party that has gone by is history, not news: its date and any price from before it are left
// out, and a number we have done a party for is a 老客人.

import type { SupabaseClient } from "@supabase/supabase-js"
import { spokenName } from "@/lib/callback-ring"
import { HINT_TYPES, hintFromRows } from "@/lib/lead-event-hint"
import { isDefaultLeaveQuote } from "@/lib/lead-scan"
import { isPlaceholderName } from "@/lib/leads"
import { toE164 } from "@/lib/sms-thread"
import { escapeXml } from "@/lib/twilio-identity"

export type WhisperFacts = {
  /** First name, "" when we have none (spokenName then says the last four digits). */
  name: string
  phone: string
  heads: number | null
  /** The party's wall date, YYYY-MM-DD. */
  date: string | null
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
}

const PT = "America/Los_Angeles"
const ZH_DIGITS = "零一二三四五六七八九"
const WEEKDAYS = "日一二三四五六"
const MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
// order_status values that mean the party is off (as lib/deposit-lock.ts)
const CLOSED_STATUSES = new Set(["cancelled", "canceled", "refunded", "void", "voided", "closed"])

// ---- speaking -------------------------------------------------------------------------------

function underTenThousand(v: number, leading: boolean): string {
  const digits = [Math.floor(v / 1000), Math.floor(v / 100) % 10, Math.floor(v / 10) % 10, v % 10]
  const units = ["千", "百", "十", ""]
  let out = ""
  let zero = false
  for (let i = 0; i < 4; i++) {
    const d = digits[i]
    if (d === 0) {
      if (out) zero = true
      continue
    }
    if (zero) out += "零"
    zero = false
    // A number that starts in the tens is 十五, not 一十五; 两千 reads better than 二千.
    if (!(d === 1 && i === 2 && !out && leading)) out += d === 2 && i === 0 ? "两" : ZH_DIGITS[d]
    out += units[i]
  }
  return out
}

/** Whole numbers in Mandarin, written out so the voice never guesses: 1225 -> 一千二百二十五. */
export function zhNumber(n: number): string {
  const v = Math.floor(Math.abs(n))
  if (v === 0) return "零"
  if (v >= 100_000_000) return String(v)
  const high = Math.floor(v / 10_000)
  const low = v % 10_000
  if (!high) return underTenThousand(low, true)
  const wan = (high === 2 ? "两" : underTenThousand(high, true)) + "万"
  return low ? wan + (low < 1000 ? "零" : "") + underTenThousand(low, false) : wan
}

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

/** 今天 / 明天 / 周一十月十二号 for a wall date. */
export function spokenDate(date: string, today: string): string {
  if (date === today) return "今天"
  if (date === addDays(today, 1)) return "明天"
  const [y, m, d] = date.split("-").map(Number)
  return `周${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}${zhNumber(m)}月${zhNumber(d)}号`
}

/** "April Costigan" -> "April"; "" for a stand-in ("+16262220069", "Guest"). */
export function firstName(raw: string | null | undefined): string {
  const name = (raw ?? "").trim().replace(/\s+/g, " ")
  if (isPlaceholderName(name) || /^(sms lead|caller)$/i.test(name)) return ""
  const first = name.split(" ")[0]
  const word = (first.match(/\p{L}/gu) ?? []).length >= 2 ? first : name
  // "NIC TENWOLDE" would be read as letters.
  return /^[A-Z][A-Z'’-]+$/.test(word) ? word[0] + word.slice(1).toLowerCase() : word
}

/** The sentence whoever answers hears, or null when we know nothing about the caller. */
export function whisperLine(f: WhisperFacts, today: string): string | null {
  const heads = f.heads && f.heads > 0 ? f.heads : null
  const price = f.price && f.price >= 1 ? f.price : null
  if (!f.name && !heads && !f.date && !f.dateTbd && !price && !f.locked && !f.returning) return null
  const parts = [spokenName({ name: f.name, phone: f.phone })]
  if (f.returning) parts.push("老客人")
  if (heads) parts.push(`${zhNumber(heads)}人`)
  if (f.date) parts.push(spokenDate(f.date, today))
  else if (f.dateTbd) parts.push("日期待定")
  // Whole dollars: "$1,337.40" is said as 一千三百三十七, the digits as they were written.
  if (price) parts.push(`${f.order ? "总价" : "报价"}${zhNumber(price)}`)
  parts.push(f.locked ? "已锁单" : "还没锁单")
  return parts.join("，")
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

const LOOKUP_TYPES = Array.from(new Set([...HINT_TYPES, "sms_outbound"]))
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
export async function loadWhisperFacts(supabase: SupabaseClient, phone: string, now = Date.now()): Promise<WhisperFacts> {
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
      .select("customer_name, customer_phone, event_start, order_status, deposit_status, quoted_total_cents, guest_adult_count, guest_child_count")
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
  if (lead) {
    const { data, error } = await supabase
      .from("lead_touchpoints")
      .select("touchpoint_type, occurred_at, raw_payload_json")
      .eq("lead_id", lead.id)
      .in("touchpoint_type", LOOKUP_TYPES)
      .order("occurred_at", { ascending: false })
      .limit(200)
    if (error) throw new Error(`timeline lookup: ${error.message}`)
    rows = (data ?? []) as TimelineRow[]
  }
  const timeline = readTimeline(rows)

  // event_start is the party's wall-clock time stored as UTC: the date is its first ten characters.
  const dayOf = (o: OrderRow) => str(o.event_start).slice(0, 10)
  const live =
    orders.filter((o) => !o.event_start || dayOf(o) >= today).sort((a, b) => (dayOf(a) || "9999").localeCompare(dayOf(b) || "9999"))[0] ?? null
  const past = orders.filter((o) => o.event_start && dayOf(o) < today)
  const returning = past.some((o) => o.deposit_status === "paid_verified")

  const name = [live?.customer_name, lead?.full_name, past[0]?.customer_name, timeline.greeted].map(firstName).find(Boolean) ?? ""
  const split = (lead?.adult_count ?? 0) + (lead?.child_count ?? 0) + (lead?.little_count ?? 0)
  const leadHeads = lead?.guest_count && lead.guest_count > 0 ? lead.guest_count : split > 0 ? split : null

  if (live) {
    const orderHeads = (live.guest_adult_count ?? 0) + (live.guest_child_count ?? 0)
    const heads = orderHeads > 0 ? orderHeads : leadHeads
    const cents = live.quoted_total_cents ?? 0
    return {
      name,
      phone,
      heads,
      date: live.event_start ? dayOf(live) : null,
      dateTbd: !live.event_start,
      // Some orders carry no total yet (the invoice was never saved): the price we texted stands.
      price: cents > 0 ? cents / 100 : (pickPrice(timeline.shown, heads)?.value ?? null),
      locked: live.deposit_status === "paid_verified",
      order: true,
      returning,
    }
  }

  // A party date that has gone by - the lead's, or the last one we did for them - is not a party
  // to talk about, and neither is a price given before it.
  const quote = pickPrice(timeline.shown, leadHeads)
  const date = timeline.date && timeline.date >= today ? timeline.date : null
  const gone = [...past.map(dayOf), ...(timeline.date && !date ? [timeline.date] : [])].sort()
  const lastGone = gone[gone.length - 1] ?? null
  const price = quote && !(lastGone && quote.at.slice(0, 10) <= lastGone) ? quote.value : null
  return { name, phone, heads: leadHeads, date, dateTbd: false, price, locked: false, order: false, returning }
}

/** ` url="…" method="POST"` for a <Client> / <Number> leg: whisper about `from` to whoever answers. */
export function whisperAttribute(base: string, from: string | null | undefined): string {
  const phone = toE164(from)
  if (!phone) return ""
  // Digits only: no "+" to encode, so the URL Twilio signs is byte-for-byte the one we rebuild.
  return ` url="${escapeXml(`${base}/api/twilio/voice-whisper?from=${phone.replace(/\D/g, "")}`)}" method="POST"`
}
