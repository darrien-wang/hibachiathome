// The party-size ladder closed to new business on 2026-11-05 (owner,
// D-1105-01: "把人数阶梯取消吧，从今天开始"). A new quote is the per-person rate
// x heads at the $599 minimum, at any headcount; the old table is kept only for
// what was already promised (orders from before keep it, leads from before
// lock at it).
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  CLOSED_PARTY_LADDER,
  FULL_SETUP_PER_GUEST,
  GUEST_TIERS,
  PARTY_LADDER_CLOSED_AT,
  PARTY_SIZE_CUSTOM_FROM,
  calcSimpleEstimate,
  displayRangeForEstimate,
  formatDisplayRange,
  quotedBeforeLadderClosed,
} from "../config/pricing-rules"
import { calculateQuote, type QuoteInput } from "../lib/quote-builder"
import { computeQuote } from "../components/admin/workbench/quote-tool"
import { templateAMessage } from "../lib/first-response"

const r2 = (n: number) => Math.round(n * 100) / 100
const total = (adults: number, weekdaySpecial = false, kids = 0) => calcSimpleEstimate({ adults, kids, weekdaySpecial }).total

test("no party-size discount for a new party at 15, 20, 30, 40 or 60 adults, either rate", () => {
  for (const adults of [15, 20, 24, 25, 30, 31, 40, 41, 50, 51, 60]) {
    assert.equal(total(adults), r2(adults * GUEST_TIERS.adult.price), `${adults} Fri-Sun`)
    assert.equal(total(adults, true), r2(adults * GUEST_TIERS.adult.weekdayPrice), `${adults} Mon-Thu`)
  }
  assert.equal(total(15), 898.5)
  assert.equal(total(20), 1198)
  assert.equal(total(30), 1797)
  assert.equal(total(40), 2396)
  assert.equal(total(60), 3594)
  assert.equal(total(20, true), 1098)
})

test("kids and rentals add at their prices, nothing comes off for size", () => {
  assert.equal(total(20, false, 4), 1317.6, "20 x $59.90 + 4 x $29.90")
  const setup = calcSimpleEstimate({ adults: 20, kids: 0, weekdaySpecial: false, rentals: 20 * FULL_SETUP_PER_GUEST })
  assert.equal(setup.total, 1498)
  assert.equal(setup.minApplied, false)
  assert.equal(total(10), 599, "the minimum is unchanged")
})

test("61+ is still a custom quote", () => {
  assert.equal(PARTY_SIZE_CUSTOM_FROM, 61)
})

test("/quote and the workbench quote tool price the same way", () => {
  const input: QuoteInput = {
    eventDate: "2030-06-15",
    location: "Irvine",
    adults: 30,
    kids: 0,
    pricingTier: "standard",
    weekdaySaverProteins: { chicken: true, steak: true, shrimp: false },
    tablewareRental: false,
    tent10x10: false,
    addOns: { steak: false, shrimp: false, lobster: false },
  }
  const quote = calculateQuote(input)
  assert.deepEqual(quote.totalRange, { low: 1797, high: 1797 })
  const desk = computeQuote({ adults: 30, kids: 0, weekdaySpecial: false, travelFee: 0 })
  assert.equal(desk.total, 1797)
  assert.equal(desk.totalDiscount, 0)
  assert.equal(desk.deal, null, "nothing is signed into the link on its own")
})

test("the price gate brackets the exact figure to $25, with no discount spread", () => {
  assert.equal(formatDisplayRange(displayRangeForEstimate(calcSimpleEstimate({ adults: 15, kids: 0, weekdaySpecial: false }))), "$875–$900")
  assert.equal(formatDisplayRange(displayRangeForEstimate(calcSimpleEstimate({ adults: 10, kids: 0, weekdaySpecial: false }))), "$575–$600")
  assert.equal(formatDisplayRange(displayRangeForEstimate(calcSimpleEstimate({ adults: 20, kids: 0, weekdaySpecial: true }))), "$1,075–$1,100")
})

test("template A's 15-adult default is the no-ladder price", () => {
  const sms = templateAMessage({ adults: 15, cityName: "Anaheim" }).sms
  assert.match(sms, /For 15 adults in Anaheim it's \$898\.50 Fri-Sun or \$823\.50 Mon-Thu/)
  assert.doesNotMatch(sms, /discount/i)
})

test("the old ladder is kept as it was, for orders and leads from before the cutoff", () => {
  assert.deepEqual(
    CLOSED_PARTY_LADDER.map((t) => [t.minGuests, t.maxGuests, t.amount]),
    [[15, 24, 60], [25, 30, 90], [31, 40, 120], [41, 50, 150], [51, 60, 180]],
  )
  assert.match(PARTY_LADDER_CLOSED_AT, /^2026-11-\d{2}T\d{2}:\d{2}:\d{2}-08:00$/, "Pacific, with the offset written out")
  assert.ok(Number.isFinite(Date.parse(PARTY_LADDER_CLOSED_AT)))
})

test("a lead from before the ladder closed was quoted with it, a later one was not", () => {
  const cutoff = Date.parse(PARTY_LADDER_CLOSED_AT)
  assert.equal(quotedBeforeLadderClosed(new Date(cutoff - 60_000).toISOString()), true, "a minute before")
  assert.equal(quotedBeforeLadderClosed("2026-11-02T16:48:00Z"), true, "a lead from before the 10-14 closing too")
  assert.equal(quotedBeforeLadderClosed(PARTY_LADDER_CLOSED_AT), false, "at the cutoff it is a new lead")
  assert.equal(quotedBeforeLadderClosed(new Date(cutoff + 60_000).toISOString()), false)
  assert.equal(quotedBeforeLadderClosed(null), false)
  assert.equal(quotedBeforeLadderClosed("not a date"), false)
})
