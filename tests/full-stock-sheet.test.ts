import assert from "node:assert/strict"
import { test } from "node:test"

import { fullAmount, fullLines, fullStockSheetHtml } from "../lib/full-stock-sheet"
import type { CoolerParty } from "../lib/cooler-sheet"

// 全量备货单（老板 2026-11-27「当天应该有的所有东西」「避免当天临时少东西」）。

const work = { chicken: 0, steak: 0, ribeye: 0, filet_mignon: 0, tofu: 0, mixed_vege: 0, fried_rice: 0 }
const party = (items: CoolerParty["items"], menuKnown = true): CoolerParty => ({ time: "下午 5:00", chef: null, adults: 10, kids: 0, menuKnown, work, items })

test("勾上的几场合在一起：同一样相加，蔬菜拆成四样，装备也在", () => {
  const a = party([
    { id: "steak", label: "Steak 牛排", qty: 80, unit: "oz", group: "protein" },
    { id: "mixed_vege", label: "蔬菜合计", qty: 100, unit: "oz", group: "produce" },
    { id: "chairs", label: "椅子", qty: 10, unit: "把", group: "setup" },
  ])
  const b = party([
    { id: "steak", label: "Steak 牛排", qty: 48, unit: "oz", group: "protein" },
    { id: "gyoza", label: "Gyoza 煎饺", qty: 20, unit: "pcs", group: "frozen" },
  ])
  const lines = fullLines([a, b])
  assert.deepEqual(lines.map((s) => s.title), ["肉和海鲜", "蔬菜、鸡蛋、沙拉", "前菜和面（冷冻）", "桌椅和装备"])
  assert.equal(lines[0].items[0].qty, 128)
  assert.equal(fullAmount(lines[0].items[0]), "8 磅")
  assert.equal(lines[1].items.length, 4)
  const html = fullStockSheetHtml("2026-11-28", [a, b])
  assert.match(html, /全量备货单/)
  assert.match(html, /椅子/)
  assert.match(html, /20 个/)
})

test("纸上的数按拿的东西写", () => {
  assert.equal(fullAmount({ id: "lobster_tail", qty: 36, unit: "oz" }), "6 只")
  assert.equal(fullAmount({ id: "tofu", qty: 25, unit: "oz" }), "2 盒")
  assert.equal(fullAmount({ id: "ginger_sauce", qty: 692, unit: "tbsp" }), "22 瓶")
  assert.equal(fullAmount({ id: "garlic_butter", qty: 173, unit: "tbsp" }), "11 根")
  assert.equal(fullAmount({ id: "fried_rice_seasoning", qty: 138.4, unit: "tbsp" }), "6 包")
  assert.equal(fullAmount({ id: "oil", qty: 173, unit: "tbsp" }), "173 汤匙")
  assert.equal(fullAmount({ id: "lime", qty: 8.5, unit: "pcs" }), "9 个")
  // 带子 2026-11-28 起清单上就是个数（每人 6 个），不再从 oz 折。
  assert.equal(fullAmount({ id: "scallops", qty: 21, unit: "pcs" }), "21 个")
})

test("菜单没定的场提示肉没算进去", () => {
  const html = fullStockSheetHtml("2026-11-28", [party([], false)])
  assert.match(html, /有 1 场菜还没定/)
})
