import assert from "node:assert/strict"
import { test } from "node:test"

import { checkGroupMove, checkMove, clashesFor, teamsAfter, teamsAfterGroup, unassignedGroups, weekHeads, type BoardDay, type BoardStop } from "../lib/share-move"

// 份额页拖单（老板 2026-11-14）：同一天换人，接不上的要让出来。

const P = { busyMin: 90, busyMax: 120, arriveEarly: 10, lateOk: 30, lateLimit: 60 }
const stop = (id: string, hm: string, chefIds: string[], extra: Partial<BoardStop> = {}): BoardStop => {
  const [h, m] = hm.split(":").map(Number)
  return { id, name: id, address: "Los Angeles, CA 90001", time: hm, startMin: h * 60 + m, guests: 12, tables: false, plan: { chefs: 1 }, difficulty: null, chefIds, ...extra }
}
// 每两场之间 30 分钟车程。
const day = (stops: BoardStop[]): BoardDay => ({ date: "2026-11-28", stops, drive: stops.map((_, i) => stops.map((__, j) => (i === j ? 0 : 30))), params: P })
const names: Record<string, string> = { blu: "Blu", gary: "Gary", john: "John", eason: "Eason", yf: "易非", niko: "Niko" }
const ctx = { nameOf: (id: string) => names[id] ?? id, activeIds: new Set(Object.keys(names)), started: () => false, today: "2026-11-14" }

test("a party that fits after the chef's other one moves with no clash", () => {
  const d = day([stop("a", "12:00", ["blu"]), stop("b", "18:00", ["gary"])])
  const c = checkMove(d, { orderId: "b", from: "gary", to: "blu" }, ctx)
  assert.equal(c.block, null)
  assert.deepEqual(c.clashes, [])
  assert.ok(c.worstLate! < 0)
})

test("two parties at the same time on one chef: the one he had has to give way", () => {
  const d = day([stop("a", "18:00", ["blu"]), stop("b", "18:00", ["gary"])])
  const c = checkMove(d, { orderId: "b", from: "gary", to: "blu" }, ctx)
  assert.deepEqual(c.clashes, ["a"])
  assert.deepEqual(c.swap, { ok: true, reason: null })
  // 互换：a 给 Gary，b 给 Blu
  assert.deepEqual(teamsAfter(d, { orderId: "b", from: "gary", to: "blu" }, c.clashes, "swap"), [
    { orderId: "b", team: ["blu"] },
    { orderId: "a", team: ["gary"] },
  ])
  // 放回未派：a 没人了
  assert.deepEqual(teamsAfter(d, { orderId: "b", from: "gary", to: "blu" }, c.clashes, "unassign")[1], { orderId: "a", team: [] })
})

test("a link that would be more than the limit late is a clash; a little late is only a warning", () => {
  // 4:00 开，拖满 6:00 走，30 分到 6:30；下一场 6:15 开 -> 迟到 15 分，提醒不算冲突
  const ok = day([stop("a", "16:00", ["blu"]), stop("b", "18:15", ["gary"])])
  const c1 = checkMove(ok, { orderId: "b", from: "gary", to: "blu" }, ctx)
  assert.deepEqual(c1.clashes, [])
  assert.equal(c1.worstLate, 15)
  assert.ok(c1.warnings.some((w) => w.includes("迟到 15 分")))
  // 下一场 5:00 开 -> 迟到 90 分，超过极限
  const bad = day([stop("a", "16:00", ["blu"]), stop("b", "17:00", ["gary"])])
  assert.deepEqual(checkMove(bad, { orderId: "b", from: "gary", to: "blu" }, ctx).clashes, ["a"])
})

test("tables on either party add 30 minutes to the link", () => {
  const d = day([stop("a", "16:00", ["blu"], { tables: true }), stop("b", "18:15", ["gary"])])
  assert.equal(checkMove(d, { orderId: "b", from: "gary", to: "blu" }, ctx).worstLate, 45)
})

test("only the parties that actually clash give way, not the chef's whole day", () => {
  const d = day([stop("a", "11:00", ["blu"]), stop("x", "18:00", ["blu"]), stop("b", "18:00", ["gary"])])
  assert.deepEqual(clashesFor(d, ["a", "x"], ["b"]), ["x"])
})

test("swap is offered only when the chef it came from can take the clashing party", () => {
  // Gary 还有一场 18:00，接不了 Blu 让出来的 18:00
  const d = day([stop("a", "18:00", ["blu"]), stop("b", "18:00", ["gary"]), stop("g2", "18:00", ["gary"])])
  const c = checkMove(d, { orderId: "b", from: "gary", to: "blu" }, ctx)
  assert.equal(c.swap?.ok, false)
  // 从未派拖过来的没有人可换
  const u = day([stop("a", "18:00", ["blu"]), stop("b", "18:00", [])])
  assert.equal(checkMove(u, { orderId: "b", from: null, to: "blu" }, ctx).swap?.ok, false)
})

test("blocked: already on it, party started, fully staffed from unassigned, chef not bookable", () => {
  const d = day([stop("a", "18:00", ["blu", "gary"], { plan: { chefs: 2 } })])
  assert.match(checkMove(d, { orderId: "a", from: "gary", to: "blu" }, ctx).block!, /已经在这单上/)
  assert.match(checkMove(d, { orderId: "a", from: null, to: "john" }, ctx).block!, /派够/)
  assert.match(checkMove(d, { orderId: "a", from: "gary", to: "john" }, { ...ctx, started: () => true }).block!, /开始/)
  assert.match(checkMove(d, { orderId: "a", from: "gary", to: "ghost" }, ctx).block!, /不在可派名单/)
})

test("warnings: requested chef, novices on hard or far parties, Eason over 15, 易非 as lead, taking a chef off", () => {
  const d = day([
    stop("a", "18:00", ["blu"], { requestedChefId: "blu", difficulty: { score: 4 }, address: "123 Main St, San Diego, CA 92101", guests: 20 }),
  ])
  const john = checkMove(d, { orderId: "a", from: "blu", to: "john" }, ctx).warnings.join("\n")
  assert.match(john, /客人点名要 Blu/)
  assert.match(john, /难 4 的场派给新手 John/)
  assert.match(john, /John 不去圣地亚哥/)
  assert.match(checkMove(d, { orderId: "a", from: "blu", to: "eason" }, ctx).warnings.join("\n"), /Eason 只接 15 人以下/)
  assert.match(checkMove(d, { orderId: "a", from: "blu", to: "yf" }, ctx).warnings.join("\n"), /易非只当帮手/)
  assert.match(checkMove(d, { orderId: "a", from: "blu", to: null }, ctx).warnings.join("\n"), /没有师傅了/)
})

test("week heads split a two-chef party evenly, kids already weighted", () => {
  const d = day([stop("a", "18:00", ["blu", "gary"], { guests: 32.5 }), stop("b", "12:00", ["blu"], { guests: 10 })])
  const h = weekHeads([d])
  assert.equal(h.get("blu")!.heads, 26.25)
  assert.equal(h.get("gary")!.heads, 16.25)
  assert.equal(h.get("blu")!.parties, 2)
})

// ---- 连台整组拖（老板 2026-11-26）

test("unassigned parties group by route line; a two-chef party fills one slot on each line", () => {
  // 11/28 的样子：Dave 1PM + Sylvia 6PM 一条线、Ashlyn 3PM + Sylvia 6PM 一条线，Sylvia 要 2 位
  const d = day([stop("dave", "13:00", []), stop("ash", "15:00", []), stop("syl", "18:00", [], { plan: { chefs: 2 } }), stop("solo", "19:00", [])])
  const g = unassignedGroups(d, [["dave", "syl"], ["ash", "syl"], ["solo"]])
  assert.deepEqual(g.groups, [["dave", "syl"], ["ash", "syl"]])
  assert.deepEqual(g.singles, ["solo"])
  // 第一组派给了 Eason 之后：Dave 满了，Sylvia 还缺 1 -> 只剩第二组
  const d2 = day([stop("dave", "13:00", ["eason"]), stop("ash", "15:00", []), stop("syl", "18:00", ["eason"], { plan: { chefs: 2 } }), stop("solo", "19:00", [])])
  assert.deepEqual(unassignedGroups(d2, [["dave", "syl"], ["ash", "syl"], ["solo"]]), { groups: [["ash", "syl"]], singles: ["solo"] })
})

test("dragging a whole line from unassigned puts the chef on every party of it", () => {
  const d = day([stop("dave", "13:00", []), stop("ash", "15:00", []), stop("syl", "18:00", [], { plan: { chefs: 2 } })])
  const m = { orderIds: ["dave", "syl"], from: null, to: "eason" }
  const c = checkGroupMove(d, m, ctx)
  assert.equal(c.block, null)
  assert.deepEqual(c.clashes, [])
  assert.deepEqual(teamsAfterGroup(d, m, c.clashes, "unassign"), [
    { orderId: "dave", team: ["eason"] },
    { orderId: "syl", team: ["eason"] },
  ])
})

test("a chef's whole day dropped on another chef's day swaps the two", () => {
  const d = day([stop("a", "12:00", ["blu"]), stop("b", "17:00", ["blu"]), stop("x", "12:00", ["gary"]), stop("y", "17:00", ["gary"])])
  const m = { orderIds: ["a", "b"], from: "blu", to: "gary" }
  const c = checkGroupMove(d, m, ctx)
  assert.deepEqual(c.clashes, ["x", "y"])
  assert.deepEqual(c.swap, { ok: true, reason: null })
  assert.deepEqual(teamsAfterGroup(d, m, c.clashes, "swap"), [
    { orderId: "a", team: ["gary"] },
    { orderId: "b", team: ["gary"] },
    { orderId: "x", team: ["blu"] },
    { orderId: "y", team: ["blu"] },
  ])
})

test("a group is blocked when the target chef is already on one of its parties", () => {
  const d = day([stop("dave", "13:00", []), stop("syl", "18:00", ["eason"], { plan: { chefs: 2 } })])
  const c = checkGroupMove(d, { orderIds: ["dave", "syl"], from: null, to: "eason" }, ctx)
  assert.match(c.block ?? "", /Eason 已经在 18:00 syl 上了/)
})

test("a group one person cannot run is blocked instead of half-assigned", () => {
  const d = day([stop("a", "17:00", []), stop("b", "17:30", [])])
  const c = checkGroupMove(d, { orderIds: ["a", "b"], from: null, to: "blu" }, ctx)
  assert.match(c.block ?? "", /跑不过来/)
})
