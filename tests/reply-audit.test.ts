// Layer-2 self-test: the content-blind check behind the inbox (lib/reply-audit.ts)
// and how often the phone rings as a customer keeps waiting. The cases are the
// three customers the inbox missed in the week to 2026-10-07.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { awakeHours, awakeMinutes, needsAnswer, openTurn, ptHour, shouldRing, shouldRingAwake, silencedByDecision, type AuditItem, type AuditLead } from "../lib/reply-audit"

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

test("ring · the new alarms: never 11 PM-7 AM Pacific, and their three-hour clock only runs while the owner is awake", () => {
  // November 2030, PST. pt(1) = 1:00 AM on the 14th.
  const pt = (h: number, m = 0, day = 14) => Date.parse(`2030-11-${day}T00:00:00-08:00`) + (h * 60 + m) * 60_000
  assert.deepEqual([awakeHours(pt(6, 59)), awakeHours(pt(7)), awakeHours(pt(22, 59)), awakeHours(pt(23))], [false, true, true, false])

  assert.equal(awakeMinutes(pt(12), pt(15, 10)), 190)
  assert.equal(awakeMinutes(pt(0, 30), pt(7)), 0, "the night does not count")
  assert.equal(awakeMinutes(pt(0, 30), pt(7, 25)), 25)
  assert.equal(awakeMinutes(pt(22, 50, 13), pt(7, 5)), 15, "ten minutes before 11 PM, five after 7 AM")
  assert.equal(awakeMinutes(pt(12, 0, 13), pt(12)), 16 * 60, "a whole day has sixteen waking hours")
  assert.equal(awakeMinutes(pt(12, 0, 11), pt(13)), 3 * 16 * 60 + 60)
  assert.equal(awakeMinutes(pt(12), pt(12)), 0)
  assert.equal(awakeMinutes(pt(13), pt(12)), 0)

  // In the daytime it is shouldRing, minute for minute.
  for (const w of [0, 10, 180, 190, 200, 365]) assert.equal(shouldRingAwake(w, pt(12) + w * 60_000), shouldRing(w, pt(12) + w * 60_000), `${w} minutes after noon`)

  // Something that came in at 1 AM: silent through the night, loud from 7 for its first three hours.
  assert.equal(shouldRingAwake(60, pt(2)), false)
  assert.equal(shouldRingAwake(359, pt(6, 59)), false)
  assert.equal(shouldRingAwake(360, pt(7)), true)
  assert.equal(shouldRing(360, pt(7)), false, "the plain clock had spent those three hours asleep")
  assert.equal(shouldRingAwake(360 + 179, pt(9, 59)), true)
  assert.equal(shouldRingAwake(360 + 200, pt(10, 20)), false, "between windows, as in the daytime")
  assert.equal(shouldRingAwake(360 + 365, pt(13, 5)), true, "six waking hours in: rings again")

  // 10:50 PM: ten minutes of ringing, the night, then the rest of its three hours from 7.
  assert.equal(shouldRingAwake(5, pt(22, 55, 13)), true)
  assert.equal(shouldRingAwake(15, pt(23, 5, 13)), false)
  assert.equal(shouldRingAwake(490, pt(7)), true)
})
