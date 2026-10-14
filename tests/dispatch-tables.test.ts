import assert from "node:assert/strict"
import { test } from "node:test"

import { planTiers, TABLES_EXTRA_MINUTES } from "../lib/dispatch"

const P = { busyMinMinutes: 90, busyMaxMinutes: 120, arriveEarlyMinutes: 10 }
// 3:00 PM then 6:30 PM, 56 minutes apart (the 10-17 pair on the owner's screenshot).
const starts = [15 * 60, 18 * 60 + 30]
const drive = [
  [0, 56],
  [56, 0],
]

test("dispatch: no tables - the pair arrives 34 minutes early when the first party runs long", () => {
  const [safe] = planTiers(starts, drive, P, 30, 60)
  assert.equal(safe.chefs, 1)
  assert.equal(safe.links[0].worstLate, -34)
  assert.equal(safe.links[0].extraMinutes, 0)
  assert.equal(safe.links[0].grade, "solid")
})

test("dispatch: a table setup on either party takes half an hour out of the gap", () => {
  const [safe] = planTiers(starts, drive, P, 30, 60, () => TABLES_EXTRA_MINUTES)
  assert.equal(safe.links[0].extraMinutes, 30)
  assert.equal(safe.links[0].worstLate, -4)
  assert.equal(safe.links[0].bestLate, -34)
  assert.equal(safe.links[0].grade, "ontime") // makes it, but no longer with the 10 minute cushion
  assert.deepEqual(safe.links[0].fix?.minutes, 6)
})

test("dispatch: when the half hour does not fit, the safe plan sends a second chef", () => {
  const tight = [15 * 60, 18 * 60] // 6:00 PM instead of 6:30
  assert.equal(planTiers(tight, drive, P, 30, 60)[0].chefs, 1)
  const withTables = planTiers(tight, drive, P, 30, 60, () => TABLES_EXTRA_MINUTES)
  assert.equal(withTables[0].key, "safe")
  assert.equal(withTables[0].chefs, 2)
})
