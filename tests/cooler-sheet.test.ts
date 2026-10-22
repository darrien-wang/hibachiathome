import assert from "node:assert/strict"
import { test } from "node:test"

import { coolerSheetHtml, coolerWork, workLines, zhDate, zhTime, type CoolerParty } from "../lib/cooler-sheet"
import { orderPrep } from "../lib/prep-bom"

const inv = {
  mode: "detailed",
  guests: [
    ...Array.from({ length: 10 }, () => ({ proteins: ["chicken", "steak"] })),
    ...Array.from({ length: 10 }, () => ({ proteins: ["chicken", "tofu"], noodles: true })),
  ],
  partyExtras: [{ id: "gyoza", qty: 2 }],
}

const party = (over: Partial<CoolerParty> = {}): CoolerParty => {
  const prep = orderPrep(inv as never, "2026-10-01T00:00:00Z", 20, 0)
  return { time: zhTime("2026-10-17T17:00:00+00:00"), chef: "Blu", adults: 20, kids: 0, menuKnown: true, work: coolerWork(prep.items, true), ...over }
}

test("coolerWork: only what logistics processes ahead - meat, tofu, vegetables, rice", () => {
  const w = party().work
  assert.equal(w.chicken, 100) // 20 × 5 oz
  assert.equal(w.steak, 45) // 10 × 4.5 oz
  assert.equal(w.tofu, 50)
  assert.ok(w.mixed_vege > 100) // raw weight, trimmed to net on the sheet
  assert.ok(w.fried_rice > 0)
  assert.deepEqual(Object.keys(w).sort(), ["chicken", "filet_mignon", "fried_rice", "mixed_vege", "ribeye", "steak", "tofu"])
})

test("coolerWork: menu not in yet - no meat or tofu, vegetables and rice by headcount", () => {
  const prep = orderPrep({ mode: "detailed", guests: [] } as never, "2026-10-01T00:00:00Z", 12, 0)
  const w = coolerWork(prep.items, prep.menuKnown)
  assert.equal(prep.menuKnown, false)
  assert.equal(w.chicken + w.steak + w.tofu, 0)
  assert.ok(w.mixed_vege > 0 && w.fried_rice > 0)
})

test("workLines: parties merged into one total; one onion volcano per party", () => {
  const { meat, vege, rice } = workLines([party(), party({ time: "晚上 7:30", chef: "Gary" })])
  const by = Object.fromEntries([...meat, ...vege, ...rice].map((l) => [l.label, l]))
  assert.equal(by["鸡胸肉 切块"].amount, "200 盎司")
  assert.equal(by["牛排 切块"].amount, "90 盎司")
  assert.equal(by["豆腐 切块"].amount, "7 盒") // 20 portions, three a box
  assert.equal(by["豆腐 切块"].note, "20 份 · 一盒三个人")
  // 40 guests × 5 oz net = 200, split like the chef sheet: 30 / 30 / 30 / 10 %
  assert.equal(by["西葫芦 切好"].amount, "60 盎司")
  assert.equal(by["西兰花 切好"].amount, "60 盎司")
  assert.equal(by["洋葱 切好"].amount, "60 盎司")
  assert.equal(by["胡萝卜 切好"].amount, "20 盎司")
  assert.equal(by["洋葱火山 切好"].amount, "2 个")
  assert.equal(by["熟米饭"].amount, "320 盎司") // 40 × 8 oz cooked
  assert.match(by["熟米饭"].note ?? "", /^每人 8 盎司（小孩 4）/)
  assert.equal(by["菲力 切块"], undefined)
  for (const l of [...meat, ...vege, ...rice]) assert.doesNotMatch(l.label + l.amount, /oz|lb|tbsp/)
})

test("coolerSheetHtml: one merged page, owner on it, no customer or price fields", () => {
  const html = coolerSheetHtml("2026-10-17", [party({ note: "牛排切大块" }), party({ time: "晚上 7:30", chef: null, adults: 12, kids: 2, menuKnown: false })], "张阿姨")
  assert.equal(zhDate("2026-10-17"), "10 月 17 日 星期六")
  assert.equal((html.match(/<section class="page">/g) ?? []).length, 1)
  assert.match(html, /共 2 场 · 32 位大人、2 位小孩/)
  assert.match(html, /备货负责人<\/small>张阿姨/)
  assert.match(html, /有 1 场菜还没定/)
  assert.match(html, /合计 200 盎司/) // both fixture parties carry the 20-guest work
  // no party list, no notes
  assert.doesNotMatch(html, /牛排切大块|是哪几场|厨师 Blu/)
  assert.match(html, /师傅自己来拿/)
  // nothing chefs take themselves
  assert.doesNotMatch(html, /虾|煎饺|Yum Yum|鸡蛋|黄油/)
  assert.doesNotMatch(html, /\$|RH-\d/)
})
