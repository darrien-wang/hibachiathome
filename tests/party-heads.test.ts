import assert from "node:assert/strict"
import { test } from "node:test"

import { monthlyStats, partyHeadCounts } from "../lib/party-heads"

const detailed = (rows: Array<{ isChild?: boolean; isLittle?: boolean }>, promos: Array<{ label: string }> = []) => ({
  invoice_data: { mode: "detailed", guests: rows, promotions: promos },
})

test("partyHeadCounts: detailed rows - adults, paying kids, free littles", () => {
  const o = detailed([{}, {}, {}, { isChild: true }, { isChild: true, isLittle: true }])
  assert.deepEqual(partyHeadCounts(o), { adults: 3, kids: 1, littles: 1 })
})

test("partyHeadCounts: the under-5 promo line outranks the row flags", () => {
  const o = detailed([{}, { isChild: true }, { isChild: true }, { isChild: true }], [{ label: "Little kids (under 5) free ×2" }])
  assert.deepEqual(partyHeadCounts(o), { adults: 1, kids: 1, littles: 2 })
})

test("partyHeadCounts: no guest rows yet falls back to the headline counts", () => {
  assert.deepEqual(partyHeadCounts({ invoice_data: { mode: "detailed", guests: [], adultCount: 21, childCount: 5 } }), { adults: 21, kids: 5, littles: 0 })
  assert.deepEqual(partyHeadCounts({ invoice_data: { total_cost: 0 }, guest_adult_count: 15, guest_child_count: 2 }), { adults: 15, kids: 2, littles: 0 })
})

test("monthlyStats: adults 1, paying kids 0.5, free kids 0; cancelled out; money only when allowed", () => {
  const orders = [
    { event_start: "2026-09-20T18:00:00+00:00", order_status: "active", quoted_total_cents: 100000, amount_paid_total_cents: 110000, ...detailed([{}, {}, { isChild: true }, { isChild: true, isLittle: true }]) },
    { event_start: "2026-09-27T18:00:00+00:00", order_status: "cancelled", quoted_total_cents: 50000, ...detailed([{}, {}]) },
    { event_start: "2026-10-17T18:00:00+00:00", order_status: "active", quoted_total_cents: 70000, amount_paid_total_cents: 0, invoice_data: { mode: "detailed", guests: [], adultCount: 10, childCount: 3 } },
    { event_start: null, order_status: "active" },
  ]
  const s = monthlyStats(orders, "2026-10-10", true)
  assert.equal(s.length, 2)
  assert.deepEqual(
    { ...s[0] },
    { month: "2026-09", parties: 1, done: 1, adults: 2, kids: 1, littles: 1, heads: 2.5, revenueCents: 100000, doneRevenueCents: 100000, paidCents: 110000, openParties: 0, openHeads: 0, openRevenueCents: 0 },
  )
  assert.equal(s[1].heads, 11.5)
  // not held yet and no menu in: the 11.5 is an estimate, flagged as open
  assert.equal(s[1].openParties, 1)
  assert.equal(s[1].openHeads, 11.5)
  assert.equal(s[1].openRevenueCents, 70000)
  // a held party is a fact whatever the invoice looks like
  assert.equal(s[0].openParties, 0)
  assert.equal(s[1].done, 0)
  assert.equal(s[1].doneRevenueCents, 0)
  const noMoney = monthlyStats(orders, "2026-10-10", false)
  assert.equal(noMoney[0].revenueCents, null)
  assert.equal(noMoney[0].heads, 2.5)
})
