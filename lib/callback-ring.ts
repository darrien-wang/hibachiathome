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
// we found a call with that number). A request is open until a callback_done follows it. lead-watch
// rings an open one again every ten minutes, three rings at most, 8 AM - 10 PM Pacific.

import type { SupabaseClient } from "@supabase/supabase-js"
import { toE164 } from "@/lib/sms-thread"
import { agentIdentities, identityForActor } from "@/lib/twilio-identity"

export const RING_HOURS_PT: [number, number] = [8, 22]
export const RING_EVERY_MS = 10 * 60_000
export const SNOOZE_MS = 10 * 60_000
export const MAX_RINGS = 3
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

export function wantsCall(body: string | null | undefined): boolean {
  const s = (body ?? "").trim()
  return s.length > 0 && ASKS.test(s) && !REFUSES.test(s)
}

function ptHour(ms: number): number {
  const h = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hour12: false }).format(new Date(ms))
  return Number(h) % 24
}

export function withinRingHours(ms: number): boolean {
  const h = ptHour(ms)
  return h >= RING_HOURS_PT[0] && h < RING_HOURS_PT[1]
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
}

type Row = { touchpoint_type: string; occurred_at: string; raw_payload_json: Record<string, unknown> | null }

export async function openCallback(supabase: SupabaseClient, leadId: string): Promise<OpenCallback | null> {
  const { data } = await supabase
    .from("lead_touchpoints")
    .select("touchpoint_type, occurred_at, raw_payload_json")
    .eq("lead_id", leadId)
    .in("touchpoint_type", ["callback_request", "callback_ring", "callback_snooze", "callback_done"])
    .order("occurred_at", { ascending: true })
    .limit(200)
  let open: OpenCallback | null = null
  for (const r of (data ?? []) as Row[]) {
    const at = Date.parse(r.occurred_at)
    const p = r.raw_payload_json ?? {}
    if (r.touchpoint_type === "callback_request") {
      open = { leadId, phone: String(p.phone ?? ""), name: String(p.name ?? ""), why: String(p.why ?? ""), requestedAt: at, rings: 0, lastRingAt: null, snoozeUntil: null }
    } else if (!open) {
      continue
    } else if (r.touchpoint_type === "callback_ring") {
      open.rings += 1
      open.lastRingAt = at
    } else if (r.touchpoint_type === "callback_snooze") {
      const until = Date.parse(String(p.until ?? ""))
      open.snoozeUntil = Number.isFinite(until) ? until : at + SNOOZE_MS
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

export async function markCallbackDone(supabase: SupabaseClient, leadId: string, how: "connected" | "dismissed" | "called", detail?: string) {
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
  if (!withinRingHours(now)) return { rang: false, skipped: "quiet_hours" }
  if (open.rings >= MAX_RINGS) return { rang: false, skipped: "max_rings" }
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
  if (!open || now - open.requestedAt > DEDUPE_MS || open.rings >= MAX_RINGS) {
    await record(supabase, input.leadId, "callback_request", { phone: input.phone, name: input.name, why: input.why.slice(0, 500), source: input.source }, now)
  }
  return ringIfDue(supabase, input.leadId, now)
}

/** lead-watch's 10-minute sweep: ring every open request that is due again. */
export async function ringOpenCallbacks(supabase: SupabaseClient, now = Date.now()): Promise<Array<RingOutcome & { leadId: string }>> {
  if (!withinRingHours(now)) return []
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
