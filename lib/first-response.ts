// The machine's share of the first response (owner 2026-10-07: "交给机器").
//
// Pure helpers for app/api/admin/lead-watch: the wording of template B (sent
// after the site's automatic quote), the pre-party contact texts, and the
// wall-clock arithmetic they need. Nothing here touches the network, so the
// rules are unit-tested in tests/first-response.test.ts and every change to
// the wording or the thresholds is a visible diff.

const PT = "America/Los_Angeles"

/** Milliseconds to add to a UTC instant to get the PT wall clock at that instant (negative). */
export function ptOffsetMs(instantMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PT,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instantMs))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"))
  return wall - Math.floor(instantMs / 1000) * 1000
}

/**
 * orders.event_start is the PT wall clock stored as if it were UTC (the whole
 * pipeline does this - see components/admin/workbench/helpers.ts). This is the
 * real instant that wall time names, so "hours until the party" can be computed.
 */
export function wallToInstant(wallIso: string): number {
  const guess = Date.parse(wallIso)
  if (Number.isNaN(guess)) return NaN
  // Two passes so the offset is read at the instant itself, not at the guess
  // (only matters within hours of a DST change).
  const first = guess - ptOffsetMs(guess)
  return guess - ptOffsetMs(first)
}

/** The inverse: a real instant as the wall-clock-as-UTC ISO string the orders table uses. */
export function instantToWallIso(instantMs: number): string {
  return new Date(instantMs + ptOffsetMs(instantMs)).toISOString()
}

/** PT calendar date (YYYY-MM-DD) of a real instant. */
export function ptDate(instantMs: number): string {
  return new Date(instantMs + ptOffsetMs(instantMs)).toISOString().slice(0, 10)
}

/** "Sat, Oct 18" from "2026-10-18". */
export function shortDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!m) return ""
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

/** "6 PM" / "6:30 PM" from the wall-clock fields of event_start. */
export function wallTime(wallIso: string): string {
  const d = new Date(wallIso)
  if (Number.isNaN(d.getTime())) return ""
  const h = d.getUTCHours()
  const min = d.getUTCMinutes()
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}${min ? `:${String(min).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`
}

// ---------------------------------------------------------------------------
// Template B - after the automatic quote (leads skill §3.1).
//
// 2026-10-08 (owner, D-1008-02): the question is the occasion, not the date or
// the start time. Leads 10-01~07 answered the machine's "which date are you
// looking at?" at 20% inside 24 h against 52% the week before, across Google,
// Meta and free alike; the handwritten first lines that worked asked what the
// party was for. One fact (the date is open, when they gave one) + one easy
// question. The 4 PM / 7 PM choice comes later, from a person.

export type QuoteFollowUpInput = {
  adults: number
  kids: number
  /** YYYY-MM-DD the customer picked on the page, if any. */
  eventDate?: string | null
  /** cityName from the quote card ("Palm Springs", "92270", "LA & Orange County"...). */
  city?: string | null
  /** Today's PT date, YYYY-MM-DD. */
  todayPt: string
}

export type QuoteFollowUpPlan = { send: true; text: string; dated: boolean } | { send: false; reason: string }

/** Large parties get the E-type treatment from a person (per-head quote, "3-chef party"). */
export const LARGE_PARTY_ADULTS = 61
/** Inside this many days "that date's open on our end" needs a person to check the calendar first. */
export const QUOTE_FOLLOW_UP_MIN_DAYS = 2

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400_000)

export function quoteFollowUpPlan(i: QuoteFollowUpInput): QuoteFollowUpPlan {
  const adults = Math.max(0, Math.round(Number(i.adults) || 0))
  const kids = Math.max(0, Math.round(Number(i.kids) || 0))
  const guests = adults + kids
  if (guests <= 0) return { send: false, reason: "no_guests" }
  if (adults >= LARGE_PARTY_ADULTS) return { send: false, reason: "large_party" }
  const date = i.eventDate && /^\d{4}-\d{2}-\d{2}$/.test(i.eventDate) ? i.eventDate : ""
  if (date) {
    const days = daysBetween(i.todayPt, date)
    if (days < 0) return { send: false, reason: "date_past" }
    if (days < QUOTE_FOLLOW_UP_MIN_DAYS) return { send: false, reason: "date_within_48h" }
  }
  const place = placeName(i.city)
  const head = "Hi! Rowling from Real Hibachi 👋"
  const text = date
    ? `${head} ${shortDate(date)} is open on our end for your ${guests}${place ? ` in ${place}` : ""} — what's the celebration?`
    : place
      ? `${head} ${guests} in ${place} — what's the celebration?`
      : `${head} Saw your quote for ${guests} — what's the celebration?`
  return { send: true, text, dated: Boolean(date) }
}

/**
 * A town the customer would say themselves, or "" - the quote card's cityName
 * is sometimes a ZIP, a region label or lower case ("irvine").
 */
export function placeName(city: string | null | undefined): string {
  const c = (city ?? "").trim()
  if (!c || !/^[A-Za-z][A-Za-z .'-]*$/.test(c)) return ""
  if (/^(southern california|socal|california|los angeles county|orange county)$/i.test(c)) return ""
  return c.replace(/(^|[\s'-])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase())
}

// ---------------------------------------------------------------------------
// Pre-party contact (owner 2026-10-07): a booked customer we have not heard
// from must be reached before the party - the day before at the latest, or
// the party may not happen. The machine sends the first two texts; a person
// takes over (calls) when those go unanswered.

/** Hours before the party at which each step happens. */
export const PARTY_CONTACT_FIRST_TEXT_H = 72
export const PARTY_CONTACT_FLAG_H = 48
export const PARTY_CONTACT_URGENT_H = 24
/** A brand-new order just got the lock confirmation; do not text it again within this long. */
export const PARTY_CONTACT_MIN_ORDER_AGE_MS = 2 * 3600_000

// Texts and email are signed Rowling from 2026-10-09 17:20 PT (owner: "接下来所有的新订单");
// customers who were already talking to us know the texts as Bling and keep
// that name - the owner: "之前跟进的就还是保持原样". The lead's first contact
// decides, not the order date: an old conversation that books next week is
// still Bling's.
export const ROWLING_FROM = "2026-10-10T00:20:00Z"
export function textSignerFor(firstContactAt: string | null | undefined): "Bling" | "Rowling" {
  const t = firstContactAt ? Date.parse(firstContactAt) : NaN
  return Number.isFinite(t) && t < Date.parse(ROWLING_FROM) ? "Bling" : "Rowling"
}

export type PartyContactInput = {
  /** Who the texts are signed by for this customer (textSignerFor); Rowling when unknown. */
  signer?: "Bling" | "Rowling"
  customerName?: string | null
  /** orders.event_start (wall clock stored as UTC). */
  eventStart: string
  address?: string | null
  /** Real "now", for today/tomorrow wording. */
  now: number
}

const firstName = (name: string | null | undefined) => {
  const n = (name ?? "").trim().split(/\s+/)[0] ?? ""
  return /^[A-Za-z][A-Za-z'.-]*$/.test(n) ? n : ""
}

const shortAddress = (address: string | null | undefined) => {
  const a = (address ?? "").replace(/\s+/g, " ").trim()
  // Street line only - the ZIP and state are noise in a text.
  return a.split(",")[0]?.trim() ?? ""
}

/** 72h: the confirmation text. */
export function partyContactFirstText(i: PartyContactInput): string {
  const name = firstName(i.customerName)
  const when = `${shortDate(i.eventStart.slice(0, 10))} at ${wallTime(i.eventStart)}`
  const where = shortAddress(i.address)
  return (
    `Hi${name ? ` ${name}` : ""}, ${i.signer ?? "Rowling"} from Real Hibachi 👋 Your hibachi party is ${when}${where ? ` at ${where}` : ""}. ` +
    `Reply YES if everything's still set, or let me know if anything's changed.`
  )
}

/** 24h: the second text, one day out, when the first went unanswered. */
export function partyContactSecondText(i: PartyContactInput): string {
  const name = firstName(i.customerName)
  const sameDay = ptDate(i.now) === i.eventStart.slice(0, 10)
  const where = shortAddress(i.address)
  return (
    `Hi${name ? ` ${name}` : ""}, ${i.signer ?? "Rowling"} here - just making sure we're all set for ${sameDay ? "today" : "tomorrow"} at ${wallTime(i.eventStart)}${where ? ` at ${where}` : ""}. ` +
    `Could you reply so I know you got this? 🙏`
  )
}

export type PartyContactStage = "wait" | "first_text" | "flag_48h" | "urgent_24h" | "past"

/**
 * Which step is due for an order, given what already happened. `reached`
 * short-circuits everything: a customer who texted since the window opened
 * needs no confirmation and nobody is bothered.
 */
export function partyContactStage(p: { hoursLeft: number; sentFirst: boolean; sentSecond: boolean; reached: boolean }): PartyContactStage {
  if (p.reached) return "wait"
  if (p.hoursLeft <= 0) return "past"
  if (p.hoursLeft > PARTY_CONTACT_FIRST_TEXT_H) return "wait"
  if (!p.sentFirst) return "first_text"
  if (p.hoursLeft <= PARTY_CONTACT_URGENT_H) return "urgent_24h"
  if (p.hoursLeft <= PARTY_CONTACT_FLAG_H) return "flag_48h"
  return "wait"
}
