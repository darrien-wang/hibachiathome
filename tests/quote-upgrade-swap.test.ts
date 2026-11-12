// A premium upgrade takes the place of one of a guest's 2 proteins; it is not
// a third one. The invoice (lib/pricing.ts calcGuestProteinCost) bills each
// premium its upgrade and each protein past the 2 included $10 more, so a
// premium past the 2 is $18 filet / $16 scallops / $22 lobster tail.
// /quote added the picked upgrades up per guest ($26 for all three) under
// "Per guest who chooses it, on top of the 2 regular proteins." On 2026-11-08
// a 7 adult + 1 kid party picked all three, read the upgrades as chicken +
// shrimp + all three for everyone ($448 for 8 guests, not $208), and the owner
// walked it back on 11-11. The caption now says an upgrade swaps one of the 2.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { EXTRA_PROTEIN_PRICE, INCLUDED_PROTEINS_PER_PERSON } from "../config/pricing-rules"
import { premiumProteins } from "../config/menu-items"
import { renderLlmsTxt } from "../lib/ai-facts"
import { calculateQuote, upgradesPerGuestHigh, type QuoteAddOns, type QuoteInput } from "../lib/quote-builder"

// calcGuestProteinCost as the invoice repo has it (lib/pricing.ts): every
// premium carries its upgrade, every protein past the 2 included costs $10.
const PREMIUM: Record<string, number> = { scallops: 6, filet_mignon: 8, lobster_tail: 12 }
function calcGuestProteinCost(proteins: string[]): number {
  let cost = 0
  const extras = Math.max(0, proteins.length - 2)
  for (const pid of proteins) if (pid in PREMIUM) cost += PREMIUM[pid]
  cost += extras * 10
  return cost
}

const ID = { steak: "filet_mignon", shrimp: "scallops", lobster: "lobster_tail" } as const
const KEYS = ["steak", "shrimp", "lobster"] as const
/** Every way to pick the three buttons, none to all. */
const ALL_PICKS: QuoteAddOns[] = Array.from({ length: 8 }, (_, bits) => ({
  steak: Boolean(bits & 1),
  shrimp: Boolean(bits & 2),
  lobster: Boolean(bits & 4),
}))
const picked = (addOns: QuoteAddOns) => KEYS.filter((k) => addOns[k]).map((k) => ID[k])
/** The guest who has every picked upgrade: those, made up to 2 proteins with regular ones. */
const upgradedGuest = (addOns: QuoteAddOns) => [...picked(addOns), "chicken", "shrimp"].slice(0, Math.max(2, picked(addOns).length))

const party = (over: Partial<QuoteInput>): QuoteInput => ({
  eventDate: "2026-12-05", // a Saturday
  location: "Irvine",
  adults: 0,
  kids: 0,
  pricingTier: "standard",
  weekdaySaverProteins: { chicken: true, steak: true, shrimp: true },
  tablewareRental: false,
  tent10x10: false,
  addOns: { steak: false, shrimp: false, lobster: false },
  ...over,
})

test("swap · one or two upgrades cost just their upgrades: they take the place of the 2 included proteins", () => {
  for (const addOns of ALL_PICKS.filter((a) => picked(a).length >= 1 && picked(a).length <= 2)) {
    const sum = picked(addOns).reduce((s, id) => s + PREMIUM[id], 0)
    assert.equal(upgradesPerGuestHigh(addOns), sum, JSON.stringify(addOns))
    // Filet as one of the 2 next to chicken is $8; filet + lobster tail as both is $20.
    assert.equal(upgradesPerGuestHigh(addOns), calcGuestProteinCost(upgradedGuest(addOns)), JSON.stringify(addOns))
  }
  assert.equal(upgradesPerGuestHigh({ steak: true, shrimp: false, lobster: true }), 20)
})

test("swap · all three on one guest are a third protein: $36, never $26", () => {
  const all = { steak: true, shrimp: true, lobster: true }
  assert.equal(upgradesPerGuestHigh(all), 36, "$8 + $6 + $12 + $10 for the protein past the 2")
  assert.notEqual(upgradesPerGuestHigh(all), 26)
  assert.equal(upgradesPerGuestHigh(all), calcGuestProteinCost(["filet_mignon", "scallops", "lobster_tail"]))
  // Whichever one is the third, it costs $10 + its upgrade: $18 / $16 / $22.
  assert.equal(calcGuestProteinCost(["filet_mignon", "lobster_tail", "scallops"]) - calcGuestProteinCost(["filet_mignon", "lobster_tail"]), 16)
  assert.equal(upgradesPerGuestHigh({ steak: false, shrimp: false, lobster: false }), 0)
})

test("swap · every pick, 1-30 guests, either plan: the upgrades' high end is what the invoice bills that many guests", () => {
  for (const pricingTier of ["standard", "weekday_saver"] as const) {
    for (let adults = 1; adults <= 30; adults++) {
      for (const kids of [0, 2]) {
        for (const addOns of ALL_PICKS) {
          const q = calculateQuote(party({ eventDate: pricingTier === "weekday_saver" ? "2026-12-08" : "2026-12-05", adults, kids, pricingTier, addOns }))
          const label = `${adults}+${kids} ${pricingTier} ${JSON.stringify(addOns)}`
          assert.equal(q.addOnTotalRange.high, (adults + kids) * calcGuestProteinCost(upgradedGuest(addOns)), label)
          assert.equal(q.addOnTotalRange.low, 0, label)
        }
      }
    }
  }
})

test("swap · the 11-08 party: all three read 'up to +$208'; it is $288, and chicken + shrimp + all three is $448", () => {
  const q = calculateQuote(party({ eventDate: "2026-11-23", location: "Indio", adults: 7, kids: 1, addOns: { steak: true, shrimp: true, lobster: true } }))
  assert.equal(q.addOnTotalRange.high, 288, "8 guests x $36")
  // What she took the page to mean: 5 proteins a guest, 3 of them past the 2.
  assert.equal(8 * calcGuestProteinCost(["chicken", "shrimp", "filet_mignon", "scallops", "lobster_tail"]), 448)
})

test("swap · the prices are the menu's and the pricing rules'", () => {
  assert.equal(INCLUDED_PROTEINS_PER_PERSON, 2)
  assert.equal(EXTRA_PROTEIN_PRICE, 10)
  const menu = (id: string) => premiumProteins.find((p) => p.id === id)?.price
  assert.equal(upgradesPerGuestHigh({ steak: true, shrimp: false, lobster: false }), menu("filet"))
  assert.equal(upgradesPerGuestHigh({ steak: false, shrimp: true, lobster: false }), menu("scallops-premium"))
  assert.equal(upgradesPerGuestHigh({ steak: false, shrimp: false, lobster: true }), menu("lobster"))
})

test("llms.txt · an upgrade swaps one of the 2, and a premium past the 2 carries its upgrade", () => {
  const txt = renderLlmsTxt(false, new Date("2026-11-11T20:00:00Z"))
  assert.match(txt, /An upgrade swaps one of the guest's 2 included proteins; it does not add one\./)
  assert.match(txt, /A protein beyond the 2 is \+\$10 per guest, plus its upgrade if premium \(Filet Mignon \+\$18, Premium Sea Scallops \+\$16, Spiny Lobster Tail \+\$22\)\./)
  assert.match(txt, /chicken, shrimp and all 3 premiums for one guest = \+\$56\./)
  assert.doesNotMatch(txt, /A third protein is \+\$10 per guest\./)
})
