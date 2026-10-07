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
  // The landing form's own adults/kids are a stale default (15 when the quote said 5, 2026-10-07);
  // the automatic quote right after it carries the real count, so do not repeat the form's.
  if (adults && type !== "landing_contact") bits.push(`${adults} 大人${kids && kids !== "0" ? ` ${kids} 小孩` : ""}`)
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
