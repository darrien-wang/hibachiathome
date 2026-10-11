import assert from "node:assert/strict"
import { test } from "node:test"

import { logisticsOpenRows, logisticsRow, sumCents, sumHeads } from "../lib/logistics-pay"

const order = (id: string, date: string | null, adults: number, kids = 0, extra: Record<string, unknown> = {}) => ({
  id,
  order_no: `RH-${id}`,
  customer_name: id,
  event_start: date ? `${date}T18:00:00+00:00` : null,
  order_status: "active",
  invoice_data: { mode: "detailed", guests: [], adultCount: adults, childCount: kids },
  ...extra,
})

test("logisticsRow: 27 adults at $1 a head is $27", () => {
  const r = logisticsRow(order("a", "2026-10-10", 27), 100)
  assert.equal(r.heads, 27)
  assert.equal(r.cents, 2700)
})

test("logisticsRow: a paying kid is half a head, a free little is none", () => {
  const o = {
    id: "b",
    event_start: "2026-10-10T18:00:00+00:00",
    invoice_data: { mode: "detailed", guests: [{}, {}, { isChild: true }, { isChild: true }, { isChild: true, isLittle: true }] },
  }
  const r = logisticsRow(o, 100)
  assert.deepEqual([r.adults, r.kids, r.littles, r.heads, r.cents], [2, 2, 1, 3, 300])
})

test("logisticsOpenRows: held parties from the start date, each paid once; this week's later ones only previewed", () => {
  const orders = [
    order("before", "2026-10-04", 30),
    order("held", "2026-10-06", 20, 3),
    order("paid", "2026-10-07", 15),
    order("today", "2026-10-11", 27),
    order("cancelled", "2026-10-09", 40, 0, { order_status: "cancelled" }),
    order("nodate", null, 12),
    order("nextweek", "2026-10-17", 18),
  ]
  const { open, upcoming } = logisticsOpenRows(orders, { perHeadCents: 100, startYmd: "2026-10-05", throughYmd: "2026-10-11", untilYmd: "2026-10-11", paidOrderIds: ["paid"] })
  assert.deepEqual(open.map((r) => r.orderId), ["held", "today"])
  assert.equal(upcoming.length, 0)
  assert.equal(sumHeads(open), 48.5)
  assert.equal(sumCents(open), 4850)

  const midweek = logisticsOpenRows(orders, { perHeadCents: 100, startYmd: "2026-10-05", throughYmd: "2026-10-08", untilYmd: "2026-10-11", paidOrderIds: [] })
  assert.deepEqual(midweek.open.map((r) => r.orderId), ["held", "paid"])
  assert.deepEqual(midweek.upcoming.map((r) => r.orderId), ["today"])
})
