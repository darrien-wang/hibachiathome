// Layer-2 self-test: Twilio turning a number down for good stops the retries.
// 2026-11-04 a landing form typed +1 852-367-1235 (not a US area code). Twilio
// answered 21211 every time, lead-watch released its first-response claim every
// time, and the per-minute cron texted template B 13 times in 13 minutes.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { smsRefusedForGood } from "../lib/sms-thread"

test("a 4xx from Twilio is final: the number itself was refused", () => {
  assert.equal(smsRefusedForGood({ ok: false, error: "The 'To' number +18523671235 is not a valid phone number.", httpStatus: 400 }), true)
  assert.equal(smsRefusedForGood({ ok: false, error: "Attempt to send to unsubscribed recipient", httpStatus: 400 }), true)
})

test("a 5xx, a network failure or a local refusal can be retried", () => {
  assert.equal(smsRefusedForGood({ ok: false, error: "twilio_503", httpStatus: 503 }), false)
  assert.equal(smsRefusedForGood({ ok: false, error: "fetch failed" }), false)
  assert.equal(smsRefusedForGood({ ok: false, error: "twilio_not_configured" }), false)
})

test("a sent message is never a refusal", () => {
  assert.equal(smsRefusedForGood({ ok: true, sid: "SM123", status: "queued" }), false)
})
