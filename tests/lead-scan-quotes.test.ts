// Layer-2 self-test: a revisit's auto "leave" quote with the page defaults is
// not a re-quote (912-944-5781 entered 30 for 10/17; the later 15s were the
// page default, and two follow-ups were written to a headcount nobody chose).
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { isDefaultLeaveQuote } from "../lib/lead-scan"

test("scan quotes · auto leave with 15 adults, no kids, no date is a revisit", () => {
  assert.equal(isDefaultLeaveQuote({ auto: "leave", adults: 15, kids: 0, eventDate: "" }), true)
  assert.equal(isDefaultLeaveQuote({ auto: "leave", adults: "15", kids: "0" }), true)
})

test("scan quotes · anything the customer touched counts", () => {
  assert.equal(isDefaultLeaveQuote({ auto: "leave", adults: 30, kids: 0, eventDate: "2026-10-17" }), false)
  assert.equal(isDefaultLeaveQuote({ auto: "leave", adults: 15, kids: 0, eventDate: "2026-10-17" }), false)
  assert.equal(isDefaultLeaveQuote({ auto: "leave", adults: 15, kids: 2 }), false)
  assert.equal(isDefaultLeaveQuote({ adults: 15, kids: 0 }), false)
  assert.equal(isDefaultLeaveQuote(null), false)
})
