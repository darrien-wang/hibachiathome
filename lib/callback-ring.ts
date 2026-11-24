// 请回电 (owner 2026-10-09: "加响铃").
//
// A customer who asks for a phone call is the hottest thing in the inbox, and a text is the wrong
// alarm for it: on 10-09 Jose (27 guests) asked for a call while driving and waited 16 minutes,
// because nobody was looking. The loudest thing the owner's phone does is an incoming call - the
// workbench App rings full screen through FCM even when it is closed (2.1.1, ringKick since 09-24) -
// so we call the owner's App from the 213 line. He hears who wants a call and presses 1 to be put
// through to them (caller ID 213, recording notice as on any outbound call), 2 to be reminded in ten
// minutes, 3 if no call is needed. TwiML: app/api/twilio/callback-ring/route.ts.
//
// State lives on the lead as touchpoints: callback_request (the customer asked, or the desk raised
// it), callback_ring (each ring placed), callback_snooze, callback_done (put through, dismissed, or
// we found a call with that number). A request is open until a callback_done follows it. Each
// request rings once, 8 AM - 10 PM Pacific; lead-watch rings it again only after he pressed 2 (owner
// 2026-11-24: 「一次就够了如果我没管的话」「巡检以后只需要一次」 - it used to ring three times).

import type { SupabaseClient } from "@supabase/supabase-js"
import { toE164 } from "@/lib/sms-thread"
import { agentIdentities, identityForActor } from "@/lib/twilio-identity"

export const RING_HOURS_PT: [number, number] = [8, 22]
// A problem at a party going on right now is not handled by the desk: it rings the owner, and a
// dinner runs past 10 PM (owner 2026-11-02, Jenna). The desk marks it with a why that starts 现场.
export const LIVE_PARTY_RING_HOURS_PT: [number, number] = [7, 24]
export const LIVE_PARTY_WHY = "现场"
// A chef who has not confirmed a change to his party three hours before it starts (order-flow
// rebuild 2026-11-11, D-1111-03; lib/chef-notices.ts raises it). Like a live party it is an alarm,
// not a customer asking for a call: same hours, no key to press, the why is what the ring says.
export const CHEF_NOTICE_WHY = "师傅未确认"
export const RING_EVERY_MS = 10 * 60_000
export const SNOOZE_MS = 10 * 60_000
// One ring per request. A missed ring is not rung again: the message waits in the workbench (owner
// 2026-11-24, after the Menifee customer's "Can I call this number?" rang him twice in 15 minutes).
// Pressing 2 asks for one more, ten minutes later; each press buys exactly one.
export const MAX_RINGS = 1
const REQUEST_TTL_MS = 12 * 3600_000 // asked last night: by 8 AM it is a text to answer, not a ring
const DEDUPE_MS = 30 * 60_000 // "call me" twice in a row is one request

// "If you can call me that'd be great" / "Call now if you can please" (Jose 10-09), "can you give me a
// call", "llámame". A customer who says they will call us, or asks us not to, is not a request.
const ASKS = new RegExp(
  [
    String.raw`\bcall me\b`,
    String.raw`\bgive (me|us) a (call|ring|buzz)\b`,
    String.raw`\b(can|could|would|will) (you|u|ya|someone|somebody)( please)? (call|phone|ring)\b`,
    String.raw`\bplease call\b`,
    String.raw`\bcall (now|asap|back|when you can|this number)\b`,
    String.raw`\b(talk|speak|chat) (on|over) the phone\b`,
    String.raw`\b(hop|jump) on a (quick )?call\b`,
    String.raw`\bquick (phone )?call\b`,
    String.raw`\bprefer (a )?(phone )?call\b`,
    String.raw`\bll[aá]m[ae]me\b`,
    String.raw`\bme (puede|puedes|pueden|podr[ií]a|podr[ií]as) llamar\b`,
    String.raw`\bpueden? llamarme\b`,
  ].join("|"),
  "i",
)
const REFUSES = /\b(don'?t|do not|no|never|can'?t|cannot|won'?t|not able to) (call|calls|phone|talk)\b|\btext only\b|\bno (me )?llam/i
// The customer calling us: "Can I call this number?" (Menifee 11-24), "I'll call back later". The
// "call this number" / "call back" asks above read the same words the other way round.
const SELF_CALLS = /\b(i|we)(['’]ll|['’]d| will| would| can| could| may| might| shall| should| gonna| am going to| are going to)? (call|phone|ring)\b|\b(can|could|may|shall|should) (i|we) (call|phone|ring)\b/i
// Asking us to call in so many words still rings, even next to the above ("Can I call you, or can you call me?").
const ASKS_US = /\bcall me\b|\bgive (me|us) a (call|ring|buzz)\b|\b(can|could|would|will) (you|u|ya|someone|somebody)( please)? (call|phone|ring)\b|\bplease call\b|\bll[aá]m[ae]me\b|\bme (puede|puedes|pueden|podr[ií]a|podr[ií]as) llamar\b|\bpueden? llamarme\b/i

export function wantsCall(body: string | null | undefined): boolean {
  const s = (body ?? "").trim()
  if (s.length === 0 || !ASKS.test(s) || REFUSES.test(s)) return false
  return !SELF_CALLS.test(s) || ASKS_US.test(s)
}

function ptHour(ms: number): number {
  const h = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hour12: false }).format(new Date(ms))
  return Number(h) % 24
}

export function withinRingHours(ms: number, hours: [number, number] = RING_HOURS_PT): boolean {
  const h = ptHour(ms)
  return h >= hours[0] && h < hours[1]
}

export function isLivePartyAlarm(why: string | null | undefined): boolean {
  return (why ?? "").trim().startsWith(LIVE_PARTY_WHY)
}

export function isChefNoticeAlarm(why: string | null | undefined): boolean {
  return (why ?? "").trim().startsWith(CHEF_NOTICE_WHY)
}

/** An alarm rings 7 AM to midnight and is answered by picking up; a customer's request keeps 8 AM - 10 PM and the keys. */
export function isAlarm(why: string | null | undefined): boolean {
  return isLivePartyAlarm(why) || isChefNoticeAlarm(why)
}

export type OpenCallback = {
  leadId: string
  phone: string
  name: string
  why: string
  requestedAt: number
  rings: number
  lastRingAt: number | null
  snoozeUntil: number | null
  /** Times he pressed 2: each one is a ring he asked for, on top of the first. */
  snoozes?: number
}

/** How many rings this request may have had in all: the first, plus one per press of 2. */
export function ringsAllowed(open: Pick<OpenCallback, "snoozes">): number {
  return MAX_RINGS + (open.snoozes ?? 0)
}

export type Row = { touchpoint_type: string; occurred_at: string; raw_payload_json: Record<string, unknown> | null }

export async function openCallback(supabase: SupabaseClient, leadId: string): Promise<OpenCallback | null> {
  const { data } = await supabase
    .from("lead_touchpoints")
    .select("touchpoint_type, occurred_at, raw_payload_json")
    .eq("lead_id", leadId)
    .in("touchpoint_type", ["callback_request", "callback_ring", "callback_snooze", "callback_done"])
    .order("occurred_at", { ascending: true })
    .limit(200)
  return openFromRows(leadId, (data ?? []) as Row[])
}

// A request and its first ring are written with the same timestamp (requestCallback hands its `now`
// to ringIfDue), and the database returns ties in any order. Read the request first, or the ring is
// dropped and the next sweep rings again at once (11-02: a second ring 27 seconds after the first).
const ROW_ORDER: Record<string, number> = { callback_request: 0, callback_ring: 1, callback_snooze: 2, callback_done: 3 }

export function openFromRows(leadId: string, rows: Row[]): OpenCallback | null {
  const sorted = rows
    .slice()
    .sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at) || (ROW_ORDER[a.touchpoint_type] ?? 9) - (ROW_ORDER[b.touchpoint_type] ?? 9))
  let open: OpenCallback | null = null
  for (const r of sorted) {
    const at = Date.parse(r.occurred_at)
    const p = r.raw_payload_json ?? {}
    if (r.touchpoint_type === "callback_request") {
      open = { leadId, phone: String(p.phone ?? ""), name: String(p.name ?? ""), why: String(p.why ?? ""), requestedAt: at, rings: 0, lastRingAt: null, snoozeUntil: null, snoozes: 0 }
    } else if (!open) {
      continue
    } else if (r.touchpoint_type === "callback_ring") {
      open.rings += 1
      open.lastRingAt = at
    } else if (r.touchpoint_type === "callback_snooze") {
      const until = Date.parse(String(p.until ?? ""))
      open.snoozeUntil = Number.isFinite(until) ? until : at + SNOOZE_MS
      open.snoozes = (open.snoozes ?? 0) + 1
    } else if (r.touchpoint_type === "callback_done") {
      open = null
    }
  }
  return open
}

async function record(supabase: SupabaseClient, leadId: string, type: string, payload: Record<string, unknown>, at = Date.now()) {
  await supabase.from("lead_touchpoints").insert({
    lead_id: leadId,
    touchpoint_type: type,
    touchpoint_source: "callback",
    raw_payload_json: payload,
    occurred_at: new Date(at).toISOString(),
  })
}

export async function markCallbackDone(supabase: SupabaseClient, leadId: string, how: "connected" | "dismissed" | "called" | "heard", detail?: string) {
  await record(supabase, leadId, "callback_done", { how, detail: detail ?? null })
}

export async function snoozeCallback(supabase: SupabaseClient, leadId: string) {
  await record(supabase, leadId, "callback_snooze", { until: new Date(Date.now() + SNOOZE_MS).toISOString() })
}

/** What the ring says: the customer's name, or the last four digits when we have no name. */
export function spokenName(open: Pick<OpenCallback, "name" | "phone">): string {
  const name = open.name.trim()
  if (/[a-z一-鿿]/i.test(name) && !/^unknown/i.test(name)) return name
  const digits = open.phone.replace(/\D/g, "")
  return digits.length >= 4 ? `尾号 ${digits.slice(-4).split("").join(" ")} 的客人` : "一位客人"
}

/** The App identities to ring: the active admins (today the owner, agent_darrien on his phone). */
async function ownerTargets(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase.from("workbench_members").select("id, name").eq("active", true).eq("role", "admin")
  const ids = ((data ?? []) as Array<{ id: string; name: string }>).map((m) => identityForActor({ alias: m.name, memberId: m.id }))
  return ids.length > 0 ? ids.slice(0, 2) : agentIdentities().slice(0, 1)
}

function twilioAuth(): { sid: string; header: string } | null {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) return null
  return { sid, header: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` }
}

/** Did we reach this number by phone since `since` (an answered call to it from the 213 line or the App)? */
async function calledSince(phone: string, since: number): Promise<boolean> {
  const auth = twilioAuth()
  if (!auth) return false
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${auth.sid}/Calls.json?To=${encodeURIComponent(phone)}&PageSize=20`, {
    headers: { Authorization: auth.header },
    cache: "no-store",
  })
  if (!res.ok) return false
  const data = (await res.json().catch(() => ({}))) as { calls?: Array<{ status: string; duration: string | null; start_time: string | null; date_created: string }> }
  return (data.calls ?? []).some((c) => {
    const at = Date.parse(c.start_time ?? c.date_created)
    return at > since && (c.status === "in-progress" || (c.status === "completed" && Number(c.duration ?? 0) > 0))
  })
}

export type RingOutcome = { rang: boolean; skipped?: string; attempt?: number; callSids?: string[]; error?: string }

export async function ringIfDue(supabase: SupabaseClient, leadId: string, now = Date.now()): Promise<RingOutcome> {
  const open = await openCallback(supabase, leadId)
  if (!open) return { rang: false, skipped: "none_open" }
  if (now - open.requestedAt > REQUEST_TTL_MS) return { rang: false, skipped: "stale" }
  if (!withinRingHours(now, isAlarm(open.why) ? LIVE_PARTY_RING_HOURS_PT : RING_HOURS_PT)) return { rang: false, skipped: "quiet_hours" }
  if (open.rings >= ringsAllowed(open)) return { rang: false, skipped: "max_rings" }
  if (open.lastRingAt !== null && now - open.lastRingAt < RING_EVERY_MS) return { rang: false, skipped: "rang_recently" }
  if (open.snoozeUntil !== null && now < open.snoozeUntil) return { rang: false, skipped: "snoozed" }
  const phone = toE164(open.phone)
  if (!phone) return { rang: false, skipped: "no_phone" }
  if (open.rings > 0 && (await calledSince(phone, open.requestedAt))) {
    await markCallbackDone(supabase, leadId, "called", "an answered call to this number after the request")
    return { rang: false, skipped: "already_called" }
  }
  const auth = twilioAuth()
  const from = process.env.TWILIO_CALLER_ID
  if (!auth || !from) return { rang: false, skipped: "twilio_not_configured" }
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.realhibachi.com"
  const url = `${base}/api/twilio/callback-ring?lead=${encodeURIComponent(leadId)}&step=prompt`
  const callSids: string[] = []
  const targets = await ownerTargets(supabase)
  let error: string | undefined
  for (const id of targets) {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${auth.sid}/Calls.json`, {
      method: "POST",
      headers: { Authorization: auth.header, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: `client:${id}`, From: from, Url: url, Method: "POST", Timeout: "25" }),
      cache: "no-store",
    })
    const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string }
    if (res.ok && data.sid) callSids.push(data.sid)
    else error = data.message ?? `twilio ${res.status}`
  }
  if (callSids.length === 0) return { rang: false, error: error ?? "no_targets" }
  await record(supabase, leadId, "callback_ring", { attempt: open.rings + 1, callSids, targets }, now)
  return { rang: true, attempt: open.rings + 1, callSids }
}

/** A customer asked for a call (or the desk says they want one): open a request and ring now if due. */
export async function requestCallback(
  supabase: SupabaseClient,
  input: { leadId: string; phone: string; name: string; why: string; source: string },
): Promise<RingOutcome> {
  const now = Date.now()
  const open = await openCallback(supabase, input.leadId)
  // The chef-notice alarm lives on the order's lead (lib/chef-notices.ts). A customer who asks for a
  // call while one is open there is a request of their own, not a repeat of the alarm: it replaces it
  // (the alarm's line stays in the inbox). The sweep that raises the alarm waits for a customer's.
  const sameKind = !open || isChefNoticeAlarm(open.why) === isChefNoticeAlarm(input.why)
  // Asking again inside 30 minutes is the same request, and it has had its ring (11-24: once).
  if (!open || !sameKind || now - open.requestedAt > DEDUPE_MS) {
    await record(supabase, input.leadId, "callback_request", { phone: input.phone, name: input.name, why: input.why.slice(0, 500), source: input.source }, now)
  }
  return ringIfDue(supabase, input.leadId, now)
}

/** lead-watch's 10-minute sweep: ring an open request it has not rung yet, or one he snoozed with 2. */
export async function ringOpenCallbacks(supabase: SupabaseClient, now = Date.now()): Promise<Array<RingOutcome & { leadId: string }>> {
  // The widest window here; ringIfDue holds each request to its own.
  if (!withinRingHours(now, LIVE_PARTY_RING_HOURS_PT)) return []
  const { data } = await supabase
    .from("lead_touchpoints")
    .select("lead_id")
    .eq("touchpoint_type", "callback_request")
    .gte("occurred_at", new Date(now - REQUEST_TTL_MS).toISOString())
    .limit(50)
  const leadIds = [...new Set(((data ?? []) as Array<{ lead_id: string }>).map((r) => r.lead_id))]
  const out: Array<RingOutcome & { leadId: string }> = []
  for (const leadId of leadIds) {
    const r = await ringIfDue(supabase, leadId, now)
    if (r.rang || r.error) out.push({ leadId, ...r })
  }
  return out
}
