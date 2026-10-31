import assert from "node:assert/strict"
import { test } from "node:test"

import { UNASSIGNED_KEY, weekShare } from "../lib/chef-share"

const shift = (orderId: string, date: string, adults: number, kids: number, chefs: number) => ({
  orderId,
  date,
  eventStart: `${date}T18:00:00+00:00`,
  customer: orderId,
  address: null,
  counts: { adults, kids },
  team: Array.from({ length: chefs }, (_, i) => ({ id: String(i) })),
  orderStatus: "active",
})

const WEEK = ["2026-11-02", "2026-11-08"] as const

test("a chef's share is their heads over the whole week, kids at half", () => {
  const r = weekShare(
    [
      { id: "b", name: "Blu", shifts: [shift("a", "2026-11-05", 16, 6, 1)] },
      { id: "e", name: "Eason", shifts: [shift("c", "2026-11-06", 19, 0, 1)] },
    ],
    [],
    ...WEEK,
  )
  assert.equal(r.totalHeads, 38)
  assert.deepEqual(r.slices.map((s) => [s.label, s.heads, s.ratio]), [["Blu", 19, 0.5], ["Eason", 19, 0.5]])
})

test("two chefs split a party, and the party is counted once", () => {
  const r = weekShare(
    [
      { id: "g", name: "Gary", shifts: [shift("a", "2026-11-03", 28, 0, 2)] },
      { id: "y", name: "易非", shifts: [shift("a", "2026-11-03", 28, 0, 2)] },
    ],
    [],
    ...WEEK,
  )
  assert.equal(r.partyCount, 1)
  assert.equal(r.totalHeads, 28)
  assert.deepEqual(r.slices.map((s) => s.heads), [14, 14])
  assert.equal(r.slices[0].parties[0].wholeHeads, 28)
})

test("unassigned orders stay in the total, as their own slice", () => {
  const order = { id: "x", customer_name: "Irene", event_start: "2026-11-08T14:00:00+00:00", event_address: null, guest_adult_count: 25, guest_child_count: 2, order_status: "active" }
  const r = weekShare([{ id: "b", name: "Blu", shifts: [shift("a", "2026-11-05", 26, 0, 1)] }], [order], ...WEEK)
  assert.equal(r.totalHeads, 52)
  assert.equal(r.slices.at(-1)?.key, UNASSIGNED_KEY)
  assert.equal(r.slices.at(-1)?.ratio, 0.5)
})

test("other weeks, cancelled parties and logistics stay out", () => {
  const cancelled = { ...shift("c", "2026-11-04", 50, 0, 1), orderStatus: "cancelled" }
  const r = weekShare(
    [
      { id: "b", name: "Blu", shifts: [shift("a", "2026-11-09", 20, 0, 1), cancelled] },
      { id: "z", name: "张阿姨", role: "logistics", shifts: [shift("d", "2026-11-04", 20, 0, 1)] },
    ],
    [],
    ...WEEK,
  )
  assert.deepEqual(r.slices, [])
  assert.equal(r.totalHeads, 0)
})

test("the 30-40 target applies to Blu, Gary and John only", () => {
  const r = weekShare(
    [
      { id: "b", name: "Blu", shifts: [shift("a", "2026-11-03", 29, 0, 1)] },
      { id: "g", name: "Gary", shifts: [shift("b", "2026-11-03", 40, 0, 1)] },
      { id: "j", name: "John", shifts: [shift("c", "2026-11-03", 41, 0, 1)] },
      { id: "e", name: "Eason", shifts: [shift("d", "2026-11-03", 7, 0, 1)] },
    ],
    [],
    ...WEEK,
  )
  assert.deepEqual(r.slices.map((s) => s.target), ["low", "ok", "high", null])
})

test("two weeks together scale the target and add up across the weeks", () => {
  const r = weekShare(
    [
      { id: "b", name: "Blu", shifts: [shift("a", "2026-10-29", 50, 0, 1), shift("b", "2026-11-05", 20, 0, 1)] },
      { id: "j", name: "John", shifts: [shift("c", "2026-11-05", 41, 0, 1)] },
    ],
    [],
    "2026-10-26",
    "2026-11-08",
    2,
  )
  assert.deepEqual(r.slices.map((s) => [s.label, s.heads, s.target]), [["Blu", 70, "ok"], ["John", 41, "low"]])
})

test("part-timers fold into one slice but keep their names on the parties", () => {
  const r = weekShare(
    [
      { id: "n", name: "Niko", shifts: [shift("a", "2026-11-03", 10, 0, 1)] },
      { id: "d", name: "David", shifts: [shift("b", "2026-11-04", 10, 0, 1)] },
    ],
    [],
    ...WEEK,
  )
  assert.equal(r.slices.length, 1)
  assert.deepEqual(r.slices[0].parties.map((p) => p.chefName), ["Niko", "David"])
})
