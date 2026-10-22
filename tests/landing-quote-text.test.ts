// Layer-1 self-test: the landing-quote text says what the price is when the
// $599 minimum set it, and counts "1 adult" / "1 kid" in the singular.
// Susan Romero (La Puente, 2026-10-22) read "$599.00 for 1 adults" as $599 a
// head and the desk had to explain the minimum by hand.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { calcSimpleEstimate, GUEST_TIERS, MINIMUM_SPEND } from "../config/pricing-rules"
import { MINIMUM_COVERS_GUESTS, minimumNote, partyLine } from "../lib/landing-quote-text"
import { priceInText, statedHeadcount } from "../lib/caller-card"

const note = (adults: number, kids: number, weekdaySpecial = false, travelFee = 0) =>
  minimumNote(calcSimpleEstimate({ adults, kids, weekdaySpecial, travelFee }), adults + kids)

test("landing quote · one adult and one kid are singular", () => {
  assert.equal(partyLine(1, 0), "1 adult")
  assert.equal(partyLine(2, 0), "2 adults")
  assert.equal(partyLine(1, 1), "1 adult + 1 kid")
  assert.equal(partyLine(12, 3), "12 adults + 3 kids")
})

test("landing quote · the minimum covers 10 guests because 10 x $59.90 = $599, both read from config", () => {
  assert.ok(MINIMUM_COVERS_GUESTS * GUEST_TIERS.adult.price <= MINIMUM_SPEND + 1e-9)
  assert.ok((MINIMUM_COVERS_GUESTS + 1) * GUEST_TIERS.adult.price > MINIMUM_SPEND)
  assert.equal(MINIMUM_COVERS_GUESTS, 10, "today's prices: $599 / $59.90")
})

test("landing quote · Susan Romero, 1 adult: the $599 is the 10-guest minimum, not a price a head", () => {
  assert.equal(note(1, 0), "our 10-guest minimum, so it covers up to 10 guests")
})

test("landing quote · every party of up to 10 pays exactly the minimum, any mix, either rate - so 'covers up to 10' is true", () => {
  for (const weekdaySpecial of [false, true]) {
    for (let adults = 1; adults <= MINIMUM_COVERS_GUESTS; adults++) {
      for (let kids = 0; adults + kids <= MINIMUM_COVERS_GUESTS; kids++) {
        const est = calcSimpleEstimate({ adults, kids, weekdaySpecial })
        assert.equal(est.base, MINIMUM_SPEND, `${adults}+${kids}`)
        assert.equal(minimumNote(est, adults + kids), "our 10-guest minimum, so it covers up to 10 guests", `${adults}+${kids}`)
      }
    }
  }
})

test("landing quote · no note once the food clears the minimum", () => {
  assert.equal(note(11, 0), null, "11 x $59.90 - $30 = $628.90")
  assert.equal(note(15, 0), null)
  assert.equal(note(30, 4, true, 20), null)
})

test("landing quote · more than 10 on the minimum (kids, or the Mon-Thu rate): it covers them all", () => {
  assert.equal(note(11, 0, true), "our $599 minimum, which covers all 11 guests", "11 x $54.90 - $30 = $573.90")
  assert.equal(note(2, 9), "our $599 minimum, which covers all 11 guests")
})

test("landing quote · with travel the total is the minimum plus travel, and the note says both", () => {
  const est = calcSimpleEstimate({ adults: 4, kids: 0, weekdaySpecial: false, travelFee: 33 })
  assert.equal(est.total, 632)
  assert.equal(minimumNote(est, 4), "our 10-guest minimum ($599) plus travel, so it covers up to 10 guests")
  assert.equal(note(2, 9, false, 33), "our $599 minimum plus travel, which covers all 11 guests")
})

test("landing quote · the caller card still reads the price and the party (not the 10) off the new texts", () => {
  const susan =
    "Real Hibachi: your La Puente hibachi price is $599.00 for 1 adult (Standard (any day)) - our 10-guest minimum, so it covers up to 10 guests. No travel fee for your area."
  assert.equal(priceInText(susan), 599)
  assert.equal(statedHeadcount(susan), 1)
  const bigBear =
    "Real Hibachi: your Big Bear Lake hibachi price is $632.00 for 4 adults (Standard (any day)) - our 10-guest minimum ($599) plus travel, so it covers up to 10 guests. Includes ~$33 travel (first 50 mi free)."
  assert.equal(priceInText(bigBear), 632)
  assert.equal(statedHeadcount(bigBear), 4)
  const updated = "Real Hibachi: updated for 2 adults + 1 kid in Downey: $599.00 (Standard (any day)) - our 10-guest minimum, so it covers up to 10 guests."
  assert.equal(priceInText(updated), 599)
  assert.equal(statedHeadcount(updated), 3)
})
