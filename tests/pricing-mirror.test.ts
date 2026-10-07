// Layer-1 self-test: config/pricing-rules.ts mirrors the invoice engine. The
// numbers come from tests/fixtures/bills.json, written by the invoice repo.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  cardProcessingFeeOn,
  CARD_SURCHARGE_RATE,
  DEFAULT_SALES_TAX_RATE,
  DEPOSIT_AMOUNT,
  MINIMUM_SPEND,
  PRICING_TERMS_V2_FROM,
  pricingTermsFor,
  salesTaxOn,
  CARD_PROCESSING_RATE,
  ZELLE_VENMO_RATE,
  zelleVenmoPriceOf,
} from "../config/pricing-rules"

const fixture = JSON.parse(readFileSync("tests/fixtures/bills.json", "utf8")) as {
  constants: Record<string, number | string>
  bills: Array<{ id: string; pricingTerms: string; cardFunding?: string | null; expected: { cashTotal: number; salesTax: number; salesTaxRate: number; cashBalanceBeforeTip: number; selectedGratuity: number; cardProcessingFee: number; deposit: number } }>
}
const r2 = (n: number) => Math.round(n * 100) / 100

test("mirror · the constants are the invoice engine's", () => {
  const c = fixture.constants
  assert.equal(CARD_PROCESSING_RATE, c.CARD_PROCESSING_RATE)
  assert.equal(DEFAULT_SALES_TAX_RATE, c.DEFAULT_SALES_TAX_RATE)
  assert.equal(ZELLE_VENMO_RATE, c.ZELLE_VENMO_RATE)
  assert.equal(MINIMUM_SPEND, c.MINIMUM_SPEND)
  assert.equal(DEPOSIT_AMOUNT, c.DEPOSIT_AMOUNT)
  assert.equal(CARD_SURCHARGE_RATE, c.CREDIT_CARD_FEE_RATE)
  assert.equal(PRICING_TERMS_V2_FROM, c.PRICING_TERMS_V2_FROM)
})

test("mirror · salesTaxOn and cardProcessingFeeOn reproduce the engine's tax and fee on every v2 bill", () => {
  for (const b of fixture.bills.filter((x) => x.pricingTerms === "v2_by_method")) {
    const e = b.expected
    assert.equal(salesTaxOn(e.cashTotal, e.salesTaxRate), e.salesTax, `${b.id} tax`)
    const charged = r2(e.cashBalanceBeforeTip + e.salesTax + e.selectedGratuity)
    assert.equal(cardProcessingFeeOn(charged, (b.cardFunding as "credit" | "debit" | "prepaid" | "unknown" | null | undefined) ?? "unknown"), e.cardProcessingFee, `${b.id} fee`)
  }
})

test("mirror · pricingTermsFor flips at 2026-10-06 00:00 PT like the engine", () => {
  assert.equal(pricingTermsFor("2026-10-06T06:59:59.000Z"), "v1_tax_included")
  assert.equal(pricingTermsFor("2026-10-06T07:00:00.000Z"), "v2_by_method")
  assert.equal(pricingTermsFor(null), "v2_by_method")
})

test("mirror · zelleVenmoPriceOf is cash x 1.04, rounded to the cent", () => {
  assert.equal(zelleVenmoPriceOf(1198), r2(1198 * 1.04))
  assert.equal(zelleVenmoPriceOf(0), 0)
})
