// Yelp quote requests and messages as leads (2026-10-26).
//
// Yelp's Request a Quote and the customer's follow-up messages arrive only as
// e-mail to the owner's personal Gmail, and email-inbound used to drop every
// yelp.com sender as system mail. Fourteen months of requests - a 50-guest
// party, a 20-guest Huntington Beach party, a 25-100 guest park event - sat
// unread there and none booked. Yelp hides the customer's phone and e-mail:
// what we get is a name, the request details and a reply+...@messaging.yelp.com
// address that posts a reply back into the Yelp conversation (for 10 days).
//
// Shapes seen (2025-08 .. 2026-10):
//   "You received a new lead on Yelp!"            body: "<Name> requested a quote from ..."
//   "New Lead: Reply to <Name>'s personal chefs request"
//   "Message from <Name> for Real Hibachi"        (a follow-up or Yelp's "has waited N days" reminder)
//   "New Reply Message from <Name>"
//   "RE: Message from <Name> for Real Hibachi"    from no-reply@: our e-mailed reply was refused (> 10 days)
// Everything else from yelp.com (reviews, ad offers, account mail) stays filtered.

export type YelpNotification = {
  name: string
  kind: "request" | "message" | "reply_failed"
  /** reply+<token>@messaging.yelp.com when the mail carried one: replying to it lands in the Yelp thread. */
  replyTo: string | null
  guests: number | null
  zip: string | null
}

const YELP_DOMAIN = /(^|\.)yelp\.com$/i
const REPLY_ADDRESS = /^reply\+[0-9a-z]+@messaging\.yelp\.com$/i

const clean = (s: string) =>
  s
    .replace(/^["“”']+|["“”']+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)

function guestsOf(text: string): number | null {
  const t = text.replace(/\s+/g, " ")
  // "Approximately how many people will attend this event? 25–100" -> 25 (the floor of the range)
  const attend = t.match(/how many (?:people|guests)[^?]*\?\s*(\d{1,3})/i)
  if (attend) return Number(attend[1])
  const said = t.match(/\b(\d{1,3})\s*(?:guests|people|persons|ppl|adults|pax)\b/i)
  return said ? Number(said[1]) : null
}

function zipOf(text: string): string | null {
  const t = text.replace(/\s+/g, " ")
  const asked = t.match(/in what location do you need the service\?\s*(\d{5})\b/i)
  return asked ? asked[1] : null
}

export function parseYelpNotification(fromEmail: string, subject: string, text: string): YelpNotification | null {
  const email = (fromEmail ?? "").trim().toLowerCase()
  const domain = (email.split("@")[1] ?? "").trim()
  if (!YELP_DOMAIN.test(domain)) return null
  const s = (subject ?? "").replace(/\s+/g, " ").trim()
  const body = text ?? ""
  const replyTo = REPLY_ADDRESS.test(email) ? email : null
  const extras = { replyTo, guests: guestsOf(body), zip: zipOf(body) }

  let m = s.match(/^RE:\s*Message from (.+?) for /i)
  if (m && /cannot reply to your Yelp messages via email/i.test(body)) return { name: clean(m[1]), kind: "reply_failed", ...extras, replyTo: null }

  m = s.match(/^New Lead: Reply to (.+?)['’]s\b.*\brequest\b/i)
  if (m) return { name: clean(m[1]), kind: "request", ...extras }

  if (/^You received a new lead on Yelp/i.test(s)) {
    const who = body.match(/^\s*(.+?) requested a quote from /m)
    return { name: who ? clean(who[1]) : "", kind: "request", ...extras }
  }

  // No trailing-period strip: Yelp names end in an initial ("Steve S.").
  m = s.match(/^Message from (.+?) for /i) ?? s.match(/^New Reply Message from (.+)$/i)
  if (m) return { name: clean(m[1]), kind: "message", ...extras }

  return null
}

/** "Brenda Q." -> "Brenda Q. (Yelp)"; an unnamed request -> "Yelp customer". */
export function yelpLeadName(n: Pick<YelpNotification, "name">): string {
  return n.name ? `${n.name} (Yelp)` : "Yelp customer"
}

/** The first name, for matching "Brenda" (the request) with "Brenda Q." (her later messages). */
export function yelpFirstName(name: string): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? ""
}
