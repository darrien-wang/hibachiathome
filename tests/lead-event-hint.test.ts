import assert from "node:assert/strict"
import { test } from "node:test"

import { hintFromRows, hintIsPast } from "../lib/lead-event-hint"

test("a date hint already behind us does not count as a known party date (2026-11-26)", () => {
  // The 11-26 lead's quote form sent Nov 13 on the 26th; desk send refused "What date are you planning for?"
  // with asked_known_date until it was forced.
  const hint = hintFromRows([{ touchpoint_type: "landing_quote_text", raw_payload_json: { eventDate: "2026-11-13" } }])
  assert.deepEqual(hint, { date: "2026-11-13", source: "landing_quote_text" })
  assert.equal(hintIsPast(hint, "2026-11-26"), true)
  // Today and later still count.
  assert.equal(hintIsPast({ date: "2026-11-26", source: "contact_form" }, "2026-11-26"), false)
  assert.equal(hintIsPast({ date: "2026-12-19", source: "contact_form" }, "2026-11-26"), false)
  // A date in the customer's own words has no year to compare: kept.
  assert.equal(hintIsPast({ date: "Nov 13", source: "note" }, "2026-11-26"), false)
  assert.equal(hintIsPast(null, "2026-11-26"), false)
  assert.equal(hintIsPast({ date: "2026-11-13", source: "note" }, ""), false)
})
