import assert from "node:assert/strict"
import { test } from "node:test"

import { workLines, coolerWork, type CoolerParty } from "../lib/cooler-sheet"
import { orderPrep, prepForLine, prepGuestsOf } from "../lib/prep-bom"

// 答应多带饭菜（老板 2026-11-20）：「多带点炒饭和蔬菜，怕多来人」——订 15 人、按 20 人带。RH-20261119-1164 当天
// 备料单按 15 人算出炒饭 120 oz、蔬菜 75 oz，答应的是 20 人，备注里只能手写 160 / 100。invoice_data.prepGuests
// 记这个数：饭、蔬菜、沙拉和配它们的蛋、酱按它备；蛋白、青柠、价格不动。镜像发票仓库 lib/pricing.ts basePrepOf。

const inv = (over: Record<string, unknown> = {}) => ({
  mode: "quick",
  adultCount: 15,
  childCount: 0,
  quickCountItems: [
    { itemId: "steak", category: "protein", qty: 15 },
    { itemId: "chicken", category: "protein", qty: 10 },
    { itemId: "shrimp", category: "protein", qty: 5 },
  ],
  ...over,
})
const prepOf = (over: Record<string, unknown> = {}) => orderPrep(inv(over) as never, "2026-11-19T18:00:00Z", 15, 0)
// The same menu, 20 booked: what the base food for 20 has to come to.
const twentyBooked = () => orderPrep(inv({ adultCount: 20 }) as never, "2026-11-19T18:00:00Z", 20, 0)
const qty = (p: ReturnType<typeof prepOf>, id: string) => p.items.find((i) => i.id === id)?.qty
const BASE_IDS = ["fried_rice", "salad", "mixed_vege", "eggs", "oil", "garlic_butter", "soy_sauce", "ginger_sauce", "ginger_dressing", "fried_rice_seasoning"]

test("prep guests · none: rice, vegetables and salad for the 15 booked, exactly as before", () => {
  const p = prepOf()
  assert.equal(qty(p, "fried_rice"), 120)
  assert.equal(qty(p, "salad"), 15)
  assert.ok((qty(p, "mixed_vege") ?? 0) < (qty(twentyBooked(), "mixed_vege") ?? 0))
  assert.equal(qty(p, "eggs"), 15)
  assert.deepEqual(p.base, { adults: 15, kids: 0 })
  assert.ok(!("prepFor" in p))
  assert.equal(prepForLine(p.prepFor), "")
})

test("prep guests · 20 promised on 15 booked: the base food for 20; proteins, lime and the headcount stay the order's", () => {
  const plain = prepOf()
  const p = prepOf({ prepGuests: 20 })
  assert.equal(qty(p, "fried_rice"), 160)
  assert.equal(qty(p, "salad"), 20)
  // Raw vegetables to buy for 20 (5 oz net a guest), the same as for a party of 20.
  assert.equal(qty(p, "mixed_vege"), qty(twentyBooked(), "mixed_vege"))
  assert.equal(qty(p, "eggs"), 20)
  for (const id of BASE_IDS) assert.equal(qty(p, id), qty(twentyBooked(), id), id)
  for (const [id, n] of [["oil", 20], ["garlic_butter", 20], ["soy_sauce", 20], ["ginger_sauce", 80], ["ginger_dressing", 40], ["fried_rice_seasoning", 16]] as const) {
    assert.equal(qty(p, id), n, id)
  }
  assert.deepEqual(p.proteinServings, plain.proteinServings)
  assert.deepEqual(p.items.filter((i) => i.group === "protein"), plain.items.filter((i) => i.group === "protein"))
  assert.equal(qty(p, "lime"), qty(plain, "lime"))
  for (const it of p.items) if (!BASE_IDS.includes(it.id)) assert.deepEqual(it, plain.items.find((x) => x.id === it.id), it.id)
  assert.equal(p.adults, 15)
  assert.equal(p.kids, 0)
  assert.deepEqual(p.base, { adults: 20, kids: 0 })
  assert.deepEqual(p.prepFor, { guests: 20, booked: 15 })
  assert.equal(prepForLine(p.prepFor), "备餐按 20 人（订单 15 人）")
})

test("prep guests · at or under the booking, or not a whole number of guests: nothing changes", () => {
  const plain = prepOf()
  for (const prepGuests of [15, 12, 0, -3, 17.5, "20", null, 501]) {
    const p = prepOf({ prepGuests })
    assert.deepEqual(p.items, plain.items, String(prepGuests))
    assert.ok(!("prepFor" in p), String(prepGuests))
  }
  assert.equal(prepGuestsOf({ prepGuests: 20 } as never), 20)
  assert.equal(prepGuestsOf({ prepGuests: "20" } as never), null)
  assert.equal(prepGuestsOf(null), null)
})

test("prep guests · the guests over the booking are adults; kids stay kids (10 + 5 kids, food for 20)", () => {
  const p = orderPrep(inv({ adultCount: 10, childCount: 5, prepGuests: 20 }) as never, "2026-11-19T18:00:00Z", 10, 5)
  assert.deepEqual(p.base, { adults: 15, kids: 5 })
  assert.equal(qty(p, "fried_rice"), 15 * 8 + 5 * 4)
  assert.equal(qty(p, "salad"), 17.5)
  assert.deepEqual(p.prepFor, { guests: 20, booked: 15 })
})

test("prep guests · the cooler sheet cooks the rice, dices the onion and cuts the vegetables for 20, the meat for the order", () => {
  const cooler = (p: ReturnType<typeof prepOf>): CoolerParty => ({
    time: "下午 5:00", chef: "Blu", adults: p.adults, kids: p.kids, ...(p.prepFor ? { baseHeads: p.prepFor.guests } : {}), menuKnown: true, work: coolerWork(p.items, true),
  })
  const line = (lines: ReturnType<typeof workLines>, label: string) => [...lines.meat, ...lines.vege, ...lines.rice].find((l) => l.label === label)?.amount
  const plain = workLines([cooler(prepOf())])
  const promised = workLines([cooler(prepOf({ prepGuests: 20 }))])
  assert.equal(line(plain, "熟米饭"), "7.5 磅") // 15 × 8 oz
  assert.equal(line(promised, "熟米饭"), "10 磅") // 20 × 8 oz
  assert.ok(promised.vegeNet > plain.vegeNet)
  // Everything on it - rice, the diced onion, every vegetable, and the meat (the same menu) - is a party of 20's.
  assert.deepEqual(promised, workLines([cooler(twentyBooked())]))
  // The meat is the order's: the same as without the promise.
  assert.deepEqual(promised.meat, plain.meat)
  // A baseHeads under the party's own headcount is not a promise.
  assert.equal(line(workLines([{ ...cooler(prepOf()), baseHeads: 5 }]), "熟米饭"), "7.5 磅")
})
