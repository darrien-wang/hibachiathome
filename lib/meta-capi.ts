// Meta Conversions API (server events) - D-1014-01.
//
// The ad sets were optimising for "Lead" (a form fill), and after the budget
// went to $120/day Meta filled it with people who were only curious: 47 leads
// in five days, two thirds never answered, none booked. Meta can only find
// the people who book if it is told who booked. The pixel cannot tell it: a
// Meta click opens in the Facebook / Instagram in-app browser, while the
// booking happens days later in Safari from our text message, so the
// browser's Purchase never matches the ad click. These events go server to
// server, matched on the hashed email / phone and the fbclid we stored when
// the click landed.
//
//   Contact  - the customer wrote back (first real reply, not a decline)
//   Purchase - the date was locked (Booking Confirmed), value = the quote
//
// Purchase reuses the pixel's eventID (the Stripe session id) so Meta counts
// a booking once even when both the browser and the server report it.

import { createHash } from "node:crypto"

const GRAPH = "https://graph.facebook.com/v21.0"
const DEFAULT_PIXEL_ID = "2227697161500477"

export function metaPixelId(): string {
  return (process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || DEFAULT_PIXEL_ID).replace(/\D/g, "")
}

/** The Conversions API token (Events Manager > dataset > Settings > Generate access token). */
export function metaCapiToken(): string {
  return process.env.META_CAPI_TOKEN?.trim() ?? ""
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex")

/** E.164 digits without "+", US default: "(626) 555-0101" -> "16265550101". */
export function normalizePhone(phone: string | null | undefined): string {
  const d = (phone ?? "").replace(/\D/g, "")
  if (d.length === 10) return `1${d}`
  if (d.length === 11 && d.startsWith("1")) return d
  return d.length > 11 ? d : ""
}

export function normalizeEmail(email: string | null | undefined): string {
  const e = (email ?? "").trim().toLowerCase()
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : ""
}

/** Meta's fbc format: fb.1.<click time ms>.<fbclid>. */
export function fbcFrom(fbclid: string | null | undefined, clickedAt: string | null | undefined): string | undefined {
  const id = (fbclid ?? "").trim()
  if (!id) return undefined
  const ms = clickedAt ? Date.parse(clickedAt) : NaN
  return `fb.1.${Number.isFinite(ms) ? ms : Date.now()}.${id}`
}

export type CapiUser = {
  email?: string | null
  phone?: string | null
  fbclid?: string | null
  clickedAt?: string | null
  fbp?: string | null
  userAgent?: string | null
  ip?: string | null
  externalId?: string | null
}

export type CapiEvent = {
  eventName: "Contact" | "Purchase"
  eventId: string
  eventTime: string
  user: CapiUser
  valueCents?: number
}

export function buildUserData(u: CapiUser): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const em = normalizeEmail(u.email)
  const ph = normalizePhone(u.phone)
  if (em) out.em = [sha256(em)]
  if (ph) out.ph = [sha256(ph)]
  const fbc = fbcFrom(u.fbclid, u.clickedAt)
  if (fbc) out.fbc = fbc
  if (u.fbp) out.fbp = u.fbp
  if (u.userAgent) out.client_user_agent = u.userAgent
  if (u.ip) out.client_ip_address = u.ip
  if (u.externalId) out.external_id = [sha256(u.externalId)]
  out.st = [sha256("ca")]
  out.country = [sha256("us")]
  return out
}

export function buildEvent(e: CapiEvent): Record<string, unknown> {
  // A "website" event must carry the browser's user agent; without it the
  // event goes in as system_generated rather than being rejected.
  const website = Boolean(e.user.userAgent)
  return {
    event_name: e.eventName,
    event_time: Math.floor(Date.parse(e.eventTime) / 1000),
    event_id: e.eventId,
    action_source: website ? "website" : "system_generated",
    ...(website ? { event_source_url: "https://www.realhibachi.com/" } : {}),
    user_data: buildUserData(e.user),
    ...(e.eventName === "Purchase" ? { custom_data: { currency: "USD", value: Math.round(e.valueCents ?? 0) / 100 } } : {}),
  }
}

export type CapiResult = { ok: boolean; status: number; body: unknown }

export async function sendCapiEvents(events: Record<string, unknown>[], testEventCode?: string): Promise<CapiResult> {
  const token = metaCapiToken()
  if (!token) return { ok: false, status: 0, body: { error: "META_CAPI_TOKEN not set" } }
  const res = await fetch(`${GRAPH}/${metaPixelId()}/events?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data: events, ...(testEventCode ? { test_event_code: testEventCode } : {}) }),
  })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  return { ok: res.ok, status: res.status, body }
}

/** A reply that says no is not the conversation we want Meta to find more of. */
export function isDecline(text: string | null | undefined): boolean {
  const t = (text ?? "").trim().toLowerCase()
  if (!t) return true
  return /^(stop|unsubscribe|cancel|end|quit|wrong number|no\b|not interested|no longer|not intrested|please remove|remove me)/.test(t)
}
