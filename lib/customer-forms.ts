// A customer talking to us through the website instead of a text: "Book Now"
// on the quote page, a claimed planner party, a (second) contact form. These
// are inbound messages too. Antheyty answered "7 PM, with tables" through the
// quote page 20 s after our text (2026-10-06) and every alert, brake and scan
// read her as a lead who never replied. Everything that decides "who spoke
// last" reads this list; the first form is the lead itself and is handled as
// a new lead, so callers only count forms after our first response.
export const CUSTOMER_FORM_TYPES = ["quote_book_online", "planner_unlock", "contact_form", "landing_contact"] as const

export const FORM_LABELS: Record<string, string> = {
  quote_book_online: "报价页点了在线订",
  planner_unlock: "Planner 认领",
  contact_form: "联系表单",
  landing_contact: "落地页表单",
}

/**
 * Is this a customer we are already talking to? They texted us in the last two
 * weeks, or their party is booked. Owner 2026-10-08: such a customer filling
 * the site's form again gets no automatic quote - Natasha (7 adults) re-submitted
 * with the card's default 15 and got "$880.50 for 15" in the middle of our
 * conversation. A person answers instead.
 */
export function customerInConversation(
  thread: Array<{ direction: string; at: string }>,
  leadStatuses: Array<string | null>,
  nowMs: number,
  days = 14,
): boolean {
  const since = nowMs - days * 24 * 3600_000
  if (thread.some((m) => m.direction === "inbound" && Date.parse(m.at) >= since)) return true
  return leadStatuses.some((s) => s === "won")
}

/** One line of what the form said, for a card or an alert. */
export function formSummary(type: string, payload: Record<string, unknown> | null | undefined): string {
  const p = payload ?? {}
  const s = (k: string) => {
    const v = p[k]
    return typeof v === "string" || typeof v === "number" ? String(v) : ""
  }
  const bits: string[] = []
  const date = s("eventDate") || s("event_date") || s("partyDate") || s("date")
  const time = s("eventTime") || s("event_time")
  if (date) bits.push(`${date.slice(0, 10)}${time ? ` ${time}` : ""}`)
  const adults = s("adults") || s("adultCount") || s("guestAdults")
  const kids = s("kids") || s("childCount") || s("guestKids")
  // Step 1 of the landing card carries the card's default (15 when the quote said 5, 2026-10-07),
  // so its count is not repeated. A step-2 form (stage "quote") carries what the visitor picked -
  // though an untouched card still says 15 adults, so that one is flagged as maybe the default.
  const staleDefault = type === "landing_contact" && p.stage !== "quote"
  if (adults && !staleDefault) {
    const maybeDefault = type === "landing_contact" && adults === "15" && (!kids || kids === "0")
    bits.push(`${adults} 大人${kids && kids !== "0" ? ` ${kids} 小孩` : ""}${maybeDefault ? "（可能是表单默认值）" : ""}`)
  }
  else if (s("guests") || s("guestCount")) bits.push(`${s("guests") || s("guestCount")} 人`)
  const loc = s("location") || s("city") || s("cityOrZip") || s("zip")
  if (loc) bits.push(loc)
  if (p.tablewareRental === true || /^(yes|true)$/i.test(s("tablewareRental"))) bits.push("要桌椅餐具")
  if (p.tent10x10 === true) bits.push("要帐篷")
  const est = s("estimateHigh") || s("estimate_high") || s("estimateLow")
  if (est) bits.push(`网站估价 $${est}`)
  const msg = s("message") || s("specialRequests") || s("notes")
  if (msg) bits.push(msg.replace(/\s+/g, " ").slice(0, 80))
  return bits.join(" · ") || (type === "planner_unlock" ? "认领了 planner 派对" : "")
}
