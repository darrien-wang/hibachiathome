import { test } from "node:test"
import assert from "node:assert/strict"
import { callWasMissed } from "../lib/missed-call"

const noAnswer = { status: "no-answer", duration: "0" }

test("a call still going is never missed", () => {
  for (const status of ["in-progress", "ringing", "queued"]) assert.equal(callWasMissed({ status, duration: "0" }, null), false, status)
})

test("a call that never connected, or ended in under 20 s, is missed", () => {
  assert.equal(callWasMissed({ status: "no-answer", duration: "0" }, null), true)
  assert.equal(callWasMissed({ status: "busy", duration: null }, null), true)
  assert.equal(callWasMissed({ status: "completed", duration: "8" }, null), true)
})

// 2026-11-19 13:35: 24 s of ringing, three app seats no-answer, the caller hung up before the backup phone.
test("24 s of ringing with no seat picking up is missed", () => {
  assert.equal(callWasMissed({ status: "completed", duration: "24" }, [noAnswer, noAnswer, noAnswer]), true)
  assert.equal(callWasMissed({ status: "completed", duration: "24" }, []), true)
})

test("a long call with a leg that was picked up is answered", () => {
  // 11-09 14:54: the owner answered in the app, 273 s on his leg.
  assert.equal(callWasMissed({ status: "completed", duration: "283" }, [noAnswer, noAnswer, { status: "completed", duration: "273" }]), false)
  // 11-19 12:03: the app seats rang out and the backup phone picked up.
  assert.equal(callWasMissed({ status: "completed", duration: "668" }, [noAnswer, noAnswer, noAnswer, { status: "completed", duration: "629" }]), false)
})

test("a long call whose legs could not be read counts as answered", () => {
  assert.equal(callWasMissed({ status: "completed", duration: "45" }, null), false)
})
