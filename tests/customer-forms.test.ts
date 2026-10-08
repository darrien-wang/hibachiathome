// Layer-2 self-test: who counts as "already talking to us" (no automatic quote
// when they fill the form again, owner 2026-10-08), and what a form line says.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { customerInConversation, formSummary } from "../lib/customer-forms"

const now = Date.parse("2026-10-08T03:46:00Z")

test("conversation · a customer who texted us in the last two weeks is in a conversation", () => {
  const thread = [
    { direction: "outbound", at: "2026-10-04T18:35:00Z" },
    { direction: "inbound", at: "2026-10-04T21:30:00Z" },
    { direction: "outbound", at: "2026-10-07T03:43:00Z" },
  ]
  assert.equal(customerInConversation(thread, ["qualified"], now), true)
})

test("conversation · only our own texts (an auto quote and template B) is not a conversation", () => {
  const thread = [
    { direction: "outbound", at: "2026-10-07T23:32:00Z" },
    { direction: "outbound", at: "2026-10-07T23:35:00Z" },
  ]
  assert.equal(customerInConversation(thread, ["qualified"], now), false, "a new lead adjusting the card still gets the updated quote")
})

test("conversation · a reply older than two weeks does not count; a booked party always does", () => {
  const old = [{ direction: "inbound", at: "2026-09-20T18:00:00Z" }]
  assert.equal(customerInConversation(old, ["lost"], now), false)
  assert.equal(customerInConversation([], ["lost", "won"], now), true)
})

test("form line · step 1 hides the card default, step 2 shows the pick and flags an untouched 15", () => {
  assert.equal(formSummary("landing_contact", { adults: 15, kids: 0, stage: "contact", cityName: "Palm Springs" }).includes("15"), false)
  assert.match(formSummary("landing_contact", { adults: 7, kids: 0, stage: "quote", location: "Palm Desert" }), /7 大人/)
  assert.match(formSummary("landing_contact", { adults: 15, kids: 0, stage: "quote" }), /可能是表单默认值/)
  assert.match(formSummary("quote_book_online", { adults: 10, kids: 0, eventDate: "2026-10-10", eventTime: "19:00", tablewareRental: true }), /2026-10-10 19:00 · 10 大人 · 要桌椅餐具/)
})
