// Layer-2 self-test: rented tables / tableware count inside the $599 minimum
// and before the party-size discount, the way the invoice bills them
// (audit item 18, D-1009-04: 10 adults + full setup is $719, not $749).
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { calcSimpleEstimate, FULL_SETUP_PER_GUEST } from "../config/pricing-rules"

test("rentals · 10 adults with the full setup is $719, like the invoice and /quote", () => {
  const est = calcSimpleEstimate({ adults: 10, kids: 0, weekdaySpecial: false, rentals: 10 * FULL_SETUP_PER_GUEST })
  assert.equal(est.subtotal, 599)
  assert.equal(est.total, 719)
  assert.equal(est.minApplied, false)
})

test("rentals · without rentals nothing changes", () => {
  const est = calcSimpleEstimate({ adults: 10, kids: 0, weekdaySpecial: false })
  assert.equal(est.total, 599)
  assert.equal(est.minApplied, true)
})

test("rentals · a small party: rentals fill the minimum before it is charged", () => {
  // 6 adults = $359.40 food + $90 setup = $449.40, under $599 -> $599
  const est = calcSimpleEstimate({ adults: 6, kids: 0, weekdaySpecial: false, rentals: 6 * FULL_SETUP_PER_GUEST })
  assert.equal(est.total, 599)
  assert.equal(est.minApplied, true)
})
