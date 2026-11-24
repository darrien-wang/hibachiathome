// 外包单结算 (owner 2026-11-23, lib/partner-settlement.ts): we keep 30% of the order total (travel included);
// only card money is in our hands - Zelle and cash go to the partner. net = card money − our cut.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"

import { collectedByUs, directionOf, netText, paidToPartner, parseRatePct, partnerLine, ratePct, settledStatusOf, statementText, type PartnerPaymentRow } from "../lib/partner-settlement"

const pay = (o: Partial<PartnerPaymentRow>): PartnerPaymentRow => ({ provider: "stripe", type: "final", status: "paid", amount_cents: 0, refunded_amount_cents: null, transaction_ref: null, ...o })

test("collected · only card money is ours; Zelle and cash went to the partner", () => {
  const pays = [
    pay({ amount_cents: 50000 }),
    pay({ provider: "other", amount_cents: 20000, transaction_ref: "manual:cash" }),
    pay({ provider: "other", type: "deposit", amount_cents: 10000, transaction_ref: "manual:zelle" }),
  ]
  assert.equal(collectedByUs(pays), 50000)
  assert.equal(paidToPartner(pays), 30000)
})

test("collected · refunds come off, card-on-file holds never count", () => {
  assert.equal(collectedByUs([pay({ amount_cents: 50000, refunded_amount_cents: 10000 })]), 40000)
  assert.equal(collectedByUs([pay({ status: "refunded", amount_cents: 50000 })]), 0)
  assert.equal(collectedByUs([pay({ type: "card_on_file", amount_cents: 0 })]), 0)
  assert.equal(collectedByUs([pay({ status: "pending", amount_cents: 9000 })]), 0)
})

test("line · Michele: $732.30 all paid to the partner → they pay us 30% = $219.69", () => {
  const l = partnerLine(73230, 3000, 0)
  assert.equal(l.cutCents, 21969)
  assert.equal(l.netCents, -21969)
  assert.equal(directionOf(l.netCents), "receivable")
  assert.equal(settledStatusOf(l.netCents), "received")
  assert.equal(netText("Meet Hibachi", l.netCents), "Meet Hibachi 付我们 $219.69")
})

test("line · paid by card to us → we pay the partner the rest", () => {
  const l = partnerLine(60000, 3000, 60000)
  assert.equal(l.netCents, 42000)
  assert.equal(directionOf(l.netCents), "payable")
  assert.equal(settledStatusOf(l.netCents), "paid")
  assert.equal(netText("JustOne Hibachi", l.netCents), "我们付 JustOne Hibachi $420.00")
  assert.equal(netText("X", 0), "两清")
})

test("rate · parse and show percentages", () => {
  assert.equal(parseRatePct("30"), 3000)
  assert.equal(parseRatePct("27.5%"), 2750)
  assert.equal(parseRatePct("101"), null)
  assert.equal(parseRatePct("abc"), null)
  assert.equal(ratePct(3000), "30%")
  assert.equal(ratePct(2750), "27.5%")
})

test("statement · one line per party and a signed total, first names only", () => {
  const text = statementText("Meet Hibachi", [
    { date: "11/21", orderNo: "RH-1", customer: "Michele bulilis", guests: "11 大 2 小", city: "Vista", line: partnerLine(73230, 3000, 0) },
    { date: "12/05", orderNo: "RH-2", customer: "Nadine (Yelp)", guests: "6 大 5 小", city: "Dana Point", line: partnerLine(50000, 3000, 50000) },
  ])
  assert.match(text, /^Meet Hibachi 对账（2 单）/)
  assert.match(text, /11\/21 Michele Vista 11 大 2 小：总价 \$732\.30，我们 30% = \$219\.69，客人钱在你方 → 你方付我们 \$219\.69/)
  assert.match(text, /Nadine Dana Point/)
  assert.doesNotMatch(text, /bulilis/)
  assert.match(text, /合计：我们付你方 \$130\.31$/)
})
