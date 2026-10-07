// Layer-2 self-test: the content-blind check behind the inbox (lib/reply-audit.ts)
// and how often the phone rings as a customer keeps waiting. The cases are the
// three customers the inbox missed in the week to 2026-10-07.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { needsAnswer, openTurn, ptHour, shouldRing, silencedByDecision, type AuditItem, type AuditLead } from "../lib/reply-audit"

const sms = (at: string, body: string, media = 0): AuditItem => ({ at, kind: "sms", type: "sms_inbound", body, media })
const lead = (over: Partial<AuditLead> = {}): AuditLead => ({
  id: "L1", phone: "+19092687235", status: "qualified", full_name: null, email: null, acked_until: null, hold_until: null, hold_set_at: null, ...over,
})

test("audit · photos then a tapback: the photos are open", () => {
  const items = [
    sms("2026-10-05T18:10:10Z", "", 2),
    sms("2026-10-05T18:11:22Z", "", 1),
    sms("2026-10-05T18:11:51Z", "Loved “We do - they're normally $10 a guest”"),
  ]
  const t = openTurn(items, "2026-10-05T17:47:15Z")!
  assert.equal(t.first.at, "2026-10-05T18:10:10Z")
  assert.equal(t.count, 2, "two photo messages need an answer, the reaction does not")
})

test("audit · a question followed by thanks is still open, from the question", () => {
  const items = [sms("2026-10-07T00:53:40Z", "Or what do you guys give as alcohol?"), sms("2026-10-07T00:54:10Z", "Sounds good thank you")]
  const t = openTurn(items, "2026-10-07T00:53:20Z")!
  assert.equal(t.first.body, "Or what do you guys give as alcohol?")
})

test("audit · a website form after our text is open; a bare thanks or a reaction is not", () => {
  const form: AuditItem = { at: "2026-10-06T23:33:48Z", kind: "form", type: "quote_book_online", body: "", media: 0 }
  assert.ok(openTurn([form], "2026-10-06T23:33:28Z"))
  assert.equal(openTurn([sms("2026-10-06T02:00:00Z", "Thank you so much!")], "2026-10-06T01:00:00Z"), null)
  assert.equal(openTurn([sms("2026-10-06T02:00:00Z", "Liked “See you Saturday”")], "2026-10-06T01:00:00Z"), null)
})

test("audit · anything we sent after it closes the turn; mixed timestamp formats compare as instants", () => {
  assert.equal(openTurn([sms("2026-10-05T18:10:10.000+00:00", "", 2)], "2026-10-05T18:20:00Z"), null)
  assert.ok(openTurn([sms("2026-10-05T18:10:10.500+00:00", "is 5pm ok?")], "2026-10-05T18:10:10Z"))
  assert.ok(openTurn([sms("2026-10-05T18:10:10Z", "is 5pm ok?")], null), "never answered at all is open")
})

test("audit · only a person's decision silences it", () => {
  const now = Date.parse("2026-10-07T20:00:00Z")
  const at = "2026-10-07T18:00:00Z"
  assert.equal(silencedByDecision(lead(), at, now), false)
  assert.equal(silencedByDecision(lead({ acked_until: "2026-10-07T18:30:00Z" }), at, now), true, "不用回 after it")
  assert.equal(silencedByDecision(lead({ acked_until: "2026-10-07T17:00:00Z" }), at, now), false, "不用回 before it does not cover it")
  assert.equal(silencedByDecision(lead({ hold_until: "2026-10-09T00:00:00Z", hold_set_at: "2026-10-07T19:00:00Z" }), at, now), true, "held after it")
  assert.equal(silencedByDecision(lead({ hold_until: "2026-10-09T00:00:00Z", hold_set_at: "2026-10-07T17:00:00Z" }), at, now), false, "a message after the hold breaks it")
  assert.equal(silencedByDecision(lead({ hold_until: "2026-10-07T19:00:00Z", hold_set_at: "2026-10-07T19:00:00Z" }), at, now), false, "an expired hold")
  assert.equal(silencedByDecision(lead({ status: "disqualified" }), at, now), true)
  assert.equal(silencedByDecision(lead({ status: "lost" }), at, now), false, "a lost lead writing back is a customer again")
})

test("audit · emails and forms always need an answer; STOP never does", () => {
  assert.equal(needsAnswer({ at: "x", kind: "email", type: "email_inbound", body: "thanks", media: 0 }), true)
  assert.equal(needsAnswer(sms("x", "STOP")), false)
  assert.equal(needsAnswer(sms("x", "", 1)), true)
})

test("ring · first three hours always; then one 14-minute window every three hours, 8 AM-11 PM PT", () => {
  const tenAm = Date.parse("2026-10-07T17:00:00Z") // 10:00 PDT
  const twoAm = Date.parse("2026-10-07T09:00:00Z") // 02:00 PDT
  assert.equal(ptHour(tenAm), 10)
  assert.equal(ptHour(twoAm), 2)
  assert.equal(shouldRing(10, twoAm), true, "a fresh text rings at any hour, as before")
  assert.equal(shouldRing(180, tenAm), true)
  assert.equal(shouldRing(190, tenAm), true, "inside the first window")
  assert.equal(shouldRing(200, tenAm), false, "between windows")
  assert.equal(shouldRing(365, tenAm), true, "six hours in: rings again")
  assert.equal(shouldRing(365, twoAm), false, "not at 2 AM")
  assert.equal(shouldRing(180 + 180 * 10 + 5, tenAm), true, "still ringing after a day and a half")
})
