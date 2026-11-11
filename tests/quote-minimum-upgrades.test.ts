// /quote measures the $599 minimum the way the invoice bills it: on food +
// premium upgrades + rentals (calcInvoiceTotal: subtotal = baseCost +
// proteinUpgrades + appetizersCost + addonsCost + partyExtrasCost, then
// max(subtotal, MINIMUM_SPEND), travel on top). The breakdown measured it on
// the food alone: on 2026-11-08 Nicole Weston (7 adults + 1 kid, Mon 11/23 in
// Indio, filet + scallops + lobster tail = $208) read "$599 event minimum
// applied +$149.80" above her upgrades, though $449.20 + $208 = $657.20 is
// past the minimum and the invoice adds nothing. ($208 was the page's sum of
// the three; since 2026-11-11 it prices them the invoice's way, $288 for her
// 8 guests: tests/quote-upgrade-swap.test.ts.)
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { FULL_SETUP_PER_GUEST, GUEST_TIERS, MINIMUM_SPEND } from "../config/pricing-rules"
import { calculateQuote, weekdaySpecialSavings, type QuoteInput, type QuoteResult } from "../lib/quote-builder"

const r2 = (n: number) => Math.round(n * 100) / 100

// A guest's proteins as the invoice prices them (lib/pricing.ts
// calcGuestProteinCost): each premium its upgrade, each protein past the 2
// included $10 more. Until 2026-11-11 this helper added the picked upgrades up
// ($26 for all three), the same mistake as the page; all three are $36.
const PREMIUM: Record<string, number> = { filet_mignon: 8, scallops: 6, lobster_tail: 12 }
const guestProteinCost = (proteins: string[]) =>
  proteins.reduce((sum, p) => sum + (PREMIUM[p] ?? 0), 0) + Math.max(0, proteins.length - 2) * 10
/** The guest who takes every upgrade picked: those, made up to 2 proteins with regular ones. */
const upgradedGuest = (addOns: QuoteInput["addOns"]) => {
  const picked = [addOns.steak && "filet_mignon", addOns.shrimp && "scallops", addOns.lobster && "lobster_tail"].filter(
    (p): p is string => Boolean(p),
  )
  return [...picked, "chicken", "shrimp"].slice(0, Math.max(2, picked.length))
}
const NO_UPGRADES = { steak: false, shrimp: false, lobster: false }
const SCALLOPS = { steak: false, shrimp: true, lobster: false }
const ALL_THREE = { steak: true, shrimp: true, lobster: true }

const party = (over: Partial<QuoteInput>): QuoteInput => ({
  eventDate: "2026-12-05", // a Saturday
  location: "Irvine",
  adults: 0,
  kids: 0,
  pricingTier: "standard",
  weekdaySaverProteins: { chicken: true, steak: true, shrimp: true },
  tablewareRental: false,
  tent10x10: false,
  addOns: NO_UPGRADES,
  ...over,
})

/** The step-3 breakdown added up: food, rentals, the upgrades as picked, the minimum's line. */
const lines = (q: QuoteResult) => r2(q.baseSubtotal + q.tablewareFee + q.addOnTotalRange.high + q.minimumTopUp)

/**
 * calcInvoiceTotal for the same party, worked from the inputs: baseCost +
 * proteinUpgrades + partyExtrasCost (tables & chairs $10 + utensils $5 a
 * guest), the floor, then travel. The Weekday Special is a promotion that
 * comes off before the floor, which is the same as pricing at its rates.
 */
function invoiceTotal(input: QuoteInput, travel = 0): number {
  const weekday = input.pricingTier === "weekday_saver"
  const guests = input.adults + input.kids
  const baseCost =
    input.adults * (weekday ? GUEST_TIERS.adult.weekdayPrice : GUEST_TIERS.adult.price) +
    input.kids * (weekday ? GUEST_TIERS.child.weekdayPrice : GUEST_TIERS.child.price)
  const proteinUpgrades = guests * guestProteinCost(upgradedGuest(input.addOns))
  const partyExtrasCost = input.tablewareRental ? guests * FULL_SETUP_PER_GUEST : 0
  return r2(Math.max(baseCost + proteinUpgrades + partyExtrasCost, MINIMUM_SPEND) + travel)
}

test("minimum · Nicole 11-08: 7 adults + 1 kid with all three upgrades are past $599, so there is no minimum line", () => {
  const input = party({ eventDate: "2026-11-23", location: "Indio", adults: 7, kids: 1, addOns: ALL_THREE })
  const q = calculateQuote(input)
  assert.equal(q.weekdaySaver.isWeekdayEligible, false, "Mon 11/23 is Thanksgiving week: Standard rates")
  assert.equal(q.baseSubtotal, 449.2, "7 x $59.90 + 1 x $29.90")
  assert.equal(q.addOnTotalRange.high, 288, "8 guests x ($8 + $6 + $12 + $10 for the third protein); it read $208 until 11-11")
  assert.equal(q.minimumTopUp, 0, "the page showed +$149.80 here")
  assert.equal(q.totalRange.high, 737.2)
  assert.equal(q.totalRange.high, invoiceTotal(input), "what the invoice bills")
  assert.equal(lines(q), q.totalRange.high, "the lines add up to the total")
  // Nobody taking an upgrade leaves the food alone, under $599: the low end is the minimum.
  assert.equal(q.totalRange.low, MINIMUM_SPEND)
})

test("minimum · 4 adults + scallops are still under $599: the minimum tops up to $599 with the upgrade inside it", () => {
  const q = calculateQuote(party({ adults: 4, addOns: SCALLOPS }))
  assert.equal(q.baseSubtotal, 239.6)
  assert.equal(q.addOnTotalRange.high, 24)
  assert.equal(q.minimumTopUp, 335.4, "$599 - ($239.60 + $24); the page showed +$359.40")
  assert.deepEqual(q.totalRange, { low: 599, high: 599 }, "$599, not $599 + $24")
  assert.equal(lines(q), MINIMUM_SPEND)
})

test("minimum · rentals count toward it like upgrades: 4 adults + full setup + scallops top up $275.40", () => {
  const q = calculateQuote(party({ adults: 4, tablewareRental: true, addOns: SCALLOPS }))
  assert.equal(q.tablewareFee, 4 * FULL_SETUP_PER_GUEST)
  assert.equal(q.minimumTopUp, 275.4, "$599 - ($239.60 + $60 + $24); the page showed +$359.40 and the $60 again below it")
  assert.equal(q.totalRange.high, MINIMUM_SPEND)
  assert.equal(lines(q), MINIMUM_SPEND)
})

test("minimum · travel stays outside it, as on the invoice", () => {
  const input = party({ adults: 4, addOns: SCALLOPS })
  const q = calculateQuote(input, { low: 80, high: 80 })
  assert.equal(q.minimumTopUp, 335.4, "the drive does not fill the minimum")
  assert.deepEqual(q.totalRange, { low: 679, high: 679 })
  assert.equal(q.totalRange.high, invoiceTotal(input, 80))
})

test("minimum · every party up to 14 adults, either plan: the lines add up to what the invoice bills", () => {
  const picks = [NO_UPGRADES, SCALLOPS, { steak: true, shrimp: false, lobster: false }, { steak: false, shrimp: false, lobster: true }, ALL_THREE]
  for (const pricingTier of ["standard", "weekday_saver"] as const) {
    for (let adults = 1; adults <= 14; adults++) {
      for (const kids of [0, 1, 3]) {
        for (const tablewareRental of [false, true]) {
          for (const addOns of picks) {
            // 12/8 is a Tuesday outside the holiday blackouts.
            const input = party({ eventDate: pricingTier === "weekday_saver" ? "2026-12-08" : "2026-12-05", adults, kids, pricingTier, tablewareRental, addOns })
            const q = calculateQuote(input)
            const label = `${adults}+${kids} ${pricingTier} setup=${tablewareRental} ${JSON.stringify(addOns)}`
            assert.equal(q.totalRange.high, invoiceTotal(input), label)
            assert.equal(lines(q), q.totalRange.high, label)
            assert.ok(q.minimumTopUp >= 0, label)
          }
        }
      }
    }
  }
})

test("weekday saving · 8 adults on a Tuesday with all three upgrades save $40; on food alone it read $0", () => {
  const input = party({ eventDate: "2026-12-08", adults: 8, addOns: ALL_THREE })
  // Standard 8 x $59.90 + $288 = $767.20; Weekday Special 8 x $54.90 + $288 = $727.20.
  assert.equal(weekdaySpecialSavings(input), 40)
  assert.equal(weekdaySpecialSavings({ ...input, addOns: NO_UPGRADES }), 0, "both plans sit at the $599 minimum")
  assert.equal(weekdaySpecialSavings(party({ eventDate: "2026-12-08", adults: 15 })), 75, "a party past the minimum: $5 an adult, as before")
})
