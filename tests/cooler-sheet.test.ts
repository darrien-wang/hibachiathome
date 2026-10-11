import assert from "node:assert/strict"
import { test } from "node:test"

import { coolerSections, coolerSheetHtml, zhDate, zhTime } from "../lib/cooler-sheet"
import { orderPrep } from "../lib/prep-bom"

const inv = {
  mode: "detailed",
  guests: [
    ...Array.from({ length: 10 }, () => ({ proteins: ["chicken", "steak"] })),
    ...Array.from({ length: 10 }, () => ({ proteins: ["chicken", "shrimp"], noodles: true })),
  ],
  partyExtras: [{ id: "gyoza", qty: 2 }],
}

test("coolerSections: Chinese labels, her units, nothing that stays out of the cooler", () => {
  const prep = orderPrep(inv as never, "2026-10-01T00:00:00Z", 20, 0)
  const sections = coolerSections(prep.items, prep.menuKnown)
  const lines = Object.fromEntries(sections.flatMap((s) => s.lines).map((l) => [l.id, l]))
  assert.deepEqual(sections.map((s) => s.title), ["肉和海鲜", "蔬菜", "饭、面、鸡蛋", "酱料和黄油", "前菜（冷冻）"])
  assert.equal(lines.chicken.amount, "100 盎司") // 20 × 5 oz
  assert.equal(lines.chicken.note, "约 6.3 磅 · 20 人份")
  // 西葫芦：10 个人 3.3 根（老板 2026-10-11 实测），20 人 ≈ 6.6 根
  assert.equal(lines.zucchini.amount, "73 盎司")
  assert.equal(lines.zucchini.note, "约 6.6 根")
  assert.equal(lines.broccoli.amount, "30 盎司")
  assert.equal(lines.shrimp.amount, "50 只")
  assert.equal(lines.ginger_sauce.amount, "40 盎司") // 20 × 2 oz
  assert.equal(lines.ginger_sauce.note, "约 3 盒（16 盎司一盒）")
  assert.equal(lines.gyoza.amount, "20 个")
  assert.equal(lines.noodles.label, "面条（煮好的）")
  for (const id of ["oil", "soy_sauce", "tables", "chairs", "utensils"]) assert.equal(lines[id], undefined)
  for (const l of Object.values(lines)) assert.doesNotMatch(l.label + l.amount, /oz|lb|tbsp|pcs/)
})

test("coolerSections: menu not in yet - no proteins, sides by headcount", () => {
  const prep = orderPrep({ mode: "detailed", guests: [] } as never, "2026-10-01T00:00:00Z", 12, 0)
  const sections = coolerSections(prep.items, prep.menuKnown)
  assert.equal(prep.menuKnown, false)
  assert.ok(!sections.some((s) => s.title === "肉和海鲜"))
  assert.ok(sections.some((s) => s.lines.some((l) => l.id === "eggs")))
})

test("coolerSheetHtml: one page per party, no customer or price fields", () => {
  const prep = orderPrep(inv as never, "2026-10-01T00:00:00Z", 20, 0)
  const html = coolerSheetHtml("2026-10-17", [
    { time: zhTime("2026-10-17T17:00:00+00:00"), chef: "Blu", adults: 20, kids: 0, menuKnown: true, sections: coolerSections(prep.items, true) },
    { time: zhTime("2026-10-17T19:30:00+00:00"), chef: null, adults: 12, kids: 2, menuKnown: false, sections: [] },
  ])
  assert.equal(zhDate("2026-10-17"), "10 月 17 日 星期六")
  assert.equal((html.match(/<section class="page">/g) ?? []).length, 2)
  assert.match(html, /第 1 箱/)
  assert.match(html, /下午 5:00 开席 · 厨师 Blu/)
  assert.match(html, /晚上 7:30 开席/)
  assert.match(html, /菜还没定/)
  assert.doesNotMatch(html, /\$|RH-\d/)
})
