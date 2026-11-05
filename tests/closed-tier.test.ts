// The 10-14 tier closed on 2026-11-02 (owner, D-1102-01). New quotes do not
// have it; a lead from before was quoted with it and locks at that price.
// The rest of the ladder followed on 2026-11-05 (tests/closed-ladder.test.ts).
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { CLOSED_PARTY_LADDER, CLOSED_PARTY_TIER, calcSimpleEstimate, quotedBeforeTierClosed } from "../config/pricing-rules"

const total = (adults: number, weekdaySpecial = false) => calcSimpleEstimate({ adults, kids: 0, weekdaySpecial }).total

test("the closed 10-14 tier sits just under the closed ladder", () => {
  assert.deepEqual(CLOSED_PARTY_TIER, { minGuests: 10, maxGuests: 14, amount: 30, closedAt: "2026-11-02T10:00:00-08:00" })
  assert.equal(CLOSED_PARTY_LADDER[0].minGuests, CLOSED_PARTY_TIER.maxGuests + 1)
})

test("what a party of 10-15 bills now", () => {
  assert.equal(total(10), 599)
  assert.equal(total(12), 718.8)
  assert.equal(total(12, true), 658.8)
  assert.equal(total(14), 838.6)
  assert.equal(total(15), 898.5, "no ladder at 15 either since 2026-11-05")
})

test("a lead from before the tier closed was quoted with it, a later one was not", () => {
  assert.equal(quotedBeforeTierClosed("2026-11-02T16:48:00Z"), true, "08:48 PT")
  assert.equal(quotedBeforeTierClosed(CLOSED_PARTY_TIER.closedAt), false)
  assert.equal(quotedBeforeTierClosed("2026-11-03T00:00:00Z"), false)
  assert.equal(quotedBeforeTierClosed(null), false)
  assert.equal(quotedBeforeTierClosed("not a date"), false)
})
