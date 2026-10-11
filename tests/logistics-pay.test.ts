import assert from "node:assert/strict"
import { test } from "node:test"

import { logisticsLedgerRows, logisticsRow, sumCents, sumHeads } from "../lib/logistics-pay"

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

test("logisticsLedgerRows: only the orders marked as hers are owed, each paid once", () => {
  const orders = [
    order("old-unmarked", "2026-09-20", 30),
    order("old-marked", "2026-09-21", 10),
    order("held", "2026-10-06", 20, 3),
    order("paid", "2026-10-07", 15),
    order("not-hers", "2026-10-10", 40),
    order("today", "2026-10-11", 27),
    order("cancelled", "2026-10-09", 40, 0, { order_status: "cancelled" }),
    order("nodate", null, 12),
    order("next-marked", "2026-10-17", 18),
    order("next-unmarked", "2026-10-18", 18),
    order("far", "2026-11-20", 18),
  ]
  const { open, upcoming, candidates } = logisticsLedgerRows(orders, {
    perHeadCents: 100,
    todayYmd: "2026-10-11",
    sinceYmd: "2026-09-27",
    untilYmd: "2026-10-18",
    markedOrderIds: ["old-marked", "held", "paid", "today", "cancelled", "next-marked"],
    paidOrderIds: ["paid"],
  })
  assert.deepEqual(open.map((r) => r.orderId), ["old-marked", "held", "today"])
  assert.deepEqual(upcoming.map((r) => r.orderId), ["next-marked"])
  assert.deepEqual(candidates.map((r) => r.orderId), ["not-hers", "next-unmarked"])
  assert.equal(sumHeads(open), 58.5)
  assert.equal(sumCents(open), 5850)
})
