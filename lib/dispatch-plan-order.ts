import { payableHeads } from "@/lib/chef-pay"
import { partyHeadCounts, type OrderForHeads } from "@/lib/party-heads"
import { effectivePlan, lintStaffing, type DispatchPlan, type LintIssue } from "@/lib/dispatch-plan"

// The dispatch plan read off an order row (marketing side). The rule, the
// promise parser and the lint live in lib/dispatch-plan.ts (mirrored with the
// invoice repo); this file only knows how this repo stores orders.

export type OrderForPlan = OrderForHeads & {
  event_start?: string | null
  dispatch_plan?: unknown
}

/** Paid heads of the party as the order stands (adults + half the paying kids). */
export function orderPaidHeads(o: OrderForHeads): number {
  return payableHeads(partyHeadCounts(o))
}

/** The plan to act on: rule plans follow today's headcount, owner / promise plans stand. */
export function planForOrder(o: OrderForPlan): DispatchPlan {
  return effectivePlan(o.dispatch_plan ?? null, orderPaidHeads(o))
}

/**
 * Hours until the party. event_start is a Pacific wall-clock time stored as if
 * it were UTC, so "now" has to be expressed the same way before subtracting.
 */
export function hoursToParty(eventStart: string | null | undefined, now: Date = new Date()): number | null {
  if (!eventStart) return null
  const start = Date.parse(eventStart)
  if (!Number.isFinite(start)) return null
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(now)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  const nowWall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"))
  return (start - nowWall) / 3_600_000
}

export type OrderStaffingCounts = { cooks: number; helpers: number }

/** The staffing lint for one order: plan vs who is assigned, blocking inside 72 h of the party. */
export function lintOrderStaffing(o: OrderForPlan, counts: OrderStaffingCounts, now: Date = new Date()): LintIssue[] {
  return lintStaffing({
    plan: planForOrder(o),
    heads: orderPaidHeads(o),
    cooks: counts.cooks,
    helpers: counts.helpers,
    hoursToParty: hoursToParty(o.event_start, now),
  })
}
