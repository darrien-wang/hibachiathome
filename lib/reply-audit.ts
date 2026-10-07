import type { SupabaseClient } from "@supabase/supabase-js"
import { notAQuestion } from "@/lib/courtesy-text"
import { CUSTOMER_FORM_TYPES } from "@/lib/customer-forms"
import { toE164, type LastByPeer } from "@/lib/sms-thread"

// 收件箱防沉默（老板 2026-10-07："先做 1、2、4"）.
//
// The inbox decides who is waiting from Twilio's newest messages plus a few
// judgement calls (tapback, courtesy, hold). In the week to 10-07 three of
// those calls hid real customers for 18-52 hours: photos followed by a
// "Loved …", a question followed by "thanks", a reply sent through the
// website. Each was fixed once found, but the next one will not announce
// itself. So two things live here:
//
// 1. A second, content-blind check. It reads the timeline instead of Twilio -
//    every sms_inbound / email_inbound / website form the webhooks wrote down -
//    and asks per lead: did anything go out from us after the customer's
//    message? It checks EVERY message in the open turn, not only the newest, so
//    a reaction or a "thanks" cannot hide a question. Whatever is open 15+
//    minutes and is not on the inbox already is a blind spot; the inbox lists
//    it as "audit" (漏网). Only explicit decisions silence it: the 不用回
//    watermark, a hold, a junk lead.
// 2. shouldRing: the longer a customer waits, the more the phone rings - it
//    used to be the opposite (rang three hours, then silent, gone after 24).

export type AuditItem = {
  at: string
  kind: "sms" | "email" | "form"
  /** touchpoint_type */
  type: string
  body: string
  media: number
}

export type AuditLead = {
  id: string
  phone: string | null
  status: string | null
  full_name: string | null
  email: string | null
  acked_until: string | null
  hold_until: string | null
  hold_set_at: string | null
}

export type OpenTurn = { lead: AuditLead; first: AuditItem; count: number }

const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN)

/** Photos always need an answer; tapbacks, STOP / cancel and a bare "thanks" do not. Emails and forms always do. */
export function needsAnswer(it: AuditItem): boolean {
  if (it.kind !== "sms") return true
  if (it.media > 0) return true
  return !notAQuestion(it.body)
}

/**
 * The oldest message in the open turn that needs an answer - "open" meaning
 * nothing went out from us after it - with how many there are, or null.
 */
export function openTurn(items: AuditItem[], lastOutAt: string | null): { first: AuditItem; count: number } | null {
  const out = ms(lastOutAt)
  const open = items
    .filter((it) => (!Number.isFinite(out) || ms(it.at) > out) && needsAnswer(it))
    .sort((a, b) => ms(a.at) - ms(b.at))
  return open.length ? { first: open[0], count: open.length } : null
}

/** The decisions a person made that silence a message: 不用回 up to a moment, a hold set after it, a junk lead. */
export function silencedByDecision(lead: AuditLead, at: string, now: number): boolean {
  if (lead.status === "disqualified") return true
  const acked = ms(lead.acked_until)
  if (Number.isFinite(acked) && acked >= ms(at)) return true
  const until = ms(lead.hold_until)
  if (Number.isFinite(until) && until > now) {
    // A hold is the customer's own pace; a message after it was set breaks it.
    const set = ms(lead.hold_set_at)
    if (!Number.isFinite(set) || ms(at) <= set) return true
  }
  return false
}

// ---- ring policy -------------------------------------------------------------
// The phone re-rings an alert every 15 minutes while `ring` is true and drops it
// once the server stops listing it (InboxMonitorService). So: ring the first
// three hours, then open a 14-minute window every three hours - one more ring
// each time - between 8 AM and 11 PM PT, until someone answers or marks it.
export const RING_FIRST_MIN = 180
export const RING_EVERY_MIN = 180
export const RING_WINDOW_MIN = 14
const PT_HOUR = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hourCycle: "h23" })

export function ptHour(nowMs: number): number {
  return Number(PT_HOUR.format(nowMs)) % 24
}

export function shouldRing(waitedMin: number, nowMs: number): boolean {
  if (waitedMin <= RING_FIRST_MIN) return true
  const h = ptHour(nowMs)
  if (h < 8 || h >= 23) return false
  return (waitedMin - RING_FIRST_MIN) % RING_EVERY_MIN < RING_WINDOW_MIN
}

// ---- loader --------------------------------------------------------------------
const AUDIT_LOOKBACK_MS = 7 * 24 * 3600_000
export const AUDIT_MIN_AGE_MS = 15 * 60_000
const IN_TYPES = ["sms_inbound", "email_inbound", ...CUSTOMER_FORM_TYPES]
// Anything that reached the customer from us. Twilio's newest outbound per
// number is added on top, so a text sent from anywhere counts.
const OUT_TYPES = ["sms_outbound", "email_outbound", "agent_first_response", "landing_quote_text"]
const TEST_NAME = /not a customer|auto-test|claude|test ignore/i
const isTestNumber = (e164: string | null) => Boolean(e164 && /^\+1\d{3}555\d{4}$/.test(e164))

let cache: { at: number; turns: OpenTurn[] } | null = null

type Row = { lead_id: string; touchpoint_type: string; occurred_at: string; raw_payload_json: Record<string, unknown> | null }

function toItem(r: Row): AuditItem {
  const p = r.raw_payload_json ?? {}
  const str = (v: unknown) => (typeof v === "string" ? v : "")
  if (r.touchpoint_type === "sms_inbound") {
    return { at: r.occurred_at, kind: "sms", type: r.touchpoint_type, body: str(p.Body ?? p.body), media: Number(p.NumMedia ?? 0) || 0 }
  }
  if (r.touchpoint_type === "email_inbound") {
    return { at: r.occurred_at, kind: "email", type: r.touchpoint_type, body: `${str(p.subject)} — ${str(p.snippet ?? p.text)}`, media: 0 }
  }
  return { at: r.occurred_at, kind: "form", type: r.touchpoint_type, body: "", media: 0 }
}

/**
 * Every lead whose customer said something that needs an answer, nothing went
 * out from us after it, it is 15+ minutes old, and no person silenced it.
 * Cached a few minutes: the phone polls every 10-30 s and the answer only
 * changes when someone replies.
 */
export async function findOpenTurns(
  supabase: SupabaseClient,
  now: number,
  byPeer: Map<string, LastByPeer>,
  maxAgeMs = 5 * 60_000,
): Promise<OpenTurn[]> {
  if (cache && now - cache.at < maxAgeMs) return cache.turns
  const { data } = await supabase
    .from("lead_touchpoints")
    .select("lead_id, touchpoint_type, occurred_at, raw_payload_json")
    .in("touchpoint_type", [...IN_TYPES, ...OUT_TYPES])
    .gte("occurred_at", new Date(now - AUDIT_LOOKBACK_MS).toISOString())
    .order("occurred_at", { ascending: false })
    .limit(5000)
  const byLead = new Map<string, { items: AuditItem[]; lastOutAt: string | null }>()
  for (const r of (data ?? []) as Row[]) {
    if (!r.lead_id) continue
    const g = byLead.get(r.lead_id) ?? { items: [], lastOutAt: null }
    if (OUT_TYPES.includes(r.touchpoint_type)) {
      if (!g.lastOutAt || ms(r.occurred_at) > ms(g.lastOutAt)) g.lastOutAt = r.occurred_at
    } else {
      g.items.push(toItem(r))
    }
    byLead.set(r.lead_id, g)
  }
  // Leads with something newer than our last touchpoint; Twilio may still show a reply.
  const candidates = Array.from(byLead).filter(([, g]) => openTurn(g.items, g.lastOutAt))
  const turns: OpenTurn[] = []
  if (candidates.length) {
    const { data: leads } = await supabase
      .from("leads")
      .select("id, phone, status, full_name, email, acked_until, hold_until, hold_set_at")
      .in("id", candidates.map(([id]) => id))
    const leadById = new Map(((leads ?? []) as AuditLead[]).map((l) => [l.id, l]))
    for (const [id, g] of candidates) {
      const lead = leadById.get(id)
      if (!lead) continue
      const phone = toE164(lead.phone)
      if (isTestNumber(phone) || TEST_NAME.test(lead.full_name ?? "")) continue
      const tw = phone ? byPeer.get(phone) : undefined
      const lastOut = [g.lastOutAt, tw?.lastOutAt ?? null].reduce<string | null>((a, b) => (!b ? a : !a || ms(b) > ms(a) ? b : a), null)
      const turn = openTurn(g.items, lastOut)
      if (!turn) continue
      if (now - ms(turn.first.at) < AUDIT_MIN_AGE_MS) continue
      if (silencedByDecision(lead, turn.first.at, now)) continue
      turns.push({ lead, ...turn })
    }
  }
  cache = { at: now, turns }
  return turns
}
