// Layer-1 self-test: guest counts read "1 adult" / "1 kid" / "1 guest", not
// "1 adults", on every customer-facing label that uses lib/counted.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { counted } from "../lib/counted"
import { partyLine } from "../lib/landing-quote-text"

test("counted · one is singular, everything else plural, zero included", () => {
  assert.equal(counted(1, "adult"), "1 adult")
  assert.equal(counted(2, "adult"), "2 adults")
  assert.equal(counted(0, "kid"), "0 kids")
  assert.equal(counted(1, "guest"), "1 guest")
  assert.equal(counted(15, "guest"), "15 guests")
})

test("counted · an irregular plural is given: 1 baby, 2 babies", () => {
  assert.equal(counted(1, "baby", "babies"), "1 baby")
  assert.equal(counted(2, "baby", "babies"), "2 babies")
})

test("counted · the landing quote's party line is built from it and reads the same", () => {
  assert.equal(partyLine(1, 0), "1 adult")
  assert.equal(partyLine(1, 1), "1 adult + 1 kid")
  assert.equal(partyLine(12, 3), "12 adults + 3 kids")
})
