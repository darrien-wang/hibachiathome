// 客户主档 — shared shapes and the small amount of logic the workbench tab and
// the API both need (phone normalising, anniversary math, SMS drafts). No
// server imports here: the tab bundles this file into the browser.

export type CustomerRow = {
  id: string
  full_name: string | null
  phone: string | null
  normalized_phone: string | null
  email: string | null
  address: string | null
  city: string | null
  zip: string | null
  source: string
  first_event_date: string | null
  last_event_date: string | null
  events_count: number
  occasions: string[]
  tags: string[]
  sms_consent: "unknown" | "yes" | "no"
  sms_consent_at: string | null
  opted_out_at: string | null
  do_not_contact: boolean
  notes: string | null
  lead_id: string | null
  created_at: string
  updated_at: string
}

export type CustomerEvent = {
  id: string
  customer_id: string
  event_date: string
  event_time: string | null
  address: string | null
  occasion: string | null
  guest_count: number | null
  amount_cents: number | null
  source: string
  order_id: string | null
  notes: string | null
  created_at: string
}

export type MarketingTouch = {
  id: string
  customer_id: string
  channel: "sms" | "email" | "call" | "note"
  campaign: string
  body: string | null
  sent_at: string
  sent_by: string | null
  result: string | null
  event_id: string | null
}

export type Campaign = "anniversary" | "winback" | "referral" | "custom"

/** 周年提醒提前几天（2026-09-21 老板定：两周）。 */
export const REMINDER_LEAD_DAYS = 14
/** How long after the anniversary a reminder still counts as "this cycle" (the customer shows as 周年已过, worth a win-back text). */
export const REMINDER_GRACE_DAYS = 60
export const REMINDER_OFFER = "$50 off"

export const OCCASION_LABELS: Record<string, string> = {
  birthday: "生日",
  anniversary: "纪念日",
  bachelorette: "单身派对",
  wedding: "婚礼",
  graduation: "毕业",
  holiday: "节日",
  business: "公司 / 商家",
  other: "其他",
}
export const OCCASION_KEYS = Object.keys(OCCASION_LABELS)

export const CAMPAIGN_LABELS: Record<Campaign, string> = {
  anniversary: "周年提醒",
  winback: "唤醒",
  referral: "转介绍",
  custom: "自定义",
}

export const CONSENT_LABELS: Record<CustomerRow["sms_consent"], string> = { unknown: "未问过", yes: "已同意", no: "拒绝" }

export function normalizePhone10(raw: string | null | undefined): string | null {
  const d = (raw ?? "").replace(/\D/g, "")
  if (d.length === 10) return d
  if (d.length === 11 && d.startsWith("1")) return d.slice(1)
  return null
}

export function toE164Loose(raw: string | null | undefined): string | null {
  const ten = normalizePhone10(raw)
  return ten ? `+1${ten}` : null
}

/** "556 Prospect Blvd, Pasadena" / "2218 S. Birch Santa Ana, CA 92707" -> "Pasadena" / "Santa Ana". Best effort. */
export function cityOf(address: string | null | undefined): string | null {
  if (!address) return null
  const cleaned = address.replace(/，/g, ",").replace(/\s+/g, " ").trim()
  const parts = cleaned.split(",").map((p) => p.trim()).filter(Boolean)
  // Drop trailing "CA 91234", "USA", zip-only and state-only pieces.
  const isNoise = (p: string) => /^(ca|california|usa|us|united states)$/i.test(p) || /^\d{5}$/.test(p) || /^(ca|california)\s+\d{5}$/i.test(p)
  const kept = parts.filter((p) => !isNoise(p))
  if (kept.length >= 2) {
    // The city is the last kept piece unless it still carries a state/zip suffix.
    const last = kept[kept.length - 1].replace(/\b(ca|california)\b.*$/i, "").replace(/\d{5}.*$/, "").trim()
    if (last && !/\d/.test(last)) return last
  }
  // Single piece: "5156 W Avenue J4 Lancaster CA 93536" -> take the words before CA/zip that are not the street.
  const single = kept[0] ?? cleaned
  const m = single.match(/^(?:.*?\b(?:st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|ct|court|way|trail|cir|circle|pl|place)\.?\s+)?([A-Za-z][A-Za-z .']+?)\s*(?:,?\s*(?:CA|California)\b.*)?$/i)
  const guess = m?.[1]?.trim() ?? ""
  return guess && guess.split(" ").length <= 3 ? guess : null
}

const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

export function addDaysYmd(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** One year after the party, or the first later anniversary that is not more than the grace period behind us. */
export function nextAnniversary(lastEventDate: string, today: string): string {
  const [yy, mm, dd] = lastEventDate.split("-")
  const day = mm === "02" && dd === "29" ? "28" : dd
  let year = Number(yy) + 1
  const floor = addDaysYmd(today, -REMINDER_GRACE_DAYS)
  while (`${year}-${mm}-${day}` < floor) year++
  return `${year}-${mm}-${day}`
}

export type ReminderState = {
  anniversary: string
  dueFrom: string
  /** none = cannot text; future = the latest party has not happened yet; sent = already touched this cycle; due = send now; overdue = anniversary passed, still in grace; upcoming = not yet. */
  status: "none" | "future" | "sent" | "due" | "overdue" | "upcoming"
  lastTouch: MarketingTouch | null
}

export function reminderState(c: CustomerRow, touches: MarketingTouch[], today: string): ReminderState {
  const mine = touches.filter((t) => t.customer_id === c.id).sort((a, b) => (a.sent_at < b.sent_at ? 1 : -1))
  const lastTouch = mine[0] ?? null
  if (!c.last_event_date) return { anniversary: "", dueFrom: "", status: "none", lastTouch }
  // A booked party still ahead of us is not an anniversary; the customer shows up here after it happens.
  if (c.last_event_date > today) return { anniversary: "", dueFrom: "", status: "future", lastTouch }
  const anniversary = nextAnniversary(c.last_event_date, today)
  const dueFrom = addDaysYmd(anniversary, -REMINDER_LEAD_DAYS)
  if (!c.phone || c.do_not_contact || c.opted_out_at || c.sms_consent === "no") return { anniversary, dueFrom, status: "none", lastTouch }
  const cycleStart = addDaysYmd(dueFrom, -REMINDER_GRACE_DAYS)
  const sentThisCycle = mine.some((t) => t.campaign === "anniversary" && t.sent_at.slice(0, 10) >= cycleStart)
  if (sentThisCycle) return { anniversary, dueFrom, status: "sent", lastTouch }
  if (today >= dueFrom && today <= anniversary) return { anniversary, dueFrom, status: "due", lastTouch }
  if (today > anniversary) return { anniversary, dueFrom, status: "overdue", lastTouch }
  return { anniversary, dueFrom, status: "upcoming", lastTouch }
}

function firstName(c: CustomerRow): string {
  const n = (c.full_name ?? "").trim()
  if (!n) return ""
  const first = n.split(/\s+/)[0]
  return first.charAt(0).toUpperCase() + first.slice(1)
}

/** The SMS the boss sees before sending. Written for a customer, one ask per message, opt-out line always on. */
export function draftSms(campaign: Campaign, c: CustomerRow, lastEvent: CustomerEvent | null, sender = "Darrien"): string {
  const name = firstName(c)
  const hi = name ? `Hi ${name}, ` : "Hi, "
  const city = cityOf(lastEvent?.address ?? c.address) ?? c.city ?? ""
  const where = city ? ` in ${city}` : ""
  const when = lastEvent?.event_date ?? c.last_event_date
  const month = when ? MONTHS_EN[Number(when.slice(5, 7)) - 1] : ""
  const lastWhen = month ? ` last ${month}` : ""
  const occasion = lastEvent?.occasion ?? c.occasions[0] ?? ""
  const what = occasion === "birthday" ? "birthday party" : occasion === "bachelorette" ? "bachelorette party" : occasion === "wedding" ? "wedding celebration" : occasion === "graduation" ? "graduation party" : "party"
  switch (campaign) {
    case "anniversary":
      return `${hi}it's ${sender} from Real Hibachi. We cooked for your ${what}${where}${lastWhen}! That date is coming around again — want the chef back this year? Reply YES and I'll send open dates, with ${REMINDER_OFFER} as a thank-you. Reply STOP to opt out.`
    case "winback":
      return `${hi}it's ${sender} from Real Hibachi. It's been a while since we cooked at your place${where} — any celebrations coming up? Reply with a date and I'll check the chef calendar, with ${REMINDER_OFFER} for coming back. Reply STOP to opt out.`
    case "referral":
      return `${hi}${sender} from Real Hibachi here. Thanks again for having us${where}${lastWhen}! If a friend books a party, you get $50 and they get $50 off — just have them text REFER to this number. Reply STOP to opt out.`
    default:
      return ""
  }
}
