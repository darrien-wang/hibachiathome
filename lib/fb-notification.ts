// Facebook notification e-mails as leads (2026-10-18).
//
// Marketplace listings live on the owner's personal profile, and Meta has no
// API for a personal inbox (automating it is also banned - see the
// marketplace playbook). What Facebook does offer is an e-mail for every
// Messenger / Marketplace message when the account's notification settings
// say so. Those land in support@ like any other mail, so the inbound hook can
// turn them into a lead the inbox shows and the desk can draft a reply for.
// The customer's own text is in the body; a name is all we get for identity.
//
// Nam (60 guests, Walnut, 10/25) sat in the Marketplace folder for a day and
// older ones for weeks before the owner noticed - that is the gap this closes.

export type FacebookNotification = {
  /** The sender's display name as Facebook wrote it, or "" when the subject gave none. */
  name: string
  kind: "messenger" | "marketplace"
}

const FB_DOMAIN = /(^|\.)facebookmail\.com$/i

// Subject shapes seen from facebookmail.com (English and Simplified Chinese UI):
//   "Nam sent you a message."          "Nam replied to your message"
//   "New message from Nam"             "Nam messaged you about ..."
//   "Nam is interested in your listing" "Nam 给你发了一条消息"
// Anything else from the same domain (friend requests, digests, security) is
// not a customer and stays filtered.
const SUBJECT_PATTERNS: Array<{ re: RegExp; kind: FacebookNotification["kind"] }> = [
  { re: /^(.+?)\s+(?:is interested in|messaged you about|sent you a message about|asked about)\s+.*(?:listing|item|marketplace)/i, kind: "marketplace" },
  { re: /^(?:new|a new)\s+marketplace\s+message\s+from\s+(.+?)\.?$/i, kind: "marketplace" },
  { re: /^(.+?)\s+(?:sent you a (?:new )?message|replied to your message|messaged you)\b/i, kind: "messenger" },
  { re: /^(?:you have )?(?:a )?new message from\s+(.+?)\.?$/i, kind: "messenger" },
  { re: /^(.+?)\s*(?:给你发了|给您发了|向你发送了|回复了你)/u, kind: "messenger" },
]

/**
 * A customer message notification from Facebook, or null for every other
 * facebookmail.com e-mail (and for any other sender).
 */
export function parseFacebookNotification(fromEmail: string, subject: string, text: string): FacebookNotification | null {
  const domain = (fromEmail.split("@")[1] ?? "").trim()
  if (!FB_DOMAIN.test(domain)) return null
  const s = (subject ?? "").replace(/\s+/g, " ").trim()
  for (const p of SUBJECT_PATTERNS) {
    const m = s.match(p.re)
    if (m) {
      const name = (m[1] ?? "").replace(/^["“”']+|["“”']+$/g, "").trim()
      // Marketplace mail says so in the body even when the subject reads like Messenger.
      const kind = p.kind === "marketplace" || /marketplace/i.test(text ?? "") ? "marketplace" : "messenger"
      return { name: name.slice(0, 80), kind }
    }
  }
  // A Marketplace mail whose subject we have not seen yet: keep it, unnamed,
  // rather than drop a customer. Digests and security mail never say Marketplace.
  if (/marketplace/i.test(s) && /\b(message|messaged|buyer|interested|listing)\b/i.test(`${s} ${text ?? ""}`)) {
    return { name: "", kind: "marketplace" }
  }
  return null
}

/** The lead's display name: the Facebook name, tagged so the inbox shows where it came from. */
export function facebookLeadName(n: FacebookNotification): string {
  return n.name ? `${n.name} (Facebook)` : "Facebook Marketplace buyer"
}
