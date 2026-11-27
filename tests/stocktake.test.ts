// 师傅盘点（2026-11-26，lib/stocktake.ts）：整包按规格、散的称重或数个数，都换成库存基准单位。
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"

import { STOCK_ITEMS, cleanLine, describeTotal, isDue, itemDef, lineText, looseUnits, totalBase, type CountLine } from "../lib/stocktake"
import { STOCK_UNITS } from "../lib/pantry"

const def = (k: string) => {
  const d = itemDef(k)
  assert.ok(d, k)
  return d
}

test("stocktake · order is short shelf-life first, the owner's 13 in his order", () => {
  assert.deepEqual(
    STOCK_ITEMS.slice(0, 13).map((i) => i.key),
    ["chicken", "steak", "filet_mignon", "salad", "zucchini", "broccoli", "shrimp", "salmon", "lobster_tail", "scallops", "gyoza", "spring_rolls", "edamame"],
  )
  for (const i of STOCK_ITEMS) assert.ok(STOCK_UNITS[i.key], `${i.key} has a pantry unit`)
})

test("stocktake · edamame: 12 oz bags and 16 oz bags plus a loose weigh, in 份 (12 oz)", () => {
  const e = def("edamame")
  const lines: CountLine[] = [
    { kind: "pack", specId: "b:edamame:12", specLabel: "12 oz/包", amount: 12, unit: "oz", packs: 4 },
    { kind: "pack", specId: "x", specLabel: "16 oz/包", amount: 16, unit: "oz", packs: 3 },
    { kind: "loose", amount: 0.75, unit: "lb" },
  ]
  assert.equal(totalBase(e, lines), 9) // 48 + 48 + 12 oz = 108 oz = 9 份
  assert.equal(lineText(e, lines[1]), "16 oz/包 × 3")
})

test("stocktake · chicken trays plus a loose tray weighed, in oz with guests", () => {
  const c = def("chicken")
  const total = totalBase(c, [
    { kind: "pack", specId: "b:chicken:tray", specLabel: "一盘 ≈4.5 lb", amount: 4.5, unit: "lb", packs: 3 },
    { kind: "loose", amount: 2.5, unit: "lb" },
  ])
  assert.equal(total, 256)
  assert.equal(describeTotal(c, total), "256 oz（16 lb） · ≈ 51 人份")
})

test("stocktake · counted by the piece: shrimp 只, lobster tails 6 oz, salmon portions 8 oz, zucchini 11 oz", () => {
  assert.equal(totalBase(def("shrimp"), [{ kind: "pack", specId: "b:shrimp:bag", specLabel: "一袋", amount: 32, unit: "piece", packs: 2 }, { kind: "loose", amount: 12, unit: "piece" }]), 76)
  assert.equal(totalBase(def("shrimp"), [{ kind: "loose", amount: 1, unit: "lb" }]), 18)
  assert.equal(totalBase(def("lobster_tail"), [{ kind: "loose", amount: 5, unit: "piece" }]), 30)
  assert.equal(totalBase(def("salmon"), [{ kind: "loose", amount: 3, unit: "piece" }]), 24)
  assert.equal(totalBase(def("zucchini"), [{ kind: "loose", amount: 4, unit: "piece" }]), 44)
  assert.deepEqual(looseUnits(def("shrimp")), ["piece", "lb", "oz"])
  assert.deepEqual(looseUnits(def("eggs")), ["piece"])
})

test("stocktake · nothing left is an empty list = 0; junk lines are refused", () => {
  assert.equal(totalBase(def("gyoza"), []), 0)
  assert.equal(cleanLine(def("eggs"), { kind: "loose", amount: 2, unit: "lb" }), null, "eggs cannot be weighed")
  assert.equal(cleanLine(def("chicken"), { kind: "loose", amount: -1, unit: "lb" }), null)
  assert.equal(cleanLine(def("chicken"), { kind: "pack", amount: 4.5, unit: "lb", packs: "x" }), null)
  assert.deepEqual(cleanLine(def("chicken"), { kind: "loose", amount: 3, unit: "lb", extra: 1 }), { kind: "loose", amount: 3, unit: "lb" })
})

test("stocktake · due: short shelf-life every PT day, frozen after 7 days", () => {
  const now = Date.parse("2026-11-26T20:00:00Z") // 12:00 PT
  assert.equal(isDue("meat", "2026-11-26T16:00:00Z", now), false) // 08:00 PT same day
  assert.equal(isDue("meat", "2026-11-26T07:00:00Z", now), true) // 23:00 PT the day before
  assert.equal(isDue("frozen", "2026-11-22T20:00:00Z", now), false)
  assert.equal(isDue("frozen", "2026-11-18T20:00:00Z", now), true)
  assert.equal(isDue("app", null, now), true)
})
