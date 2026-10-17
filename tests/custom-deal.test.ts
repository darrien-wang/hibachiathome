// Layer-1 self-test: the signed deal that rides on deposit links (lib/custom-deal.ts),
// and its extraRates rule - an extra billed at a set price per unit, e.g.
// Saturday's half-price tables (D-1017-01).
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { decodeDeal, encodeDeal, normalizeDeal, signDeal, verifyDeal } from "../lib/custom-deal"

const LEAD = "6f1c2a0e-3b4d-4c5e-8f90-1a2b3c4d5e6f"

test("extraRates · a known extra at a rate >= 0 is kept, rounded to cents", () => {
  assert.deepEqual(normalizeDeal({ extraRates: { tables_chairs: 5 } }), { extraRates: { tables_chairs: 5 } })
  assert.deepEqual(normalizeDeal({ extraRates: { tables_chairs: "4.999" } }), { extraRates: { tables_chairs: 5 } })
  assert.deepEqual(normalizeDeal({ extraRates: { utensils: 0 } }), { extraRates: { utensils: 0 } })
})

test("extraRates · unknown ids, negative / non-finite rates and non-objects are dropped", () => {
  assert.equal(normalizeDeal({ extraRates: { white_linen: 3, ribeye: 5 } }), null, "not an extra the deal may price")
  assert.equal(normalizeDeal({ extraRates: { tables_chairs: -1 } }), null)
  assert.equal(normalizeDeal({ extraRates: { tables_chairs: "abc" } }), null)
  assert.equal(normalizeDeal({ extraRates: { tables_chairs: Infinity } }), null)
  assert.equal(normalizeDeal({ extraRates: [5] }), null)
  assert.equal(normalizeDeal({ extraRates: "tables_chairs=5" }), null)
  assert.deepEqual(normalizeDeal({ extraRates: { tables_chairs: 5, bogus: 1 } }), { extraRates: { tables_chairs: 5 } })
})

test("extraRates · counts as a rule on its own, and an extra that is free is not also discounted", () => {
  assert.ok(normalizeDeal({ extraRates: { tables_chairs: 5 } }), "a rate alone is a deal")
  assert.deepEqual(
    normalizeDeal({ freeExtraIds: ["tables_chairs"], extraRates: { tables_chairs: 5, utensils: 3 } }),
    { freeExtraIds: ["tables_chairs"], extraRates: { utensils: 3 } },
    "free wins - never refunded twice",
  )
  assert.deepEqual(normalizeDeal({ freeExtraIds: ["tables_chairs"], extraRates: { tables_chairs: 5 } }), { freeExtraIds: ["tables_chairs"] })
})

test("encodeDeal · a deal without extraRates encodes byte for byte as before (texted links keep verifying)", () => {
  // Pinned from encodeDeal before extraRates existed (commit 8ff1af8).
  assert.equal(
    encodeDeal({ freeExtraIds: ["tables_chairs"] }),
    "eyJhZHVsdFJhdGUiOm51bGwsImNoaWxkUmF0ZSI6bnVsbCwiZnJlZUV4dHJhSWRzIjpbInRhYmxlc19jaGFpcnMiXSwiZmxhdE9mZiI6bnVsbCwibm90ZSI6IiJ9",
  )
  assert.equal(
    encodeDeal({ adultRate: 54.9, freeExtraIds: ["utensils", "tables_chairs"], flatOff: 120, note: "Tables half price" }),
    "eyJhZHVsdFJhdGUiOjU0LjksImNoaWxkUmF0ZSI6bnVsbCwiZnJlZUV4dHJhSWRzIjpbInRhYmxlc19jaGFpcnMiLCJ1dGVuc2lscyJdLCJmbGF0T2ZmIjoxMjAsIm5vdGUiOiJUYWJsZXMgaGFsZiBwcmljZSJ9",
  )
  assert.equal(encodeDeal({ freeExtraIds: ["tables_chairs"], extraRates: {} }), encodeDeal({ freeExtraIds: ["tables_chairs"] }), "an empty map adds nothing")
})

test("encodeDeal · extraRates is appended last with its ids sorted, so the same deal always signs the same", () => {
  const a = encodeDeal({ extraRates: { utensils: 3, tables_chairs: 5 } })
  const b = encodeDeal({ extraRates: { tables_chairs: 5, utensils: 3 } })
  assert.equal(a, b)
  const json = Buffer.from(a, "base64url").toString("utf8")
  assert.equal(json, '{"adultRate":null,"childRate":null,"freeExtraIds":[],"flatOff":null,"note":"","extraRates":{"tables_chairs":5,"utensils":3}}')
})

test("signing · a half-price-tables deal round-trips through sign / verify / decode, and is bound to the lead", () => {
  process.env.AGREED_TOTAL_SECRET = "test-secret"
  const deal = normalizeDeal({ extraRates: { tables_chairs: 5 }, note: "Saturday tables half price" })!
  const encoded = encodeDeal(deal)
  const sig = signDeal(LEAD, encoded)!
  assert.deepEqual(verifyDeal(LEAD, encoded, sig), deal)
  assert.deepEqual(decodeDeal(encoded), deal, "what the deposit webhook reads back from Stripe metadata")
  assert.equal(verifyDeal("another-lead", encoded, sig), null)
  // Raising the rate's discount by editing the link breaks the signature.
  const edited = encodeDeal({ ...deal, extraRates: { tables_chairs: 0 } })
  assert.equal(verifyDeal(LEAD, edited, sig), null)
})

test("signing · an old free-tables link still verifies and decodes the same", () => {
  process.env.AGREED_TOTAL_SECRET = "test-secret"
  const encoded = "eyJhZHVsdFJhdGUiOm51bGwsImNoaWxkUmF0ZSI6bnVsbCwiZnJlZUV4dHJhSWRzIjpbInRhYmxlc19jaGFpcnMiXSwiZmxhdE9mZiI6bnVsbCwibm90ZSI6IiJ9"
  const sig = signDeal(LEAD, encoded)!
  assert.deepEqual(verifyDeal(LEAD, encoded, sig), { freeExtraIds: ["tables_chairs"] })
})
