// toE164: what we text and what we store. 2026-10-07: "+6503022660" (a US
// number typed with a plus and no 1) was taken for Singapore and the price
// text to a Palm Springs lead failed with Twilio 21211.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { toE164 } from "../lib/sms-thread"

test("phone · a US number with a plus and no 1 gets the 1", () => {
  assert.equal(toE164("+6503022660"), "+16503022660")
  assert.equal(toE164("+9092687235"), "+19092687235")
})

test("phone · the usual US shapes", () => {
  assert.equal(toE164("+16503022660"), "+16503022660")
  assert.equal(toE164("(650) 302-2660"), "+16503022660")
  assert.equal(toE164("650.302.2660"), "+16503022660")
  assert.equal(toE164("1 650 302 2660"), "+16503022660")
  assert.equal(toE164("+ 650 302 2660"), "+16503022660")
})

test("phone · real international numbers are left alone", () => {
  assert.equal(toE164("+442079460958"), "+442079460958", "UK")
  assert.equal(toE164("+6581234567"), "+6581234567", "Singapore mobile: 123 is not a US exchange")
  assert.equal(toE164("+861012345678"), "+861012345678", "China")
})

test("phone · junk is rejected", () => {
  assert.equal(toE164("12345"), null)
  assert.equal(toE164(""), null)
  assert.equal(toE164(null), null)
})
