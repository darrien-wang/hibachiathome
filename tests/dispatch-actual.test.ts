import assert from "node:assert/strict"
import { test } from "node:test"

import { actualPlan } from "../lib/dispatch"

// 日历这天"现在派的"那版（老板 2026-11-26「拖了之后这里的视图没有改」）：按订单上现在派的人画线。

const P = { busyMinMinutes: 90, busyMaxMinutes: 120, arriveEarlyMinutes: 10 }
const hm = (s: string) => {
  const [h, m] = s.split(":").map(Number)
  return h * 60 + m
}

test("each chef's parties form one line; a short two-chef party leaves an open slot", () => {
  // 12/5 的样子：Gary = Ashley 5PM + Shirley 7PM；Eason = Marie 12PM + Shirley 7PM；Jennifer 6:30 没人
  const starts = [hm("12:00"), hm("17:00"), hm("18:30"), hm("19:00")]
  const drive = starts.map((_, i) => starts.map((__, j) => (i === j ? 0 : 20)))
  const team = [["eason"], ["gary"], [], ["gary", "eason"]]
  const p = actualPlan(starts, drive, P, 30, team, [1, 1, 1, 2])
  assert.equal(p.key, "actual")
  assert.equal(p.chefs, 2)
  assert.deepEqual(p.chains, [[0, 3], [1, 3], [2]])
  // 两条线各一段衔接
  assert.deepEqual(p.links.map((l) => [l.from, l.to]), [[0, 3], [1, 3]])
})

test("a party missing two chefs shows two open slots", () => {
  const p = actualPlan([hm("18:00")], [[0]], P, 30, [[]], [2])
  assert.equal(p.chefs, 0)
  assert.deepEqual(p.chains, [[0], [0]])
})
