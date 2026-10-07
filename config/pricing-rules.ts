// ============================================================
// Real Hibachi — Pricing Rules (single source of truth)
// ============================================================
// Every price, rate, threshold and fee lives here. Nothing else in the
// codebase may hard-code a money value or a policy threshold: API defaults,
// schema docs, UI copy and the printed invoice all read from this file.
//
// Mirrored from v0-real-hibachi-invoice-generator/lib/pricing-rules.ts —
// keep the two in sync whenever a rule changes. The invoice app is the
// source; this copy exists so the marketing site quotes the same numbers.

export const PRICING_RULES_VERSION = "2026-08-27"

// ---------------------------------------------------------------
// Guest tiers
// ---------------------------------------------------------------
// Ages are inclusive lower bounds: adult = 13+, child = 5-12, toddler = under 5.
export type GuestTier = "adult" | "child" | "toddler"

export const GUEST_TIERS = {
  adult: {
    id: "adult" as const,
    label: "Adult",
    ageLabel: "13+",
    price: 59.9,
    // 2026-09-08: $45.90 -> $54.90. The old 23% cut mostly reached parties that
    // were booking Mon-Thu anyway, and its 15-guest gate made a 14-guest party
    // $150 dearer than a 15-guest one. A small nudge plus a free appetizer
    // platter reaches the genuinely flexible host without reading as a weekend
    // surcharge to everyone else (docs/决策日志.md).
    weekdayPrice: 54.9,
    /** Counts as one whole guest for adult-equivalent headcounts. */
    adultEquivalent: 1,
    /** Gets the full included-protein allowance and can take upgrades. */
    servesFullPortion: true,
  },
  child: {
    id: "child" as const,
    label: "Child",
    ageLabel: "5-12",
    price: 29.9,
    weekdayPrice: 27.45,
    adultEquivalent: 0.5,
    servesFullPortion: true,
  },
  toddler: {
    id: "toddler" as const,
    label: "Kid under 5",
    ageLabel: "under 5",
    // 2026-09-06 policy change: under-5s eat free (was a flat $5 small-plate
    // charge). Keep the tier so headcount/planner logic still tracks them.
    price: 0,
    weekdayPrice: 0,
    /** Under-5s do not count toward adult-equivalent headcounts. */
    adultEquivalent: 0,
    /** Small plate off the grill — no protein allowance, no upgrades. */
    servesFullPortion: false,
  },
} as const

export const GUEST_TIER_IDS = ["adult", "child", "toddler"] as const

export function getTierPrice(tier: GuestTier, weekdaySpecial: boolean): number {
  const def = GUEST_TIERS[tier]
  return weekdaySpecial ? def.weekdayPrice : def.price
}

// ---------------------------------------------------------------
// Package contents
// ---------------------------------------------------------------
export const INCLUDED_PROTEINS_PER_PERSON = 2
export const INCLUDED_SIDES = ["Salad", "Fried Rice", "Seasonal Veges"] as const
export const EXTRA_PROTEIN_PRICE = 10

// ---------------------------------------------------------------
// Order minimum, deposit, card surcharge, gratuity
// ---------------------------------------------------------------
export const MINIMUM_SPEND = 599

/** Fixed deposit. Auto-applied — never hand-entered on an invoice. */
/** Historic $19.90 deposit. Since 2026-10-06 (D-1006-04) the date is locked with a card on file and
 *  nothing is charged; this stays for v1 ledger math only. Customer-facing copy must not quote it. */
export const DEPOSIT_AMOUNT = 19.9
/** Lock-the-date terms (D-1006-04): free to change or cancel up to this many hours before the party. */
export const FREE_CHANGE_HOURS = 48
/** Charged to the card on file when a party is cancelled inside FREE_CHANGE_HOURS. Not a selling point. */
export const LATE_CANCEL_FEE = 99

/**
 * Card surcharge — v1 terms only (orders created through 2026-10-05). Charged
 * on the amount actually swiped — the outstanding balance plus gratuity —
 * never on a deposit that was already paid. Nothing quoted from 2026-10-06
 * carries it; see the pricing terms below.
 */
export const CARD_SURCHARGE_RATE = 0.04
export const CARD_SURCHARGE_LABEL = "Venmo, Zelle, Credit Card"

// ---------------------------------------------------------------
// Pricing terms (owner 2026-10-05 / 2026-10-06; decision log D-1005-01 -> D-1006-05)
// ---------------------------------------------------------------
// v1, through 2026-10-05: prices tax-included; card / Venmo / Zelle +4%.
// v2 "by method", from 2026-10-06: one listed price, three bills.
//   cash (to the chef on the day) = listed price, sales tax included
//                                   (Reg 1700 footer on the invoice).
//   Venmo / Zelle                 = listed price x 1.04 - a PRICE, printed as
//                                   "Venmo/Zelle price", never a "fee".
//   credit card (card on file,    = listed price + the sales tax for the party's
//   charged on the day)             own address (CDTFA rate, lib/sales-tax-rate.ts)
//                                   + card processing at Stripe's real cost
//                                   (2.9% + 30c; waived for debit) + the gratuity
//                                   when the customer puts it on the card.
// A flat "10% sales tax" line is not a lawful rate anywhere we serve and a card
// surcharge above cost breaks the Visa 3% cap - so both are itemised at their
// true amounts. Nothing about tax or payment method is said before the booking
// is confirmed; the itemised bill appears once menu and headcount are set.
// The invoice app's lib/pricing.ts is the engine; this file mirrors it.
export type PricingTerms = "v1_tax_included" | "v2_by_method"
/** 2026-10-06 00:00 Pacific. */
export const PRICING_TERMS_V2_FROM = "2026-10-06T07:00:00.000Z"
/** Venmo / Zelle price = listed price x (1 + this). */
export const ZELLE_VENMO_RATE = 0.04
/** Stripe's card cost, passed through at cost on card payments. */
export const STRIPE_FEE_RATE = 0.029
export const STRIPE_FEE_FIXED = 0.3
/** Until the party address is rated by CDTFA: LA County base rate, flagged as a default. */
export const DEFAULT_SALES_TAX_RATE = 0.095

export type CardFunding = "credit" | "debit" | "prepaid" | "unknown"

export function pricingTermsFor(createdAt: string | Date | null | undefined): PricingTerms {
  const ms = createdAt == null ? Date.now() : createdAt instanceof Date ? createdAt.getTime() : Date.parse(createdAt)
  return Number.isFinite(ms) && ms < Date.parse(PRICING_TERMS_V2_FROM) ? "v1_tax_included" : "v2_by_method"
}

/** Read a stored terms label; the short-lived "v2_tax_added" (10-05 -> 10-06) reads as v2 by method. */
export function normalizePricingTerms(value: string | null | undefined): PricingTerms {
  return value === "v2_by_method" || value === "v2_tax_added" ? "v2_by_method" : "v1_tax_included"
}

/** Sales tax at the party's rate on a listed (cash) total - v2 card bills. */
export function salesTaxOn(cashTotal: number, rate: number): number {
  return roundCurrency(cashTotal * rate)
}

/** Venmo / Zelle price for a listed (cash) amount under v2. */
export function zelleVenmoPriceOf(cashTotal: number): number {
  return roundCurrency(cashTotal * (1 + ZELLE_VENMO_RATE))
}

/**
 * Card processing passed through at Stripe's cost on what runs through the
 * card (balance incl. tax, plus gratuity on the card, deposit out). Zero for
 * debit / prepaid cards and when nothing is charged.
 */
export function cardProcessingFeeOn(chargedAmount: number, funding: CardFunding | null | undefined = "unknown"): number {
  if (chargedAmount <= 0) return 0
  if (funding === "debit" || funding === "prepaid") return 0
  return roundCurrency(chargedAmount * STRIPE_FEE_RATE + STRIPE_FEE_FIXED)
}

/**
 * The card bill for a listed (cash) total under v2: listed + tax at `rate` +
 * processing on (listed + tax + gratuity - deposit). Returns the pieces so a
 * surface can print them as lines.
 */
export function cardBillOf(
  cashTotal: number,
  rate: number,
  opts: { gratuity?: number; deposit?: number; funding?: CardFunding | null } = {},
): { salesTax: number; cardProcessingFee: number; cardTotal: number; cardBalanceDue: number } {
  const gratuity = opts.gratuity ?? 0
  const deposit = opts.deposit ?? 0
  const salesTax = salesTaxOn(cashTotal, rate)
  const charged = Math.max(0, roundCurrency(cashTotal + salesTax + gratuity - deposit))
  const cardProcessingFee = cardProcessingFeeOn(charged, opts.funding)
  return {
    salesTax,
    cardProcessingFee,
    cardTotal: roundCurrency(cashTotal + salesTax + cardProcessingFee),
    cardBalanceDue: Math.max(0, roundCurrency(charged + cardProcessingFee)),
  }
}

/**
 * Gratuity is quoted on the whole Event Total: after discounts, travel fee
 * included — `beforeFees` in the invoice engine (lib/pricing.ts), i.e.
 * max(subtotal − promotions, MINIMUM_SPEND) + travelFee. It stops there: the
 * 4% card surcharge is ours to collect, not something to tip on.
 *
 * Two things were wrong here until 2026-10-05. This comment said "pre-discount",
 * which was never true, and the engine left the travel fee out — on Gregorio's
 * 117.8-mile party the printed 20% was $200.68 against an Event Total of
 * $1,071.20. The owner's call that day: the drive is part of the job being
 * tipped on, so gratuity follows the total the customer actually sees.
 */
export const GRATUITY_OPTIONS = [0.2, 0.25, 0.3] as const

// ---------------------------------------------------------------
// Travel fee — driving distance, first 50 miles free, then $1/mile
// ---------------------------------------------------------------
export const TRAVEL_FREE_RADIUS_MILES = 50
export const TRAVEL_RATE_PER_MILE = 1

/**
 * Exact proration past the free radius: no minimum charge and no rounding,
 * so the fee rises smoothly from $0 at the 50-mile boundary.
 * Distance is DRIVING miles, not straight-line.
 */
export function calcTravelFee(drivingMiles: number | null | undefined): number {
  if (drivingMiles == null || !Number.isFinite(drivingMiles)) return 0
  const chargeable = Math.max(0, drivingMiles - TRAVEL_FREE_RADIUS_MILES)
  return roundCurrency(chargeable * TRAVEL_RATE_PER_MILE)
}

// ---------------------------------------------------------------
// Call-out fee — one per chef on site
// ---------------------------------------------------------------
export const CALL_OUT_FEE_PER_CHEF = 40
export const GUESTS_PER_CHEF = 28

/**
 * Headcount includes under-5s: chef staffing tracks people at the table,
 * not plates sold. Change this one function to change the staffing rule.
 */
export function calcChefCount(totalGuests: number): number {
  if (totalGuests <= 0) return 0
  return Math.ceil(totalGuests / GUESTS_PER_CHEF)
}

export function calcCallOutFee(totalGuests: number): number {
  return calcChefCount(totalGuests) * CALL_OUT_FEE_PER_CHEF
}

// ---------------------------------------------------------------
// Setup / rental (auto-priced per guest — never hand-entered)
// ---------------------------------------------------------------
export const TABLES_CHAIRS_PER_GUEST = 10
export const UTENSILS_PER_GUEST = 5
export const FULL_SETUP_PER_GUEST = TABLES_CHAIRS_PER_GUEST + UTENSILS_PER_GUEST // $15

// ---------------------------------------------------------------
// Negotiation floor (owner 2026-10-06, D-1006-03): the least we take in per
// head after every discount - food only, travel and rentals aside. Fri–Sun
// $50, Mon–Thu $45. Kids 5–12 count as half a head (their list price is
// half). Free tables & chairs count as a $4/guest concession (what they cost
// us); free appetizers and noodles cost us nothing and never move the floor;
// place settings are never given away. The leads skill §4.3 has the prose.
// ---------------------------------------------------------------
export const PRICE_FLOOR_PER_HEAD = { weekend: 50, weekday: 45 } as const
export const PRICE_FLOOR_KID_WEIGHT = 0.5
export const TABLES_CONCESSION_PER_GUEST = 4

/**
 * White tablecloths cost more than black (owner, 2026-09-23): they are a
 * separate stock, and one party's red wine retires a cloth that black would
 * have survived. Applies to any setup on white linen — which includes the
 * table themes that come on white (see config/table-themes.ts), so picking
 * one of those is the one case where a theme changes the price.
 *
 * Charged per CLOTH, one per table (owner, 2026-09-30). It had been $5 per
 * guest, which quoted 18 guests $90 for five cloths. We seat 4 to a table.
 */
export const WHITE_CLOTH_PER_TABLE = 5
export const GUESTS_PER_TABLE = 4

/** Tables (and so tablecloths) for a party: 4 guests to a table, rounded up. */
export function tablesFor(guests: number): number {
  return Math.ceil(Math.max(0, guests) / GUESTS_PER_TABLE)
}

/** The white-linen surcharge for a party: $5 for every table's cloth. */
export function whiteClothFee(guests: number): number {
  return tablesFor(guests) * WHITE_CLOTH_PER_TABLE
}

// ---------------------------------------------------------------
// Weekday Special
// ---------------------------------------------------------------
export const WEEKDAY_SPECIAL = {
  title: "Weekday Special",
  /** Monday(1) through Thursday(4). */
  eligibleWeekdays: [1, 2, 3, 4] as const,
  // No headcount gate and the full menu, including premium upgrades. The
  // weekday rate is only a nudge, so it is not paired with a worse menu; the
  // thing that makes it feel like a gift rather than a discount is the free
  // appetizer. 2026-09-22 (owner): it is ONE appetizer of the customer's choice
  // — gyoza, edamame or spring rolls, one tray for the table (default gyoza) —
  // no longer the 3-item platter. `value` is the most it can be worth ($15).
  // The key keeps its old name so imports don't break.
  appetizerPlatter: {
    label: "Free appetizer of your choice",
    detail: "gyoza, edamame or spring rolls",
    value: 15,
  },
  // Free tables & chairs were added 2026-09-13 and withdrawn 2026-09-14
  // (owner): the setup add-on is priced the same on every date.
} as const

/** Per-guest price of the "tables, chairs & utensils" add-on (same on every date). */
export function setupPerGuest(): number {
  return FULL_SETUP_PER_GUEST
}

// ---------------------------------------------------------------
// Party Size Discount — every party, any day, on top of the Weekday
// Special. Automatic by paid headcount; 61+ guests get a custom quote. The
// $599 minimum still applies after the discount, same as the invoice system.
// Mirrors the invoice repo's PARTY_SIZE_DISCOUNT_TIERS and paidGuestCount()
// (kept in sync by hand, 2026-09-13; headcount rule 2026-09-24).
//
// The ladder is $30 per ten paying adults — a flat 5%, since ten adults bill
// at $599. Its real design rule lives at the boundaries: each tier is exactly
// $30 above the last, so the guest who crosses one comes in at half price
// ($29.90 instead of $59.90) and nobody is ever punished for inviting one
// more person. 2026-10-03 (owner): extended past 30 for precisely that
// reason — the 31st adult used to cost $149.90 because the ladder simply
// stopped, the same cliff the Weekday Special's old 15-guest gate had (see
// GUEST_TIERS.adult.weekdayPrice). Custom quoting now starts at 61, where a
// third chef comes on and the logistics stop being a template.
// ---------------------------------------------------------------
export const PARTY_SIZE_DISCOUNT_TIERS = [
  { minGuests: 10, maxGuests: 14, amount: 30 },
  { minGuests: 15, maxGuests: 24, amount: 60 },
  { minGuests: 25, maxGuests: 30, amount: 90 },
  { minGuests: 31, maxGuests: 40, amount: 120 },
  { minGuests: 41, maxGuests: 50, amount: 150 },
  { minGuests: 51, maxGuests: 60, amount: 180 },
] as const
export const PARTY_SIZE_CUSTOM_FROM = 61

/** 收半价的小孩，在阶梯里算半个成人。 */
export const KID_TIER_WEIGHT = 0.5

export type TierHeads = { adults: number; kids: number }

/**
 * 阶梯数的是"掏钱的人头"（老板 2026-09-24 定）：
 *   - 3–4 岁那种不收钱的小孩**不进这个数**。站上本来也没地方填他们——输入框只有
 *     "Kids 5–12"，under 5 从来不是一个数字，所以这一条在官网侧本来就成立。
 *   - **收半价的小孩算半个成人**。阶梯是按这一单的分量给的，半价的人头按整个算
 *     等于白送一档。
 *
 * 往下取整：14 个成人 + 1 个小孩 = 14.5 → 14，落在 10–14 档。不取整会掉进档与档
 * 之间的缝里（14.5 既不 ≤14 也不 ≥15），一分折扣都拿不到。
 *
 * 参数收成一个对象是故意的：以前这几个函数收一个 number，调用处各自写
 * `adults + kids`，改规则时漏掉一处编译器也不会吭声。
 */
export function tierHeadcount(heads: TierHeads): number {
  return Math.floor(Math.max(0, heads.adults) + Math.max(0, heads.kids) * KID_TIER_WEIGHT)
}

/**
 * The large-party free appetizer starts here, counted in the same paying heads
 * as the tiers: adults 1, half-price kids 0.5, free little ones 0 (owner
 * 2026-09-28). It used to be judged on bodies in the room, so 16 adults +
 * 4 kids + 2 toddlers read as 22 and earned an appetizer the owner never meant
 * to give. Public copy says "20+ adults" - simpler, and never promises more
 * than this grants.
 */
export const LARGE_PARTY_APPETIZER_MIN = 20

export function earnsLargePartyAppetizer(heads: TierHeads): boolean {
  return tierHeadcount(heads) >= LARGE_PARTY_APPETIZER_MIN
}

/**
 * The discount a party earns. Above the table the TOP tier's amount carries
 * on instead of dropping to zero: a 61-adult party is still a custom quote
 * (PARTY_SIZE_CUSTOM_FROM) priced by a person, but if any path does compute a
 * number for it, that number must not be $239.90 higher than the 60-adult
 * one. Capping rather than continuing the ladder means the discount stops
 * growing past $180 — deliberately, so nothing auto-concedes on a huge party
 * — while the price stays monotone in headcount.
 *
 * The invoice repo deliberately does NOT mirror this: its partySizePromoFor()
 * returns null above the table, because an invoice line labelled "51–60
 * adults" on a 70-person party would be a lie in print, and those invoices
 * carry a hand-made custom-deal line anyway.
 */
export function partySizeDiscount(heads: TierHeads): number {
  const count = tierHeadcount(heads)
  for (let i = PARTY_SIZE_DISCOUNT_TIERS.length - 1; i >= 0; i--) {
    const tier = PARTY_SIZE_DISCOUNT_TIERS[i]
    if (count >= tier.minGuests) return tier.amount
  }
  return 0
}

/**
 * One-line label for the tier a party earns, e.g. "15–24 adults · $60 off".
 * Stated in adults on purpose (owner 2026-09-29): the count is adults plus half
 * of each paying child, so "adults" can only under-promise, while "guests" made
 * a 20-person party read its $30 line as a shortchange.
 */
export function partySizeDiscountLabel(heads: TierHeads): string | null {
  const count = tierHeadcount(heads)
  const tier = PARTY_SIZE_DISCOUNT_TIERS.find((t) => count >= t.minGuests && count <= t.maxGuests)
  if (tier) return `${tier.minGuests}–${tier.maxGuests} adults · $${tier.amount} off`
  // Above the table partySizeDiscount() still pays the top tier's amount, so
  // this has to name it rather than return null: /quote prints the label
  // inside parentheses with no guard, and a 61-adult party would otherwise
  // read "Party size discount ()". Says "61+" instead of the top tier's own
  // range, because "51–60 adults" on a 70-person party would be wrong.
  const top = PARTY_SIZE_DISCOUNT_TIERS[PARTY_SIZE_DISCOUNT_TIERS.length - 1]
  return count >= top.minGuests ? `${PARTY_SIZE_CUSTOM_FROM}+ adults · $${top.amount} off` : null
}

export type SimpleEstimate = {
  subtotal: number
  /** Tier amount the party qualifies for. */
  partySizeDiscount: number
  /** How much of it actually lowered the price (the $599 floor can absorb it). */
  partySizeDiscountApplied: number
  minApplied: boolean
  base: number
  travelFee: number
  /** The listed (cash) total: prices, discounts, minimum and travel. Tax and payment-method figures live on the invoice (D-1006-05); estimates say nothing about them. */
  total: number
}

/**
 * The one price the simple estimators (city landing pages, occasion pages,
 * menu bar, landing-quote text) all agree on. /quote's builder carries the
 * same rules plus upgrades and loyalty.
 */
export function calcSimpleEstimate(args: { adults: number; kids: number; weekdaySpecial: boolean; travelFee?: number }): SimpleEstimate {
  const adults = Math.max(0, Math.floor(args.adults))
  const kids = Math.max(0, Math.floor(args.kids))
  const subtotal = roundCurrency(adults * getTierPrice("adult", args.weekdaySpecial) + kids * getTierPrice("child", args.weekdaySpecial))
  const partySize = partySizeDiscount({ adults, kids })
  const afterDiscount = Math.max(0, subtotal - partySize)
  const base = Math.max(afterDiscount, MINIMUM_SPEND)
  const partySizeDiscountApplied = roundCurrency(Math.max(0, subtotal - base))
  const travelFee = Math.max(0, Math.round(args.travelFee ?? 0))
  const total = roundCurrency(base + travelFee)
  return {
    subtotal,
    partySizeDiscount: partySize,
    partySizeDiscountApplied,
    minApplied: afterDiscount < MINIMUM_SPEND,
    base,
    travelFee,
    total,
  }
}

// Major holiday periods book at the standard rate — the Weekday Special is a
// demand-smoothing discount and these are the highest-demand days of the year
// (owner decision, 2026-09-05). Extend this list each season.
export const WEEKDAY_SPECIAL_BLACKOUTS: ReadonlyArray<{ start: string; end: string; label: string }> = [
  { start: "2026-09-07", end: "2026-09-07", label: "Labor Day" },
  { start: "2026-11-23", end: "2026-11-29", label: "Thanksgiving week" },
  { start: "2026-12-20", end: "2027-01-03", label: "the Christmas & New Year season" },
  { start: "2027-05-30", end: "2027-05-31", label: "Memorial Day" },
  { start: "2027-07-03", end: "2027-07-05", label: "July 4th" },
  { start: "2027-09-05", end: "2027-09-06", label: "Labor Day" },
  { start: "2027-11-22", end: "2027-11-28", label: "Thanksgiving week" },
  { start: "2027-12-19", end: "2028-01-02", label: "the Christmas & New Year season" },
]

/** The holiday label when the date falls in a blackout period, else null. */
export function weekdayBlackoutLabel(eventDate: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate ?? "")) return null
  for (const period of WEEKDAY_SPECIAL_BLACKOUTS) {
    if (eventDate >= period.start && eventDate <= period.end) return period.label
  }
  return null
}

export function isWeekdayEligibleDate(eventDate: string): boolean {
  if (weekdayBlackoutLabel(eventDate)) return false
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(eventDate ?? "")
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(year, month - 1, day)
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return false
  }
  return (WEEKDAY_SPECIAL.eligibleWeekdays as readonly number[]).includes(parsed.getDay())
}

export function calcAdultEquivalents(counts: Record<GuestTier, number>): number {
  return GUEST_TIER_IDS.reduce(
    (sum, tier) => sum + (counts[tier] ?? 0) * GUEST_TIERS[tier].adultEquivalent,
    0,
  )
}

export interface WeekdayEligibility {
  isDateEligible: boolean
  adultEquivalents: number
  isEligible: boolean
  violations: string[]
}

export function checkWeekdayEligibility(
  eventDate: string,
  counts: Record<GuestTier, number>,
): WeekdayEligibility {
  const isDateEligible = isWeekdayEligibleDate(eventDate)
  const adultEquivalents = calcAdultEquivalents(counts)

  const violations: string[] = []
  if (!isDateEligible) {
    violations.push("Weekday Special applies to Monday-Thursday events only.")
  }

  return {
    isDateEligible,
    adultEquivalents,
    isEligible: violations.length === 0,
    violations,
  }
}

// ---------------------------------------------------------------
// Active promotions
// ---------------------------------------------------------------
// A promotion never edits a line's price: the line keeps its list price and
// the promotion is shown as a discount with its reason in the Remark column.
export type PromotionId = "call_out_fee_waived"

export interface PromotionDefinition {
  id: PromotionId
  label: string
  /** Printed in the invoice Remark column next to the affected line. */
  remark: string
  active: boolean
}

export const PROMOTIONS: Record<PromotionId, PromotionDefinition> = {
  call_out_fee_waived: {
    id: "call_out_fee_waived",
    label: "Call-Out fee waived",
    remark: "Current promotion — Call-Out fee waived",
    active: true,
  },
}

export function getActivePromotions(): PromotionDefinition[] {
  return Object.values(PROMOTIONS).filter((p) => p.active)
}

export function isPromotionActive(id: PromotionId): boolean {
  return PROMOTIONS[id]?.active === true
}

// ---------------------------------------------------------------
// Returning customer discount
// ---------------------------------------------------------------
// $60 off per 10 full guests (adults + children 5-12; under-5s do not
// count). Conditional on the customer having booked before, so it lives
// outside PROMOTIONS — those apply to every quote automatically.
export const RETURNING_CUSTOMER_DISCOUNT_PER_10_GUESTS = 60
export const RETURNING_CUSTOMER_DISCOUNT_REMARK = "Returning customer — $60 off per 10 guests"

export function calcReturningCustomerDiscount(fullGuestCount: number): number {
  if (!Number.isFinite(fullGuestCount) || fullGuestCount <= 0) return 0
  return RETURNING_CUSTOMER_DISCOUNT_PER_10_GUESTS * Math.floor(fullGuestCount / 10)
}

// Flat $50 off for people who attended a Real Hibachi party and hold one of
// our printed business cards (cards only exist offline, so the card itself is
// the gate). Never stacks with the returning customer discount.
export const PARTY_GUEST_CARD_DISCOUNT = 50
export const PARTY_GUEST_CARD_DISCOUNT_REMARK = "Party guest — $50 off with Real Hibachi card"

// ---------------------------------------------------------------
// Shared helper
// ---------------------------------------------------------------
export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

// ---------------------------------------------------------------
// Price gate (2026-09-13, owner): the site shows a price RANGE for free;
// the exact total and the Party Size Discount code arrive by text + email
// once the visitor leaves a mobile number and an email. The range is the
// honest bracket around the exact figure: top = before the discount, bottom
// = after it, both rounded outward to $25. Under 10 guests there is no
// discount, so the bracket collapses and the copy just promises the exact
// number by text.
// ---------------------------------------------------------------
export type DisplayRange = { low: number; high: number; single: boolean }

export function displayRange(low: number, highBeforeDiscount: number): DisplayRange {
  const lo = Math.floor(Math.min(low, highBeforeDiscount) / 25) * 25
  const hi = Math.ceil(Math.max(low, highBeforeDiscount) / 25) * 25
  return { low: lo, high: hi, single: lo === hi }
}

export function displayRangeForEstimate(est: SimpleEstimate): DisplayRange {
  return displayRange(est.total, est.total + est.partySizeDiscountApplied)
}

export function formatDisplayRange(r: DisplayRange): string {
  const f = (n: number) => `$${n.toLocaleString("en-US")}`
  return r.single ? `about ${f(r.high)}` : `${f(r.low)}–${f(r.high)}`
}

/** The code we text for a tier, e.g. PARTY60. Informational: the invoice applies the tier by headcount. */
export function partySizeDiscountCode(heads: TierHeads): string | null {
  const amount = partySizeDiscount(heads)
  return amount > 0 ? `PARTY${amount}` : null
}
