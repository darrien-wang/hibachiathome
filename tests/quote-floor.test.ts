// Layer-1 self-test: the workbench quote tool's floor (D-1006-06) and its
// deal signing, on the parties the owner actually priced.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { computeQuote, quoteSms } from "../components/admin/workbench/quote-tool"
import { LARGE_PARTY_FLOOR, PRICE_FLOOR_PER_HEAD } from "../config/pricing-rules"

const r2 = (n: number) => Math.round(n * 100) / 100

test("floor · Whitney 60 on a Sunday at $54.90: $3,114, $51.90 a head, full service", () => {
  const q = computeQuote({ adults: 60, kids: 0, weekdaySpecial: false, travelFee: 0, adultRate: 54.9 })
  assert.equal(q.total, 3114)
  assert.equal(q.partySize, 180)
  assert.equal(q.floorRate, LARGE_PARTY_FLOOR.perHead, "40+ guests: the floor is $45 any day (D-1010-03)")
  assert.equal(q.effectivePerHead, 51.9)
  assert.equal(q.belowFloor, false)
  assert.equal(q.semiBuffet, false, "above the usual $50 the party stays full service")
  assert.deepEqual(q.deal, { adultRate: 54.9 }, "the per-adult rate is what gets signed into the link")
})

test("floor · the same party with free tables counts $4 a head: $47.90 is under $50, so it runs semi-buffet", () => {
  const q = computeQuote({ adults: 60, kids: 0, weekdaySpecial: false, travelFee: 0, adultRate: 54.9, freeTables: true })
  assert.equal(q.effectivePerHead, 47.9)
  assert.equal(q.belowFloor, false)
  assert.equal(q.semiBuffet, true)
  assert.equal(q.semiBuffetChefs, 2, "one chef per 50 guests")
  assert.ok(q.deal?.freeExtraIds?.includes("tables_chairs"))
  assert.match(quoteSms(q, {}), /family-style/, "the customer is told the format the price comes with")
})

test("floor · 40+ guests: $45 a head is the floor (semi-buffet), $44 needs the owner; under 40 the weekend floor stays $50", () => {
  const at45 = computeQuote({ adults: 150, kids: 0, weekdaySpecial: false, travelFee: 0, adultRate: 46.2 })
  assert.ok(at45.effectivePerHead >= 45 && at45.effectivePerHead < 50, `got ${at45.effectivePerHead}`)
  assert.equal(at45.belowFloor, false)
  assert.equal(at45.semiBuffet, true)
  assert.equal(at45.semiBuffetChefs, 3)
  const at44 = computeQuote({ adults: 150, kids: 0, weekdaySpecial: false, travelFee: 0, adultRate: 45.1 })
  assert.ok(at44.effectivePerHead < 45, `got ${at44.effectivePerHead}`)
  assert.equal(at44.belowFloor, true)
  assert.equal(at44.semiBuffet, false)
  const small = computeQuote({ adults: 30, kids: 0, weekdaySpecial: false, travelFee: 0, adultRate: 50.9 })
  assert.ok(small.effectivePerHead < 50, `got ${small.effectivePerHead}`)
  assert.equal(small.floorRate, PRICE_FLOOR_PER_HEAD.weekend)
  assert.equal(small.belowFloor, true, "30 guests: no large-party room")
  assert.doesNotMatch(quoteSms(small, {}), /family-style/)
})

test("floor · weekday 40+ gets no extra room: $45 is already the floor and stays full service", () => {
  // 45 x $48.50 - $150 (41-50 tier) = $2,032.50 -> $45.17 a head
  const q = computeQuote({ adults: 45, kids: 0, weekdaySpecial: true, travelFee: 0, adultRate: 48.5 })
  assert.equal(q.floorRate, PRICE_FLOOR_PER_HEAD.weekday)
  assert.ok(q.effectivePerHead >= 45, `got ${q.effectivePerHead}`)
  assert.equal(q.belowFloor, false)
  assert.equal(q.semiBuffet, false)
})

test("floor · list price is always above the floor, weekend and weekday, with or without kids", () => {
  for (const weekdaySpecial of [false, true]) {
    for (const [adults, kids] of [[10, 0], [15, 5], [10, 10], [30, 6], [60, 0]] as const) {
      const q = computeQuote({ adults, kids, weekdaySpecial, travelFee: 0 })
      assert.equal(q.belowFloor, false, `${adults}+${kids} ${weekdaySpecial ? "weekday" : "weekend"} at list price must clear the floor`)
    }
  }
})

test("floor · kids weigh half a head: 10 adults + 10 kids at list price is $41.90 a body but $55.87 a weighted head", () => {
  const q = computeQuote({ adults: 10, kids: 10, weekdaySpecial: false, travelFee: 0 })
  assert.equal(q.total, 599 + 299 - 60, "10+10 = 20 paying heads, 15-24 tier: -$60")
  assert.equal(q.perPerson, r2(q.total / 20))
  assert.equal(q.effectivePerHead, r2(q.total / 15))
  assert.equal(q.belowFloor, false)
})

test("floor · weekday floor is $45: 35 on a Tuesday at $47 a head clears it, $44 does not", () => {
  const ok = computeQuote({ adults: 35, kids: 0, weekdaySpecial: true, travelFee: 0, adultRate: 50.43 })
  assert.equal(ok.floorRate, PRICE_FLOOR_PER_HEAD.weekday)
  assert.ok(ok.effectivePerHead >= 45, `got ${ok.effectivePerHead}`)
  assert.equal(ok.belowFloor, false)
  const low = computeQuote({ adults: 35, kids: 0, weekdaySpecial: true, travelFee: 0, adultRate: 47.4 })
  assert.ok(low.effectivePerHead < 45, `got ${low.effectivePerHead}`)
  assert.equal(low.belowFloor, true)
})

test("floor · travel never counts toward the per-head take", () => {
  const near = computeQuote({ adults: 20, kids: 0, weekdaySpecial: false, travelFee: 0, adultRate: 50 })
  const far = computeQuote({ adults: 20, kids: 0, weekdaySpecial: false, travelFee: 120, adultRate: 50 })
  assert.equal(near.effectivePerHead, far.effectivePerHead)
  assert.equal(far.total - near.total, 120)
})

test("signing · appetizers are never signed into the link; tables and utensils are", () => {
  const q = computeQuote({ adults: 24, kids: 0, weekdaySpecial: false, travelFee: 42, freeAppetizer: { id: "gyoza", trays: 2 }, freeTables: true, freeUtensils: true })
  assert.deepEqual(q.deal?.freeExtraIds, ["tables_chairs", "utensils"])
  assert.equal(q.deal?.adultRate, undefined)
  assert.ok(q.freebies.some((f) => /Gyoza \(2 trays\)/.test(f)))
})

test("signing · a weekday special rate is signed with the $5 added back (the invoice measures from $59.90)", () => {
  const q = computeQuote({ adults: 20, kids: 0, weekdaySpecial: true, travelFee: 0, adultRate: 49.9 })
  assert.equal(q.adultPrice, 49.9)
  assert.equal(q.deal?.adultRate, 54.9)
})
