// Layer-1 self-test: /pay's arithmetic against the invoice engine's numbers.
// tests/fixtures/bills.json is written by the invoice repo (`npm run
// test:fixture` there) - the engine is the source of truth, this side must
// reproduce its card charge from the same cash balance, tax and tip.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { cardPrice, cardPriceWithTip, cardProcessingFeeFor, checkoutDescription, splitCardPayment, V1_TERMS, type PayTerms } from "../lib/pay-link-math"

type Bill = {
  id: string
  note: string
  paymentMethod: "cash" | "credit_card"
  pricingTerms: "v1_tax_included" | "v2_by_method"
  cardFunding?: "credit" | "debit" | "prepaid" | "unknown" | null
  expected: {
    cashTotal: number
    cashBalanceDue: number
    cashBalanceBeforeTip: number
    selectedGratuity: number
    salesTax: number
    salesTaxRate: number
    salesTaxRateSource: "address" | "default" | "none"
    cardProcessingFee: number
    cardTotal: number
    cardBalanceDue: number
    finalTotal: number
    balanceDue: number
    deposit: number
  }
}
const fixture = JSON.parse(readFileSync("tests/fixtures/bills.json", "utf8")) as { bills: Bill[] }
const r2 = (n: number) => Math.round(n * 100) / 100

function termsOf(b: Bill): PayTerms {
  if (b.pricingTerms !== "v2_by_method") return V1_TERMS
  return { version: "v2", taxDollars: b.expected.salesTax, taxRate: b.expected.salesTaxRate, taxRateSource: b.expected.salesTaxRateSource, cashBalance: b.expected.cashBalanceBeforeTip }
}

// /pay runs through Stripe Checkout with whatever card the customer enters, so
// it cannot know about a debit card up front: the debit bill (fee 0 in the
// engine, for the card-on-file path) is not a /pay case. The engine and the
// chef sheet tests cover it.
for (const b of fixture.bills.filter((x) => x.cardFunding !== "debit" && x.cardFunding !== "prepaid")) {
  const e = b.expected
  const terms = termsOf(b)

  test(`/pay · ${b.id}: the card charge equals the invoice's cardBalanceDue`, () => {
    const charge = cardPriceWithTip(e.cashBalanceBeforeTip, e.selectedGratuity, terms)
    assert.equal(charge, e.cardBalanceDue, `${b.id}: ${charge} vs engine ${e.cardBalanceDue}`)
    if (e.selectedGratuity === 0) assert.equal(cardPrice(e.cashBalanceBeforeTip, terms), e.cardBalanceDue)
    assert.equal(cardProcessingFeeFor(e.cashBalanceBeforeTip, e.selectedGratuity, terms), b.pricingTerms === "v2_by_method" ? e.cardProcessingFee : 0)
  })

  // Audit 2026-10-06 item 3: the bill is grossed up so that Stripe's 2.9% + 30c
  // of the charge IS the fee line; the split nets that same take, so a full
  // payment covers the cash balance to the cent and the rest is the tip.
  test(`/pay · ${b.id}: paying the full card balance settles the party and leaves exactly the tip`, () => {
    const split = splitCardPayment(e.cardBalanceDue, e.cashBalanceBeforeTip, terms)
    assert.equal(split.chargeCents, Math.round(e.cardBalanceDue * 100))
    assert.equal(split.towardBalanceCents, Math.round(e.cashBalanceBeforeTip * 100), "the whole cash balance is covered")
    assert.equal(split.taxCents, Math.round(e.salesTax * 100))
    assert.equal(split.tipCents, Math.round(e.selectedGratuity * 100), `tip ${split.tipCents / 100} vs ${e.selectedGratuity}`)
    // v1: the fee is the 4% between the cash and card balances (a cash invoice carries none itself).
    const expectedFee = b.pricingTerms === "v2_by_method" ? e.cardProcessingFee : r2(e.cardBalanceDue - e.cashBalanceDue)
    assert.equal(split.feeCents, Math.round(expectedFee * 100), `fee ${split.feeCents / 100} vs engine ${expectedFee}`)
  })
}

test("/pay · v2: a payment smaller than tax + fee buys nothing toward the balance, and never goes negative", () => {
  const terms: PayTerms = { version: "v2", taxDollars: 119.8, taxRate: 0.1, taxRateSource: "address", cashBalance: 1198 }
  const split = splitCardPayment(50, 1198, terms)
  assert.equal(split.towardBalanceCents, 0)
  assert.equal(split.tipCents, 0)
  assert.ok(split.feeCents > 0)
})

test("/pay · v1: ×1.04 both ways, the tip is in the 4% too", () => {
  assert.equal(cardPrice(1000), 1040)
  assert.equal(cardPriceWithTip(1000, 200), r2(1200 * 1.04))
  const split = splitCardPayment(1248, 1000)
  assert.equal(split.towardBalanceCents, 100000)
  assert.equal(split.tipCents, 20000)
  assert.equal(split.taxCents, 0)
})

test("/pay · the Stripe line never prints a cash-basis amount", () => {
  const terms: PayTerms = { version: "v2", taxDollars: 119.8, taxRate: 0.1, taxRateSource: "address", cashBalance: 1198 }
  const full = splitCardPayment(1356.32, 1198, terms)
  const text = checkoutDescription(full, 1198, terms)
  assert.doesNotMatch(text, /\$\d/, "no dollar figure in the description")
  assert.match(text, /sales tax and card processing/)
  const tipOnly = splitCardPayment(100, 0, terms)
  assert.match(checkoutDescription(tipOnly, 0, terms), /^Gratuity for your chef/)
})
