import assert from "node:assert/strict"
import { test } from "node:test"

import { BUY_UNITS, aggregatePrep, orderPrep, setupCountsOf } from "../lib/prep-bom"
import { tableChairCents } from "../lib/chef-pay"

// A party where everyone has steak: `adults` adult servings, `kids` kid servings.
const steakLine = (adults: number, kids = 0) => {
  const inv = { mode: "quick", adultCount: adults, childCount: kids, quickCountItems: [{ itemId: "steak", category: "protein", qty: adults, childQty: kids }] }
  const line = orderPrep(inv as never, "2026-10-12T00:00:00Z", adults, kids).items.find((i) => i.id === "steak")
  assert.ok(line, "steak line")
  return line
}
const packsInHint = (alt: string | undefined) => Number(/买 (\d+) 盒/.exec(alt ?? "")?.[1])

test("prep · steak portions are untouched: 4.5 oz an adult, 2.25 oz a kid", () => {
  assert.equal(steakLine(10).qty, 45)
  assert.equal(steakLine(10, 4).qty, 54)
  assert.equal(steakLine(10).unit, "oz")
})

test("prep · steak is bought in Costco top sirloin packs (about 3.2 lb): need x 1.1, rounded up to whole packs", () => {
  assert.equal(steakLine(10).alt, "≈ 2.8 lb，买 1 盒（Costco Top Sirloin ≈3.2lb/盒）") // 45 oz x 1.1 = 49.5 <= 51
  assert.equal(packsInHint(steakLine(11).alt), 2) // 54.45 oz with the buffer is just over one 51 oz pack: never less
  assert.equal(packsInHint(steakLine(12).alt), 2) // 59.4 oz
  assert.equal(packsInHint(steakLine(20).alt), 2) // 99 oz
  assert.equal(packsInHint(steakLine(30).alt), 3) // 148.5 oz
  assert.doesNotMatch(steakLine(20).alt ?? "", /Family Pack|Walmart/)
})

test("prep · the warehouse planner buys the same number of steak packs as the order page says", () => {
  for (let adults = 1; adults <= 80; adults++) {
    for (const kids of [0, 3]) {
      const line = steakLine(adults, kids)
      assert.equal(Math.max(1, Math.ceil(line.qty / BUY_UNITS.steak.per)), packsInHint(line.alt), `${adults} adults, ${kids} kids`)
    }
  }
})

test("prep · two parties on one day: the steak hint is recomputed on the day's total", () => {
  const day = aggregatePrep([steakLine(8), steakLine(8)]).find((i) => i.id === "steak")
  assert.equal(day?.qty, 72)
  assert.equal(packsInHint(day?.alt), 2) // 79.2 oz with the buffer; one pack each would have been 2 as well
})

test("prep · a free appetizer goes by the head: 2.6 trays are 26 rolls, 1.1 trays 11 gyoza, whole pieces", () => {
  const inv = { mode: "quick", adultCount: 26, childCount: 0, quickCountItems: [], partyExtras: [{ id: "spring_rolls", qty: 2.6 }, { id: "gyoza", qty: 1.1 }] }
  const items = orderPrep(inv as never, "2026-10-12T00:00:00Z", 26, 0).items
  assert.equal(items.find((i) => i.id === "spring_rolls")?.qty, 26)
  assert.equal(items.find((i) => i.id === "gyoza")?.qty, 11)
})

// What one order loads: [id, qty, unit] for each setup row.
const setupRows = (inv: Record<string, unknown>) =>
  orderPrep(inv as never, "2026-10-20T00:00:00Z", 0, 0).items.filter((i) => i.group === "setup").map((i) => [i.id, i.qty, i.unit])

test("prep · cloths rented on their own for the customer's tables are a setup row of their own, on top of the rented tables' (2026-11-03)", () => {
  // RH-20261020-4480: place settings on all 28 rows, 5 cloths, no tables.
  const guests = Array.from({ length: 28 }, () => ({ proteins: ["chicken", "steak"], utensils: true }))
  assert.deepEqual(setupRows({ mode: "detailed", adultCount: 28, childCount: 0, guests, partyExtras: [{ id: "white_linen", qty: 5 }] }), [
    ["tablecloths", 5, "条"],
    ["utensils", 28, "套"],
  ])
  assert.deepEqual(setupRows({ mode: "quick", adultCount: 18, childCount: 0, partyExtras: [{ id: "tables_chairs", qty: 18 }, { id: "white_linen", qty: 3 }] }), [
    ["tables", 5, "张"],
    ["chairs", 18, "把"],
    ["tablecloths", 3, "条"],
  ])
})

test("prep · chairs beyond the guests who eat ride on the party line next to the rows, and are loaded too (2026-11-06)", () => {
  // RH-20261029-8929: 28 diners with chairs on their rows, 2 more chairs for guests who are not eating.
  const guests = Array.from({ length: 28 }, () => ({ proteins: ["steak", "shrimp"], tablesChairs: true }))
  assert.deepEqual(setupRows({ mode: "detailed", adultCount: 28, childCount: 0, guests, partyExtras: [{ id: "tables_chairs", qty: 2 }] }), [
    ["tables", 8, "张"],
    ["chairs", 30, "把"],
  ])
})

test("prep · noodles staff put on the party before the rows still cook next to the guests' own picks (2026-11-06)", () => {
  const guests = Array.from({ length: 10 }, (_, i) => ({ proteins: ["chicken", "steak"], noodles: i < 2 }))
  const inv = { mode: "detailed", adultCount: 10, childCount: 0, guests, partyExtras: [{ id: "noodles_party", qty: 4 }] }
  const noodles = orderPrep(inv as never, "2026-10-20T00:00:00Z", 0, 0).items.find((i) => i.id === "noodles")
  const rowsOnly = orderPrep({ ...inv, partyExtras: [] } as never, "2026-10-20T00:00:00Z", 0, 0).items.find((i) => i.id === "noodles")
  assert.ok(noodles && rowsOnly)
  assert.equal(Math.round((noodles.qty / rowsOnly.qty) * 10) / 10, 3, "6 servings, not the rows' 2")
})

test("prep · white cloths on their own ($8 from 2026-11-03) are a row of their own, packed from the white stock", () => {
  assert.deepEqual(setupRows({ mode: "quick", adultCount: 18, childCount: 0, partyExtras: [{ id: "white_tablecloth", qty: 4 }, { id: "white_linen", qty: 2 }] }), [
    ["tablecloths", 2, "条"],
    ["white_tablecloths", 4, "条"],
  ])
})

// Chairs and tables rented by the piece (owner 2026-11-06, D-1106-03: yes or no, and the chef
// brings what the order says). Lawrence (RH-20261029-8929) had his own tables and rented 30
// chairs; the package could only say "28 guests with tables & chairs", so the load list read
// 7 tables, 7 cloths and 28 chairs. Mirrors the invoice's calcBom (tests/setup-pieces.test.ts there).
test("prep · chairs on their own load as chairs only: no tables, no cloths", () => {
  const guests = Array.from({ length: 28 }, () => ({ proteins: ["steak", "shrimp"] }))
  assert.deepEqual(setupRows({ mode: "detailed", adultCount: 28, childCount: 0, guests, partyExtras: [{ id: "folding_chairs", qty: 30 }] }), [["chairs", 30, "把"]])
})

test("prep · tables on their own come bare: a row of their own, and a cloth only when a cloth line is on the order", () => {
  assert.deepEqual(setupRows({ mode: "quick", adultCount: 16, childCount: 0, partyExtras: [{ id: "folding_tables", qty: 4 }] }), [["tables_bare", 4, "张"]])
  assert.deepEqual(setupRows({ mode: "quick", adultCount: 16, childCount: 0, partyExtras: [{ id: "folding_tables", qty: 4 }, { id: "white_linen", qty: 4 }] }), [
    ["tables_bare", 4, "张"],
    ["tablecloths", 4, "条"],
  ])
})

test("prep · pieces add to the package: 18 guests with tables & chairs, plus 2 chairs or 1 table", () => {
  assert.deepEqual(setupRows({ mode: "quick", adultCount: 18, childCount: 0, partyExtras: [{ id: "tables_chairs", qty: 18 }, { id: "folding_chairs", qty: 2 }] }), [
    ["tables", 5, "张"],
    ["chairs", 20, "把"],
  ])
  assert.deepEqual(setupRows({ mode: "quick", adultCount: 18, childCount: 0, partyExtras: [{ id: "tables_chairs", qty: 18 }, { id: "folding_tables", qty: 1 }] }), [
    ["tables", 5, "张"],
    ["tables_bare", 1, "张"],
    ["chairs", 18, "把"],
  ])
})

test("chef pay · the table money counts the party line too, and pieces go by the piece", () => {
  // Yasmin (RH-20261016-2338, 11-06): tables & chairs for 16 on the party line, no rows. Before
  // 2026-11-06 the ledger counted only rows, so Gary's tables came to $0.
  const yasmin = setupCountsOf({ mode: "quick", adultCount: 16, childCount: 0, partyExtras: [{ id: "tables_chairs", qty: 16 }] } as never)
  assert.equal(yasmin.tcPersons, 16)
  assert.equal(tableChairCents(yasmin.tcPersons), 6400)
  // Rows and the line add up, as the bill does.
  const rows = Array.from({ length: 10 }, (_, i) => ({ proteins: ["steak"], tablesChairs: i < 8 }))
  assert.equal(setupCountsOf({ mode: "detailed", adultCount: 10, childCount: 0, guests: rows, partyExtras: [{ id: "tables_chairs", qty: 2 }] } as never).tcPersons, 10)
  // Lawrence's 30 chairs on their own, and 2 bare tables: $2 a chair, nothing for a table (owner 11-06).
  const pieces = setupCountsOf({ mode: "quick", adultCount: 28, childCount: 0, partyExtras: [{ id: "folding_chairs", qty: 30 }, { id: "folding_tables", qty: 2 }] } as never)
  assert.deepEqual([pieces.tcPersons, pieces.chairsOnly, pieces.bareTables], [0, 30, 2])
  assert.equal(tableChairCents(0, { chairs: pieces.chairsOnly, tables: pieces.bareTables }), 6000)
  assert.equal(tableChairCents(0, { tables: 4 }), 0)
})

// D-1112-03 (owner 2026-11-12 「不带」): a free little kid (3-4) gets no protein from the 11-13 parties on,
// whatever the party page picked for them; earlier parties keep what their sheets said.
test("prep · little kids (3-4) picked steak: no protein from 11-13 on, a kid's portion before", () => {
  const guests = [
    { proteins: ["steak", "chicken"], isChild: false },
    { proteins: ["steak", "chicken"], isChild: true },
    { proteins: ["steak", "chicken"], isChild: true, isLittle: true },
  ]
  const on = (day: string) => ({ mode: "detailed", adultCount: 1, childCount: 2, guests, contactInfo: { eventDate: day } })
  const servings = (day: string) => orderPrep(on(day) as never, "2026-10-12T00:00:00Z", 1, 2).proteinServings.find((p) => p.id === "steak")
  assert.deepEqual([servings("2026-11-12")?.adults, servings("2026-11-12")?.kids], [1, 2], "11-12: the little one still on a kid's portion")
  assert.deepEqual([servings("2026-11-13")?.adults, servings("2026-11-13")?.kids], [1, 1], "11-13: only the 5-12 kid")
  const steakOz = (day: string) => orderPrep(on(day) as never, "2026-10-12T00:00:00Z", 1, 2).items.find((i) => i.id === "steak")?.qty
  assert.equal(steakOz("2026-11-12"), 9)
  assert.equal(steakOz("2026-11-13"), 6.8)
})
