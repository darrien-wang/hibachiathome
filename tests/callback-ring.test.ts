// Layer-2 self-test: which texts ring the owner's App as 请回电 (lib/callback-ring.ts, 2026-10-09).
// The two texts Jose sent on 10-09 while driving must ring; a customer who says they will call
// us, or asks us not to call, must not.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { LIVE_PARTY_RING_HOURS_PT, isLivePartyAlarm, openFromRows, spokenName, wantsCall, withinRingHours } from "../lib/callback-ring"

test("callback · Jose's two texts on 10-09 ring", () => {
  assert.equal(wantsCall("If you can call me that'd be great. I'm driving."), true)
  assert.equal(wantsCall("Call now if you can please"), true)
})

test("callback · other ways of asking for a call", () => {
  for (const t of [
    "Can you give me a call?",
    "could someone call me back",
    "Please call when you get a chance",
    "Is it possible to talk on the phone?",
    "I'd prefer a phone call",
    "Llámame por favor",
    "me puedes llamar?",
  ]) assert.equal(wantsCall(t), true, t)
})

test("callback · not a request for us to call", () => {
  for (const t of [
    "I'll call you tomorrow",
    "Please don't call, I'm at work - text only",
    "I can't talk right now",
    "What time does the chef arrive?",
    "Can I call you?",
    "no me llames, mándame mensaje",
    "",
  ]) assert.equal(wantsCall(t), false, t)
})

test("callback · the ring says a name, or the last four digits", () => {
  assert.equal(spokenName({ name: "Jose", phone: "+17605379943" }), "Jose")
  assert.equal(spokenName({ name: "Unknown Contact", phone: "+17605379943" }), "尾号 9 9 4 3 的客人")
  assert.equal(spokenName({ name: "+17605379943", phone: "+17605379943" }), "尾号 9 9 4 3 的客人")
})

test("callback · rings 8 AM to 10 PM Pacific only", () => {
  assert.equal(withinRingHours(Date.parse("2026-10-09T23:36:00Z")), true) // 16:36 PDT
  assert.equal(withinRingHours(Date.parse("2026-10-10T05:30:00Z")), false) // 22:30 PDT
  assert.equal(withinRingHours(Date.parse("2026-10-10T14:59:00Z")), false) // 07:59 PDT
  assert.equal(withinRingHours(Date.parse("2026-10-10T15:00:00Z")), true) // 08:00 PDT
})

test("callback · a ring written in the same instant as its request still counts", () => {
  // 11-02: the database handed back the ring before the request, the ring was dropped and the
  // owner was rung again 27 seconds later.
  const at = "2026-11-03T07:44:33.000Z"
  const open = openFromRows("lead", [
    { touchpoint_type: "callback_ring", occurred_at: at, raw_payload_json: { attempt: 1 } },
    { touchpoint_type: "callback_request", occurred_at: at, raw_payload_json: { phone: "+13105550143", name: "Jenna", why: "现场：测试" } },
  ])
  assert.equal(open?.rings, 1)
  assert.equal(open?.lastRingAt, Date.parse(at))
  const done = openFromRows("lead", [
    { touchpoint_type: "callback_done", occurred_at: "2026-11-03T07:50:00.000Z", raw_payload_json: { how: "heard" } },
    { touchpoint_type: "callback_request", occurred_at: at, raw_payload_json: { phone: "+13105550143" } },
  ])
  assert.equal(done, null)
})

test("callback · a live party alarm (why 现场…) rings until midnight", () => {
  assert.equal(isLivePartyAlarm("现场投诉：上菜慢，小孩没吃上"), true)
  assert.equal(isLivePartyAlarm("I'm driving"), false)
  assert.equal(isLivePartyAlarm(""), false)
  assert.equal(withinRingHours(Date.parse("2026-11-03T06:40:00Z"), LIVE_PARTY_RING_HOURS_PT), true) // 22:40 PST
  assert.equal(withinRingHours(Date.parse("2026-11-03T06:40:00Z")), false) // a plain request stays quiet then
  assert.equal(withinRingHours(Date.parse("2026-11-03T14:30:00Z"), LIVE_PARTY_RING_HOURS_PT), false) // 06:30 PST
})
