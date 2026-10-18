// The dispatch plan on this side: the staffing rule is the quote wording's
// constant (config/pricing-rules GUESTS_PER_CHEF, pinned by the invoice repo's
// fixture), the promise parser reads what the desk actually texted, and the
// lint says when dispatch falls short of the plan.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { calcChefCount, GUESTS_PER_CHEF } from "../config/pricing-rules"
import { applyPromise, lintStaffing, parseStaffingPromise, ruleChefs, rulePlan } from "../lib/dispatch-plan"
import { hoursToParty, lintOrderStaffing, orderPaidHeads, planForOrder } from "../lib/dispatch-plan-order"

const fixture = JSON.parse(readFileSync("tests/fixtures/bills.json", "utf8")) as { constants: Record<string, number | string> }

test("mirror · GUESTS_PER_CHEF is the invoice engine's", () => {
  assert.equal(GUESTS_PER_CHEF, fixture.constants.GUESTS_PER_CHEF)
  assert.equal(GUESTS_PER_CHEF, 28)
})

test("rule · the plan's chef count and the quote's calcChefCount agree at every party size that matters", () => {
  for (const n of [1, 8, 20, 28, 29, 40, 56, 57, 60, 84, 85]) {
    assert.equal(ruleChefs(n), calcChefCount(n), `${n} guests`)
  }
  assert.equal(rulePlan(30).grills, 2)
})

test("order · paid heads and the plan off an order row (Eileen: 29 adults + 2 kids, no plan column)", () => {
  const eileen = { guest_adult_count: 29, guest_child_count: 2, invoice_data: { mode: "detailed", adultCount: 29, childCount: 2, guests: [] }, event_start: "2026-10-17T18:00:00+00:00", dispatch_plan: null }
  assert.equal(orderPaidHeads(eileen), 30)
  assert.equal(planForOrder(eileen).chefs, 2)
  assert.equal(planForOrder({ ...eileen, dispatch_plan: { chefs: 1, grills: 1, source: "owner" } }).chefs, 1)
})

test("order · hours to the party compare Pacific wall clocks (event_start is stored as if UTC)", () => {
  // 2026-10-17 18:00 PT is 2026-10-18 01:00 UTC; at 2026-10-17 10:00 PT (17:00Z) the party is 8 hours out.
  const h = hoursToParty("2026-10-17T18:00:00+00:00", new Date("2026-10-17T17:00:00Z"))
  assert.equal(Math.round((h ?? 0) * 10) / 10, 8)
  assert.equal(hoursToParty(null), null)
})

test("order · lint: Eileen as dispatched the day before (promise 2/2, one lead chef + helper) blocks", () => {
  const plan = applyPromise(null, { chefs: 2, grills: 2, text: "two stations", sid: "SM423f", at: "2026-10-07T21:04:26Z", via: "sms" }, 30, "2026-10-16T00:00:00Z")
  const order = { guest_adult_count: 29, guest_child_count: 2, invoice_data: null, event_start: "2026-10-17T18:00:00+00:00", dispatch_plan: plan }
  const issues = lintOrderStaffing(order, { cooks: 1, helpers: 1 }, new Date("2026-10-17T02:00:00Z")) // 10-16 19:00 PT
  assert.deepEqual(issues.map((x) => [x.code, x.severity]), [["second_cook_missing", "blocking"], ["promise_unmet", "blocking"]])
  assert.deepEqual(lintOrderStaffing(order, { cooks: 2, helpers: 1 }, new Date("2026-10-17T02:00:00Z")), [])
})

test("promise · the desk's own texts", () => {
  assert.deepEqual(pick(parseStaffingPromise("Sat, Nov 21 at 5 it is! For 35 we send two chefs, each with their own grill, so everyone's served together.")), [2, 2])
  assert.deepEqual(pick(parseStaffingPromise("5:30 it is - with 60 guests that's 3 chefs, and they'll arrive around 5 to set up so the show starts right on time.")), [3, 3])
  assert.deepEqual(pick(parseStaffingPromise("for 50-60 guests we'd bring 2-3 chefs with their own grills.")), [3, 3])
  assert.deepEqual(pick(parseStaffingPromise("Chefs by the pool works - we'll set the two stations a few feet back from the edge so everyone faces the water and the show.")), [2, 2])
  assert.equal(parseStaffingPromise("28 guests is one chef and one grill - past 28 it becomes two chefs and two grills."), null)
  assert.equal(parseStaffingPromise("Your chef arrives about 10 minutes before start time."), null)
})

test("lint · a one-chef owner plan on 30 heads is flagged against the rule, one week out as a warning", () => {
  const issues = lintStaffing({ plan: { chefs: 1, grills: 1, source: "owner" }, heads: 30, cooks: 1, helpers: 0, hoursToParty: 7 * 24 })
  assert.deepEqual(issues.map((x) => [x.code, x.severity]), [["grills_below_rule", "warning"]])
})

function pick(p: { chefs: number; grills: number } | null): [number, number] | null {
  return p ? [p.chefs, p.grills] : null
}
