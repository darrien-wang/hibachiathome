import assert from "node:assert/strict"
import { test } from "node:test"

import { staleHolders, teamNeedingSheet, type SheetLink } from "../lib/chef-notify"

// The day map changes the team quietly (owner 2026-11-13); "通知改动" then tells
// whoever still holds a sheet for a party they are off, and sends the newcomers theirs.
const L = (staff: string, x: Partial<SheetLink> = {}): SheetLink => ({ staff_member_id: staff, sent_via: "twilio", first_opened_at: null, revoked_at: null, ...x })

test("stale holders: a live sheet that reached someone off the team", () => {
  const links = [L("blu"), L("gary")]
  assert.deepEqual(staleHolders(["gary"], links), ["blu"])
  assert.deepEqual(teamNeedingSheet(["gary", "john"], links), ["john"])
})

test("stale holders: revoked or never-delivered links are not told", () => {
  assert.deepEqual(staleHolders([], [L("blu", { revoked_at: "2026-11-12T00:00:00Z" }), L("gary", { sent_via: "failed" })]), [])
})

test("stale holders: nothing sent yet = nothing to tell either way", () => {
  assert.deepEqual(staleHolders(["gary"], []), [])
  assert.deepEqual(teamNeedingSheet(["gary"], []), [])
})
