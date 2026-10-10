// "How did you find us?" - for the leads the system can't place.
//
// Owner 2026-10-10: calls, direct texts and manual entries come in person to
// person, so rh_resolve_channel falls through to "organic_direct" (no utm, no
// click id, no referrer). Those customers get the question once, at the
// moment it costs nothing: after they lock the date, riding on a reply that
// would otherwise be a plain thank-you (leads skill §4.6). Their answer is
// kept next to the system channel, never instead of it - a "Google" from a
// customer can be an ad or organic.
//
// Platform inquiries (The Knot, Zola ...) are not asked: the sender's domain
// already says where they came from (platformOf).

export const UNKNOWN_CHANNEL = "organic_direct"

/** What we send - appended to a short acknowledgement, never on its own. */
export const SOURCE_QUESTION = "Just curious - how did you find us?"

/** Any of our texts that asked it (whatever the wording). */
export const ASKS_SOURCE = /\bhow(?: did|'d) you (?:hear about|find) us\b/i

export const HEARD_CHANNELS = [
  "google",
  "google_maps",
  "yelp",
  "instagram",
  "facebook",
  "tiktok",
  "nextdoor",
  "vehicle",
  "ai_assistant",
  "platform",
  "party_guest",
  "returning",
  "friend",
  "other",
] as const
export type HeardChannel = (typeof HEARD_CHANNELS)[number]

export const HEARD_LABELS: Record<HeardChannel, string> = {
  google: "Google 搜索",
  google_maps: "Google 地图/商家页",
  yelp: "Yelp",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  nextdoor: "Nextdoor",
  vehicle: "看到我们的车",
  ai_assistant: "ChatGPT 等 AI",
  platform: "The Knot / Zola 等平台",
  party_guest: "在别人派对上见过",
  returning: "老客人",
  friend: "朋友家人推荐",
  other: "其他",
}

export function isHeardChannel(value: unknown): value is HeardChannel {
  return typeof value === "string" && (HEARD_CHANNELS as readonly string[]).includes(value)
}

// First match wins, so the specific comes before the general: "Google maps"
// is maps not search, "saw you at my cousin's party" is a party guest not a
// friend's tip.
const RULES: Array<[HeardChannel, RegExp]> = [
  ["platform", /\b(?:the ?knot|zola|wedding ?wire|thumbtack|gig ?salad|the ?bash|bark)\b/i],
  ["ai_assistant", /\b(?:chat ?gpt|openai|claude|gemini|perplexity|copilot)\b/i],
  ["google_maps", /\bmaps?\b|\bgoogle (?:business|listing|profile|reviews?)\b/i],
  ["yelp", /\byelp\b/i],
  ["instagram", /\b(?:instagram|insta|ig)\b/i],
  ["tiktok", /\btik ?tok\b/i],
  ["facebook", /\b(?:facebook|fb|marketplace)\b/i],
  ["nextdoor", /\bnext ?door\b/i],
  ["vehicle", /\b(?:your|the|a) (?:car|truck|van|vehicle|trailer)\b|\b(?:wrap|decal|sticker)s?\b/i],
  ["party_guest", /\bsaw you (?:at|guys at)\b|\b(?:at|went to|attended|been to) (?:a|an|my|his|her|their|our|the|someone'?s?) [\w' ]{0,30}\b(?:party|birthday|event|wedding|shower|celebration)\b/i],
  ["returning", /\b(?:used you|booked you|had you guys|you (?:did|cooked|catered) (?:our|my|for us)|last (?:year|time)|again)\b/i],
  ["friend", /\b(?:friend|family|cousin|sister|brother|mom|dad|aunt|uncle|cowork\w*|co-work\w*|neighbou?r|referr\w*|recommend\w*|word of mouth)s?\b/i],
  ["google", /\bgoogl\w*\b|\bsearch\w*\b|\bonline\b|\binternet\b|\bweb ?site\b/i],
]

/** Bucket a customer's answer. The desk prints the guess; a human can override with --as. */
export function classifyHeard(text: string): HeardChannel {
  const t = String(text ?? "")
  for (const [channel, rx] of RULES) if (rx.test(t)) return channel
  return "other"
}

// Lead platforms whose notification emails reach support@ (the same list
// email-inbound exempts from the bulk filter). Domain -> lead_source.
const PLATFORMS: Array<[RegExp, string]> = [
  [/(^|\.)theknot\.com$/i, "the_knot"],
  [/(^|\.)weddingwire\.com$/i, "weddingwire"],
  [/(^|\.)zola\.com$/i, "zola"],
  [/(^|\.)thumbtack\.com$/i, "thumbtack"],
  [/(^|\.)bark\.com$/i, "bark"],
  [/(^|\.)eventective\.com$/i, "eventective"],
  [/(^|\.)peerspace\.com$/i, "peerspace"],
  [/(^|\.)giggster\.com$/i, "giggster"],
  [/(^|\.)gigsalad\.com$/i, "gigsalad"],
  [/(^|\.)thebash\.com$/i, "thebash"],
  [/(^|\.)partyslate\.com$/i, "partyslate"],
  [/(^|\.)airbnb\.com$/i, "airbnb"],
  [/(^|\.)vrbo\.com$/i, "vrbo"],
]

/**
 * A platform's own notification text reaching the 213 line - Zola texts
 * "Zola: New Zola inquiry for Real Hibachi from ..." (Taegan, 10-02, was filed
 * as a plain sms_inbound lead). Only the platform's opening, never a customer
 * who merely mentions it.
 */
export function platformOfText(text: string): string | null {
  const t = String(text ?? "").trimStart()
  if (/^zola\b|^new zola inquiry\b/i.test(t)) return "zola"
  if (/^the ?knot\b/i.test(t)) return "the_knot"
  if (/^wedding ?wire\b/i.test(t)) return "weddingwire"
  if (/^thumbtack\b/i.test(t)) return "thumbtack"
  return null
}

/** "member.theknot.com" -> "the_knot"; null for everyone else. */
export function platformOf(email: string): string | null {
  const domain = String(email ?? "").split("@")[1]?.trim().toLowerCase() ?? ""
  if (!domain) return null
  for (const [rx, name] of PLATFORMS) if (rx.test(domain)) return name
  return null
}

export type SourceAsk = "known" | "answered" | "after_party" | "party_day" | "asked" | "ask_now" | "after_booking"

/** Where the customer is with us: no booking, a party ahead, the party is today, or one already happened. */
export type PartyStage = "not_booked" | "booked" | "party_day" | "after_party"

/**
 * A contact's stage from its live orders, by the party's wall date (event_start
 * is stored as wall time - compare its date part to today's date in PT).
 * Any party already behind them wins: they know us.
 */
export function partyStage(orders: Array<{ order_status?: unknown; event_start?: unknown }>, todayPt: string): PartyStage {
  const live = orders.filter((o) => !/^cancel/i.test(String(o.order_status ?? "")))
  const days = live.map((o) => String(o.event_start ?? "").slice(0, 10))
  if (days.some((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d < todayPt)) return "after_party"
  if (days.some((d) => d === todayPt)) return "party_day"
  return live.length ? "booked" : "not_booked"
}

/**
 * Where this lead stands on the question.
 *   known          the system has a channel - never ask
 *   answered       they told us
 *   after_party    a party of theirs already happened - they know us; the
 *                  text after a party is the review ask, never ask
 *   party_day      the party is today - not now
 *   asked          we asked, no answer yet - never ask again
 *   ask_now        unknown and booked - ask on the next plain thank-you
 *   after_booking  unknown, not booked yet - wait
 */
export function sourceAsk(input: {
  channel: string | null | undefined
  heardChannel?: string | null
  heardAskedAt?: string | null
  stage: PartyStage
}): SourceAsk {
  if (input.heardChannel) return "answered"
  if ((input.channel ?? UNKNOWN_CHANNEL) !== UNKNOWN_CHANNEL) return "known"
  if (input.stage === "after_party") return "after_party"
  if (input.heardAskedAt) return "asked"
  if (input.stage === "party_day") return "party_day"
  return input.stage === "booked" ? "ask_now" : "after_booking"
}
