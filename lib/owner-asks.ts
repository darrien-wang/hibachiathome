import type { InboxEvent } from "./inbox"

// 需要你回复 (owner 2026-11-24): "以后能不能给需要我回复的时候在 app 上加个单独的响铃，让我及时的知道，
// 平常你能够自己回复的消息就不用在 app 上做消息提醒了".
//
// The desk answers customers on its own, so the workbench App stops ringing for every new lead and text.
// What reaches the phone now:
//   1. owner asks - a question the desk put to the owner in chat (`desk ask`). They ring the App's own
//      "需要你回复" channel (App 2.3.2+; an older App gets them on the new-lead channel) until the desk
//      marks them answered, or for OWNER_ASK_TTL_HOURS.
//   2. a safety net - a customer or chef still waiting SAFETY_NET_MINUTES after writing, in the daytime,
//      means the desk is not answering (it went down, as the network did on 11-24 06:5x), so the phone
//      rings for it as before.
// Phone calls (请回电, 现场报警) ring through Twilio and are not touched here.

export const OWNER_ASK_TTL_HOURS = 12
export const OWNER_KIND = "owner"
/** The first App build with the "owner" channel (2.3.2; the 2.3.0/2.3.1 builds predate it); older builds would file the kind under "other" (quiet). */
export const OWNER_CHANNEL_MIN_APP = "2.3.2"
export const SAFETY_NET_MINUTES = 30
/** Pacific hours the safety net may ring in: from 07:00 up to (not including) 23:00. */
export const SAFETY_NET_FROM_HOUR = 7
export const SAFETY_NET_UNTIL_HOUR = 23

/** Someone writing to us and waiting on an answer - the kinds that rang loud before 11-24. */
const WAITING_KINDS = new Set(["lead", "call", "sms", "email", "form", "audit", "chef"])
/** Loud only while they ring (a change inside 48 hours nobody confirmed, a chef who has not confirmed). */
const WAITING_WHILE_RINGING = new Set(["order_change", "chef_notice", "chef_unsent"])

export type OwnerAskRow = {
  id: string
  question: string
  lead_id: string | null
  order_no: string | null
  created_at: string
  answered_at: string | null
}

/** What the App receives: the inbox event without the desk-only ids, kind widened to the App's names. */
export type MobileEvent = Omit<InboxEvent, "kind" | "leadId" | "phone" | "orderId" | "justArrived" | "urgent" | "explain"> & {
  kind: string
}

/** "2.3.2" from the App's user agent (`... RealHibachiWorkbenchAndroid/2.3.2-debug`), null for a browser. */
export function appVersionFromUA(ua: string | null | undefined): string | null {
  const m = /RealHibachiWorkbenchAndroid\/(\d+(?:\.\d+)*)/.exec(String(ua ?? ""))
  return m ? m[1] : null
}

export function versionAtLeast(version: string | null, min: string): boolean {
  if (!version) return false
  const a = version.split(".").map((n) => Number(n) || 0)
  const b = min.split(".").map((n) => Number(n) || 0)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0)
    if (d !== 0) return d > 0
  }
  return true
}

const PT_HOUR = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "2-digit", hourCycle: "h23" })
export function ptHour(now: number): number {
  return Number(PT_HOUR.format(new Date(now))) % 24
}

export function isOpenAsk(row: OwnerAskRow, now: number): boolean {
  if (row.answered_at) return false
  const created = Date.parse(row.created_at)
  return Number.isFinite(created) && now - created < OWNER_ASK_TTL_HOURS * 3600_000
}

export function ownerAskEvent(row: OwnerAskRow, now: number, appVersion: string | null): MobileEvent {
  const waited = Math.max(0, Math.floor((now - Date.parse(row.created_at)) / 60_000))
  return {
    key: `owner_ask:${row.id}`,
    kind: versionAtLeast(appVersion, OWNER_CHANNEL_MIN_APP) ? OWNER_KIND : "lead",
    title: "需要你回复",
    body: row.question.trim(),
    url: row.lead_id ? `/admin?tab=leads&lead=${row.lead_id}` : "/admin",
    at: row.created_at,
    waitedMinutes: waited,
    ring: true,
  }
}

/** True when this inbox event should still reach the phone: someone has waited long enough that the desk is not answering. */
export function safetyNetRings(e: Pick<InboxEvent, "kind" | "ring" | "waitedMinutes">, now: number): boolean {
  const waiting = WAITING_KINDS.has(e.kind) || (e.ring && WAITING_WHILE_RINGING.has(e.kind))
  if (!waiting || e.waitedMinutes < SAFETY_NET_MINUTES) return false
  const h = ptHour(now)
  return h >= SAFETY_NET_FROM_HOUR && h < SAFETY_NET_UNTIL_HOUR
}

/** The App's event list: open owner asks first, then the safety net, nothing the desk is handling. */
export function mobileEvents(events: InboxEvent[], asks: OwnerAskRow[], opts: { now: number; appVersion: string | null }): MobileEvent[] {
  const out: MobileEvent[] = asks.filter((r) => isOpenAsk(r, opts.now)).map((r) => ownerAskEvent(r, opts.now, opts.appVersion))
  for (const e of events) {
    if (!safetyNetRings(e, opts.now)) continue
    const { leadId: _l, phone: _p, orderId: _o, justArrived: _j, urgent: _u, explain: _x, ...rest } = e
    out.push({ ...rest, kind: "sms", title: `客服没回 · ${rest.title}` })
  }
  return out
}
