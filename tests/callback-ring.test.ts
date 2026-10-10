// Layer-2 self-test: which texts ring the owner's App as 请回电 (lib/callback-ring.ts, 2026-10-09).
// The two texts Jose sent on 10-09 while driving must ring; a customer who says they will call
// us, or asks us not to call, must not.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { spokenName, wantsCall, withinRingHours } from "../lib/callback-ring"

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
