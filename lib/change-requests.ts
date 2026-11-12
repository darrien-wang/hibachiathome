import { wallToInstant } from "@/lib/first-response"
import { shouldRingAwake } from "@/lib/reply-audit"

// Customer change requests in the inbox (order-flow rebuild 2026-11-11, D-1111-03).
//
// invoice_update_requests rows the customer filed from the party page, open
// while their status is received (nobody has looked) or confirmed_in_progress
// (looked, chef not told yet). The inbox used to list them for 24 hours and
// never ring: on 11-11 twelve were still open, and the one that mattered -
// Joyce's, filed 33 hours before her party and held for a person
// (request_source order_page_within_48h, D-1106-02) - had dropped off the list
// a day before the chef loaded his van from the old sheet.
//
// Now an open request stays until it is handled, with what changed in the
// line, and a held one rings like a customer waiting on us. It only leaves
// when nothing can be done about it any more: the order is cancelled, or the
// party started three hours ago. Pure rules here; lib/inbox.ts does the reading.

/** A submit made within 48 hours of the party: nothing is written to the order until a person confirms it. */
export const HELD_REQUEST_SOURCE = "order_page_within_48h"
export const OPEN_REQUEST_STATUSES = ["received", "confirmed_in_progress"] as const
/** A request tied to no order cannot be judged by its party; it keeps the old one-day window. */
export const ORPHAN_REQUEST_LOOKBACK_MS = 24 * 3600_000
/** Three hours into the party a change to it is history. */
export const PARTY_PAST_MS = 3 * 3600_000

export type ChangeRequestLite = { status: string; request_source: string | null; created_at: string }
export type ChangeOrderLite = { event_start: string | null; order_status: string | null }

export function isHeldRequest(r: Pick<ChangeRequestLite, "request_source">): boolean {
  return r.request_source === HELD_REQUEST_SOURCE
}

/** Still something a person can act on. event_start is the PT wall clock stored as UTC: converted before it meets now. */
export function changeRequestOpen(r: ChangeRequestLite, order: ChangeOrderLite | null | undefined, now: number): boolean {
  if (!(OPEN_REQUEST_STATUSES as readonly string[]).includes(r.status)) return false
  if (!order) return now - Date.parse(r.created_at) <= ORPHAN_REQUEST_LOOKBACK_MS
  if (order.order_status === "cancelled") return false
  if (!order.event_start) return true // date on hold: the party is still to come
  const start = wallToInstant(order.event_start)
  return !Number.isFinite(start) || now - start <= PARTY_PAST_MS
}

/**
 * Whether it rings. A held change is a customer waiting on us with a party
 * inside two days, so it follows the same policy as an unanswered text
 * (lib/reply-audit.ts shouldRing): the first three hours, then a window every
 * three hours - but never at night (shouldRingAwake): a party page saved at
 * 1 AM is on the list and rings from 7, for its first three hours from then.
 * Anything else was already applied to the order when it was filed and stays
 * a quiet line, as before.
 */
export function changeRequestRings(r: ChangeRequestLite, waitedMinutes: number, now: number): boolean {
  return isHeldRequest(r) && shouldRingAwake(waitedMinutes, now)
}

const BLANK_BEFORE = /^(not provided|latest stored values|none|n\/a|-|—)?$/i
const NO_CHANGE = "摘要：没有实质改动"
const clean = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v)).replace(/\s+/g, " ").trim()

/**
 * change_summary in one line. Today it is a list of { field, label, before,
 * after }; card B turns the entries into plain sentences ("Makiko 加龙虾尾"), and
 * a list of strings reads the same way. "No material changes" is said as such -
 * until card B ships that verdict does not look at the menu.
 */
export function changeSummaryText(summary: unknown, max = 160): string {
  const items = Array.isArray(summary) ? summary : summary == null ? [] : [summary]
  const parts: string[] = []
  let nothing = false
  for (const it of items) {
    if (typeof it === "string") {
      if (clean(it)) parts.push(clean(it))
      continue
    }
    if (!it || typeof it !== "object") continue
    const r = it as Record<string, unknown>
    if (r.field === "no_material_changes") {
      nothing = true
      continue
    }
    const label = clean(r.label ?? r.field)
    const before = clean(r.before ?? r.from)
    const after = clean(r.after ?? r.to ?? r.text ?? r.message)
    if (!after && !label) continue
    const change = before && !BLANK_BEFORE.test(before) && after ? `${before} → ${after}` : after
    parts.push(label && change ? `${label}: ${change}` : label || change)
  }
  if (!parts.length) return nothing ? NO_CHANGE : ""
  const text = parts.join("；")
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

const LOCK_NOTE = /^\s*⏰ WITHIN 48H OF EVENT[^\n]*(?:\n+|$)/
const PLANNER_SUMMARY_MARK = "Submitted from the party planner"

/**
 * What the customer typed with the request: the party page's own 48-hour line
 * in front and its "Submitted from the party planner: …" line behind are not
 * theirs (the invoice app's lib/order-customer-notes.ts reads it the same way).
 */
export function customerNoteOf(message: string | null | undefined): string {
  const text = String(message ?? "").replace(/\r\n?/g, "\n").replace(LOCK_NOTE, "")
  const at = text.lastIndexOf(PLANNER_SUMMARY_MARK)
  return (at < 0 ? text : text.slice(0, at)).replace(/\s+/g, " ").trim()
}

/**
 * The inbox line for one order's open requests (oldest first): what changed,
 * then what they wrote. A customer who submits three times is one line - each
 * difference and each note once, and "no material changes" only when none of
 * the submits found any.
 */
export function changeRequestBody(rows: Array<{ change_summary: unknown; customer_message: string | null }>, max = 200): string {
  const uniq = (list: string[]) => [...new Set(list.filter(Boolean))]
  const summaries = uniq(rows.map((r) => changeSummaryText(r.change_summary)))
  const real = summaries.filter((s) => s !== NO_CHANGE)
  const notes = uniq(rows.map((r) => customerNoteOf(r.customer_message)))
  const text = [(real.length ? real : summaries).join("；"), notes.length ? `留言：${notes.join(" / ")}` : ""].filter(Boolean).join(" · ")
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
