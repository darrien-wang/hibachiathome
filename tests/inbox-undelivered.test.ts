// Layer-2 self-test: a text that never arrived stays on the list until another
// channel goes out. 2026-10-12: a planner customer's "party saved" text bounced
// (30003/30006), sms-status marked her lost, and the inbox skipped lost leads -
// 15 hours with an email on file and no email sent.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { undeliveredRings, undeliveredStillOpen } from "../lib/inbox"

const LAST_OUT = "2026-10-12T00:03:00Z"
const blockedLost = { status: "lost", email: "guest@example.com", sms_blocked_at: "2026-10-12T00:03:05Z", sms_blocked_reason: "30006 landline" }

test("undelivered · carrier-blocked and marked lost, email on file, not emailed → still open", () => {
  assert.equal(undeliveredStillOpen(blockedLost, LAST_OUT, null), true)
})

test("undelivered · an email after the text closes it", () => {
  assert.equal(undeliveredStillOpen(blockedLost, LAST_OUT, "2026-10-12T14:54:00Z"), false)
  assert.equal(undeliveredStillOpen({ ...blockedLost, status: "qualified" }, LAST_OUT, "2026-10-12T14:54:00Z"), false)
})

test("undelivered · an email from before the text does not count", () => {
  assert.equal(undeliveredStillOpen({ ...blockedLost, status: "qualified" }, LAST_OUT, "2026-10-11T09:00:00Z"), true)
})

test("undelivered · lost for any other reason, or blocked with no email → off the list", () => {
  assert.equal(undeliveredStillOpen({ ...blockedLost, sms_blocked_at: null, sms_blocked_reason: null }, LAST_OUT, null), false)
  assert.equal(undeliveredStillOpen({ ...blockedLost, email: null }, LAST_OUT, null), false)
  assert.equal(undeliveredStillOpen({ ...blockedLost, email: "  " }, LAST_OUT, null), false)
})

test("undelivered · an opt-out never comes back, a disqualified lead never shows", () => {
  assert.equal(undeliveredStillOpen({ ...blockedLost, sms_blocked_reason: "21610 unsubscribed" }, LAST_OUT, null), false)
  assert.equal(undeliveredStillOpen({ ...blockedLost, sms_blocked_reason: "opt-out: texted STOP" }, LAST_OUT, null), false)
  assert.equal(undeliveredStillOpen({ ...blockedLost, status: "disqualified" }, LAST_OUT, null), false)
  assert.equal(undeliveredStillOpen(null, LAST_OUT, null), false)
})

test("undelivered · an open lead with no receipt shows until it is emailed", () => {
  const open = { status: "qualified", email: null, sms_blocked_at: null, sms_blocked_reason: null }
  assert.equal(undeliveredStillOpen(open, LAST_OUT, null), true)
})

// 11-03: 626-819, no email, both texts 30005 - the phone rang every 15 minutes for three hours.
test("undelivered · rings only for a lead from the last day that has an email to send instead", () => {
  const now = Date.parse("2026-11-03T20:20:00Z")
  const fresh = { email: "guest@example.com", created_at: "2026-11-03T19:59:00Z" }
  assert.equal(undeliveredRings(fresh, now, 15), true)
  assert.equal(undeliveredRings({ ...fresh, email: null }, now, 15), false)
  assert.equal(undeliveredRings({ ...fresh, email: "  " }, now, 15), false)
  assert.equal(undeliveredRings({ ...fresh, created_at: "2026-11-01T19:59:00Z" }, now, 15), false)
})
