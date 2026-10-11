// Layer-2 self-test: a hold that ran out is dormant, not due (leads §4.2 停).
// 10-11 the scan put two leads the 09-27 pool review had stopped back into D
// when their holds ran out (323-627-8188 "phone-type, don't chase",
// 780-289-7363 with 7 texts already), and each got one more text.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { holdState } from "../lib/lead-hold"

const NOW = Date.parse("2026-10-11T23:00:00Z")
const held = { hold_set_at: "2026-09-27T18:47:00+00:00", hold_until: "2026-10-11T18:47:00+00:00" }

test("hold · ran out with the customer silent since → dormant", () => {
  assert.equal(holdState(held, "2026-09-24T17:43:00Z", NOW), "dormant")
  assert.equal(holdState(held, null, NOW), "dormant")
})

test("hold · still running → active", () => {
  assert.equal(holdState({ ...held, hold_until: "2026-10-12T03:19:00+00:00" }, null, NOW), "active")
})

test("hold · the customer spoke after we held it → none, running or not", () => {
  assert.equal(holdState(held, "2026-10-01T10:00:00Z", NOW), "none")
  assert.equal(holdState({ ...held, hold_until: "2026-10-20T00:00:00Z" }, "2026-10-01T10:00:00Z", NOW), "none")
})

test("hold · never held, or no set time to judge by → none", () => {
  assert.equal(holdState({ hold_until: null, hold_set_at: null }, null, NOW), "none")
  assert.equal(holdState({ hold_until: "2026-10-01T00:00:00Z", hold_set_at: null }, null, NOW), "none")
})

test("hold · Supabase and Twilio timestamps compare as instants", () => {
  // "+00:00" with millis vs "Z" without: as strings the earlier one sorts later.
  assert.equal(holdState({ hold_set_at: "2026-09-27T18:47:00.500+00:00", hold_until: "2026-10-11T18:47:00+00:00" }, "2026-09-27T18:47:00Z", NOW), "dormant")
})
