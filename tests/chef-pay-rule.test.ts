// Layer-2 self-test: the chef-pay head rule (lib/chef-pay.ts, owner 2026-10-10).
// April's 35 boys (12-13) sit on the invoice as adults so the prep sheet cooks adult portions,
// but the chef is paid kids' half heads - decided while negotiating, applied automatically.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { applyChefPayRule, chefPayCentsFrac, normalizeChefPayRule, payableHeads } from "../lib/chef-pay"

const STANDARD = { base_pay_cents: 13000, head_from: 10, per_head_cents: 1300 }

test("chef rule · April: 35 invoice adults, all counted as kids -> 17.5 heads, $227.50", () => {
  const rule = normalizeChefPayRule({ adultsAsKids: "all", note: "35 boys 12-13" })
  assert.deepEqual(rule, { adultsAsKids: "all", note: "35 boys 12-13" })
  const counts = applyChefPayRule({ adults: 35, kids: 0, littles: 0 }, rule)
  assert.deepEqual(counts, { adults: 0, kids: 35, littles: 0 })
  assert.equal(payableHeads(counts), 17.5)
  assert.equal(chefPayCentsFrac(STANDARD, payableHeads(counts)), 22750)
  // Without the rule the same invoice would pay 35 full heads.
  assert.equal(chefPayCentsFrac(STANDARD, payableHeads({ adults: 35, kids: 0, littles: 0 })), 45500)
})

test("chef rule · a number moves only that many adults; more than there are moves them all", () => {
  assert.deepEqual(applyChefPayRule({ adults: 20, kids: 4, littles: 2 }, { adultsAsKids: 10 }), { adults: 10, kids: 14, littles: 2 })
  // Headcount dropped after the deal: never negative adults.
  assert.deepEqual(applyChefPayRule({ adults: 30, kids: 0, littles: 0 }, { adultsAsKids: 35 }), { adults: 0, kids: 30, littles: 0 })
})

test("chef rule · no rule or a bad rule changes nothing", () => {
  const c = { adults: 13, kids: 2, littles: 1 }
  assert.deepEqual(applyChefPayRule(c, null), c)
  assert.equal(normalizeChefPayRule(null), null)
  assert.equal(normalizeChefPayRule({ adultsAsKids: 0 }), null)
  assert.equal(normalizeChefPayRule({ adultsAsKids: -3 }), null)
  assert.equal(normalizeChefPayRule({ adultsAsKids: "half" }), null)
  assert.deepEqual(normalizeChefPayRule({ adultsAsKids: "12.7" }), { adultsAsKids: 12 })
})
