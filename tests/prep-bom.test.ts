import assert from "node:assert/strict"
import { test } from "node:test"

import { BUY_UNITS, aggregatePrep, orderPrep } from "../lib/prep-bom"

// A party where everyone has steak: `adults` adult servings, `kids` kid servings.
const steakLine = (adults: number, kids = 0) => {
  const inv = { mode: "quick", adultCount: adults, childCount: kids, quickCountItems: [{ itemId: "steak", category: "protein", qty: adults, childQty: kids }] }
  const line = orderPrep(inv as never, "2026-10-12T00:00:00Z", adults, kids).items.find((i) => i.id === "steak")
  assert.ok(line, "steak line")
  return line
}
const packsInHint = (alt: string | undefined) => Number(/买 (\d+) 盒/.exec(alt ?? "")?.[1])

test("prep · steak portions are untouched: 4.5 oz an adult, 2.25 oz a kid", () => {
  assert.equal(steakLine(10).qty, 45)
  assert.equal(steakLine(10, 4).qty, 54)
  assert.equal(steakLine(10).unit, "oz")
})

test("prep · steak is bought in Costco top sirloin packs (about 3.2 lb): need x 1.1, rounded up to whole packs", () => {
  assert.equal(steakLine(10).alt, "≈ 2.8 lb，买 1 盒（Costco Top Sirloin ≈3.2lb/盒）") // 45 oz x 1.1 = 49.5 <= 51
  assert.equal(packsInHint(steakLine(11).alt), 2) // 54.45 oz with the buffer is just over one 51 oz pack: never less
  assert.equal(packsInHint(steakLine(12).alt), 2) // 59.4 oz
  assert.equal(packsInHint(steakLine(20).alt), 2) // 99 oz
  assert.equal(packsInHint(steakLine(30).alt), 3) // 148.5 oz
  assert.doesNotMatch(steakLine(20).alt ?? "", /Family Pack|Walmart/)
})

test("prep · the warehouse planner buys the same number of steak packs as the order page says", () => {
  for (let adults = 1; adults <= 80; adults++) {
    for (const kids of [0, 3]) {
      const line = steakLine(adults, kids)
      assert.equal(Math.max(1, Math.ceil(line.qty / BUY_UNITS.steak.per)), packsInHint(line.alt), `${adults} adults, ${kids} kids`)
    }
  }
})

test("prep · two parties on one day: the steak hint is recomputed on the day's total", () => {
  const day = aggregatePrep([steakLine(8), steakLine(8)]).find((i) => i.id === "steak")
  assert.equal(day?.qty, 72)
  assert.equal(packsInHint(day?.alt), 2) // 79.2 oz with the buffer; one pack each would have been 2 as well
})
