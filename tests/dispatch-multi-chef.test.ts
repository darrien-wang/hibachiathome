import assert from "node:assert/strict"
import { test } from "node:test"

import { planTiers } from "../lib/dispatch"

// Owner 2026-11-13: a party over 28 guests needs at least 2 people. The day map
// said "5 chefs" for 12-05 while Shirley (39 guests, 2 chefs) rode one line.
const P = { busyMinMinutes: 90, busyMaxMinutes: 120, arriveEarlyMinutes: 10 }
// 12:00 PM Marie, 7:00 PM Shirley (needs 2), 20 minutes apart.
const starts = [12 * 60, 19 * 60]
const drive = [
  [0, 20],
  [20, 0],
]

test("dispatch: without need, one chef runs both", () => {
  const [safe] = planTiers(starts, drive, P, 30, 60)
  assert.equal(safe.chefs, 1)
})

test("dispatch: a party needing 2 takes two lines - one chains from the noon party, one starts there", () => {
  const plans = planTiers(starts, drive, P, 30, 60, undefined, [1, 2])
  const safe = plans[0]
  assert.equal(safe.chefs, 2)
  assert.deepEqual(safe.chains.map((c) => c.join(",")).sort(), ["0,1", "1"])
  // the shared party shows up on both lines, mapped back to its own index
  assert.equal(safe.chains.filter((c) => c.includes(1)).length, 2)
  for (const l of safe.links) assert.ok(l.from < starts.length && l.to < starts.length)
  // one per party = every seat its own line: 3 people
  const last = plans[plans.length - 1]
  assert.equal(last.onePerParty, true)
  assert.equal(last.chefs, 3)
})

test("dispatch: a party needing 3 alone takes three identical lines", () => {
  const [safe] = planTiers([18 * 60], [[0]], P, 30, 60, undefined, [3])
  assert.equal(safe.chefs, 3)
  assert.deepEqual(safe.chains, [[0], [0], [0]])
})
