// The 10-14 tier closed on 2026-11-02 (owner, D-1102-01). New quotes do not
// have it; a lead from before was quoted with it and locks at that price.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { CLOSED_PARTY_TIER, PARTY_SIZE_DISCOUNT_TIERS, calcSimpleEstimate, partySizeDiscount, partySizeDiscountLabel, quotedBeforeTierClosed } from "../config/pricing-rules"

const total = (adults: number, weekdaySpecial = false) => calcSimpleEstimate({ adults, kids: 0, weekdaySpecial }).total

test("the ladder starts at 15 with $60", () => {
  assert.equal(PARTY_SIZE_DISCOUNT_TIERS[0].minGuests, 15)
  assert.equal(PARTY_SIZE_DISCOUNT_TIERS[0].amount, 60)
  for (const adults of [10, 11, 12, 13, 14]) {
    assert.equal(partySizeDiscount({ adults, kids: 0 }), 0, `${adults}`)
    assert.equal(partySizeDiscountLabel({ adults, kids: 0 }), null, `${adults}`)
  }
  assert.equal(partySizeDiscount({ adults: 15, kids: 0 }), 60)
})

test("what a party of 10-15 bills now", () => {
  assert.equal(total(10), 599)
  assert.equal(total(12), 718.8)
  assert.equal(total(12, true), 658.8)
  assert.equal(total(14), 838.6)
  assert.equal(total(15), 838.5, "the 15th adult comes in free: ten cents under 14")
})

test("a lead from before the tier closed was quoted with it, a later one was not", () => {
  assert.equal(quotedBeforeTierClosed("2026-11-02T16:48:00Z"), true, "08:48 PT")
  assert.equal(quotedBeforeTierClosed(CLOSED_PARTY_TIER.closedAt), false)
  assert.equal(quotedBeforeTierClosed("2026-11-03T00:00:00Z"), false)
  assert.equal(quotedBeforeTierClosed(null), false)
  assert.equal(quotedBeforeTierClosed("not a date"), false)
})
