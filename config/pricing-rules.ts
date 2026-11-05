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
export const CARD_SURCHARGE_LABEL = "Credit Card"

// ---------------------------------------------------------------
// Pricing terms (owner 2026-10-05 / 2026-10-06; decision log D-1005-01 -> D-1006-05)
// ---------------------------------------------------------------
// v1, through 2026-10-05: prices tax-included; card +4%.
// v2 "by method", from 2026-10-06: one listed price, two bills (D-1006-07: Zelle / Venmo
// go to the chef directly at listed x 1.04 - one line beside the cash price, not a
// third bill; the business accounts only pay chef wages and never appear to a customer).
//   cash (to the chef on the day) = listed price, sales tax included
//                                   (Reg 1700 footer on the invoice).
//   credit card (card on file,    = listed price + the sales tax for the party's
//   charged on the day)             own address (CDTFA rate, lib/sales-tax-rate.ts)
//                                   + card processing at Stripe's real cost
//                                   (3%; waived for debit) + the gratuity
//                                   when the customer puts it on the card.
// A flat "10% sales tax" line is not a lawful rate anywhere we serve and a card
// surcharge above cost breaks the Visa 3% cap - so both are itemised at their
// true amounts. Nothing about tax or payment method is said before the booking
// is confirmed; the itemised bill appears once menu and headcount are set.
// The invoice app's lib/pricing.ts is the engine; this file mirrors it.
export type PricingTerms = "v1_tax_included" | "v2_by_method"
/** 2026-10-06 00:00 Pacific. */
export const PRICING_TERMS_V2_FROM = "2026-10-06T07:00:00.000Z"
/** Card processing on card payments: a flat 3% of what runs through the card (owner 2026-10-07). Mirrors the invoice engine. */
export const CARD_PROCESSING_RATE = 0.03
/**
 * Zelle / Venmo paid to the chef directly on the day = listed price x 1.04
 * (owner 2026-10-06 night, D-1006-07). A price, never a "fee"; said only when a
 * customer asks - never printed or offered unprompted. The business
 * accounts are internal payout rails and are never handed to a customer.
 */
export const ZELLE_VENMO_RATE = 0.04
export function zelleVenmoPriceOf(cash: number): number {
  return Math.round(cash * (1 + ZELLE_VENMO_RATE) * 100) / 100
}
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

/**
 * Card processing on what runs through the card (balance incl. tax, plus
 * gratuity on the card, deposit out): a flat 3% (owner 2026-10-07). Mirrors
 * the invoice engine; the charge is B x 1.03 and cardProcessingFeeInside
 * takes the fee back out of a charge. Zero only when nothing is charged -
 * debit / prepaid pay it too (owner 2026-10-09, mirrors the invoice engine).
 */
export function cardProcessingFeeOn(chargedAmount: number, funding: CardFunding | null | undefined = "unknown"): number {
  void funding
  if (chargedAmount <= 0) return 0
  return roundCurrency(chargedAmount * CARD_PROCESSING_RATE)
}

/** The 3% inside a card charge that was built with cardProcessingFeeOn (charge = base x 1.03). */
export function cardProcessingFeeInside(chargedGross: number): number {
  if (chargedGross <= 0) return 0
  return roundCurrency(chargedGross - chargedGross / (1 + CARD_PROCESSING_RATE))
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
// Negotiation floor (owner 2026-10-06, D-1006-06): the least we take in per
// head after every discount - food only, travel and rentals aside. Fri–Sun
// $50, Mon–Thu $45. Kids 5–12 count as half a head (their list price is
// half). Free tables & chairs count as a $4/guest concession (what they cost
// us); free appetizers and noodles cost us nothing and never move the floor;
// place settings are never given away. The leads skill §4.3 has the prose.
// ---------------------------------------------------------------
export const PRICE_FLOOR_PER_HEAD = { weekend: 50, weekday: 45 } as const
export const PRICE_FLOOR_KID_WEIGHT = 0.5
// Large parties (owner D-1009-03 / D-1010-03): 40+ paying guests may go below
// the Fri–Sun floor, down to $45 a head; below the usual floor the party runs
// semi-buffet - the chef still does the whole show, then the food goes out in
// trays on the table and guests help themselves - one chef per 50 guests.
// Mon–Thu stays $45 (no extra room). Below $45 is the owner's call.
export const LARGE_PARTY_FLOOR = { minGuests: 40, perHead: 45, semiBuffetGuestsPerChef: 50 } as const
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
 *
 * Only for the cloths that come with rented tables & chairs (black ones come
 * free). Tablecloths rented on their own, for the customer's own tables, are a
 * different thing (owner, 2026-11-03): $5 a cloth, $8 in white, the invoice's
 * white_linen / white_tablecloth lines.
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
  // — gyoza, edamame or spring rolls (default gyoza) — no longer the 3-item
  // platter. 2026-10-30 (owner): by the head, not by the tray; the invoice bills
  // what is brought and takes it off again, so no total here changes. `value` is
  // the price of one tray ($15). The key keeps its old name so imports don't break.
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
// Party Size Discount — closed to new business (owner 2026-11-05, D-1105-01:
// "把人数阶梯取消吧，从今天开始"). A new quote has no discount for party size at
// any headcount: the per-person rate x heads, plus rentals and travel, at the
// $599 minimum. 61+ guests are still a custom quote, priced by a person.
//
// From 2026-09-13 every party earned a tier by paid headcount, $30 per ten
// paying adults on any day; 10–14 closed first (2026-11-02, D-1102-01, see
// CLOSED_PARTY_TIER) and the rest closed at PARTY_LADDER_CLOSED_AT.
//
// What was promised stands. An order booked before the ladder closed, or whose
// invoice already carries a party-size line, keeps the ladder on every save,
// headcount changes included (the invoice repo's keptTiers). A lead from
// before was quoted with it, so it locks at that price (quoted_ladder on the
// deposit event). Those are the only uses of the table below: nothing new is
// priced from it. desk reads it for the same two jobs.
// ---------------------------------------------------------------
export const CLOSED_PARTY_LADDER = [
  { minGuests: 15, maxGuests: 24, amount: 60 },
  { minGuests: 25, maxGuests: 30, amount: 90 },
  { minGuests: 31, maxGuests: 40, amount: 120 },
  { minGuests: 41, maxGuests: 50, amount: 150 },
  { minGuests: 51, maxGuests: 60, amount: 180 },
] as const
/**
 * When the ladder closed to new business. Edit this one value to move the
 * cutoff; the invoice repo's LADDER_CLOSED_AT (lib/pricing.ts) mirrors it.
 */
export const PARTY_LADDER_CLOSED_AT = "2026-11-05T14:15:00-08:00"
export const PARTY_SIZE_CUSTOM_FROM = 61

/** The lead came in before the ladder closed, so its quote had the ladder. */
export function quotedBeforeLadderClosed(leadCreatedAt: string | null | undefined): boolean {
  const ms = leadCreatedAt ? Date.parse(leadCreatedAt) : NaN
  return Number.isFinite(ms) && ms < Date.parse(PARTY_LADDER_CLOSED_AT)
}

/**
 * The tier that closed first. A lead from before closedAt was quoted with it,
 * in writing, so it locks at that price: the deposit event says so
 * (quoted_closed_tier) and the invoice repo's keepsClosedTier does the rest.
 * desk reads this too.
 */
export const CLOSED_PARTY_TIER = { minGuests: 10, maxGuests: 14, amount: 30, closedAt: "2026-11-02T10:00:00-08:00" } as const

export function quotedBeforeTierClosed(leadCreatedAt: string | null | undefined): boolean {
  const ms = leadCreatedAt ? Date.parse(leadCreatedAt) : NaN
  return Number.isFinite(ms) && ms < Date.parse(CLOSED_PARTY_TIER.closedAt)
}

/** 收半价的小孩，在人头里算半个成人。 */
export const KID_TIER_WEIGHT = 0.5

export type TierHeads = { adults: number; kids: number }

/**
 * 按"掏钱的人头"数（老板 2026-09-24 定，原来给人数阶梯用，现在 20 人送前菜、
 * 地板价的大单都按这个数）：
 *   - 3–4 岁那种不收钱的小孩**不进这个数**。站上本来也没地方填他们——输入框只有
 *     "Kids 5–12"，under 5 从来不是一个数字，所以这一条在官网侧本来就成立。
 *   - **收半价的小孩算半个成人**。
 *
 * 往下取整：19 个成人 + 1 个小孩 = 19.5 → 19，还不到 20。
 *
 * 参数收成一个对象是故意的：以前这几个函数收一个 number，调用处各自写
 * `adults + kids`，改规则时漏掉一处编译器也不会吭声。
 */
export function tierHeadcount(heads: TierHeads): number {
  return Math.floor(Math.max(0, heads.adults) + Math.max(0, heads.kids) * KID_TIER_WEIGHT)
}

/**
 * The large-party free appetizer starts here, counted in paying heads
 * (tierHeadcount): adults 1, half-price kids 0.5, free little ones 0 (owner
 * 2026-09-28). It used to be judged on bodies in the room, so 16 adults +
 * 4 kids + 2 toddlers read as 22 and earned an appetizer the owner never meant
 * to give. Public copy says "20+ adults" - simpler, and never promises more
 * than this grants.
 */
export const LARGE_PARTY_APPETIZER_MIN = 20

export function earnsLargePartyAppetizer(heads: TierHeads): boolean {
  return tierHeadcount(heads) >= LARGE_PARTY_APPETIZER_MIN
}

export type SimpleEstimate = {
  subtotal: number
  minApplied: boolean
  base: number
  travelFee: number
  /** The listed (cash) total: prices, minimum and travel. Tax and payment-method figures live on the invoice (D-1006-05); estimates say nothing about them. */
  total: number
}

/**
 * The one price the simple estimators (city landing pages, occasion pages,
 * menu bar, landing-quote text) all agree on. /quote's builder carries the
 * same rules plus upgrades and loyalty.
 */
export function calcSimpleEstimate(args: { adults: number; kids: number; weekdaySpecial: boolean; travelFee?: number; rentals?: number }): SimpleEstimate {
  const adults = Math.max(0, Math.floor(args.adults))
  const kids = Math.max(0, Math.floor(args.kids))
  const subtotal = roundCurrency(adults * getTierPrice("adult", args.weekdaySpecial) + kids * getTierPrice("child", args.weekdaySpecial))
  // Rented tables / tableware sit in the subtotal before the $599 floor, as
  // the invoice (calcInvoiceTotal) and /quote bill them (audit item 18,
  // D-1009-04).
  const rentals = roundCurrency(Math.max(0, args.rentals ?? 0))
  const beforeMinimum = roundCurrency(subtotal + rentals)
  const base = Math.max(beforeMinimum, MINIMUM_SPEND)
  const travelFee = Math.max(0, Math.round(args.travelFee ?? 0))
  const total = roundCurrency(base + travelFee)
  return {
    subtotal,
    // <=: ten adults at $59.90 land on $599 exactly, and that is still the minimum's price.
    minApplied: beforeMinimum <= MINIMUM_SPEND,
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
// A flat $50 off (owner 2026-10-29, D-1029-01). It was $60 per 10 guests,
// set 08-31 before the Party Size Discount went on every party (09-13):
// stacked in full it took a Saturday 20 to $50.90 a head, and the owner
// wants a weekend party to average about $55. Standard tier only, never
// under the $599 minimum, and only one
// of the $50 thank-yous (returning, party-guest card, appreciation) per
// party. Conditional on the customer having booked before, so it lives
// outside PROMOTIONS — those apply to every quote automatically.
export const RETURNING_CUSTOMER_DISCOUNT = 50
export const RETURNING_CUSTOMER_DISCOUNT_REMARK = "Returning customer — $50 off"

export function calcReturningCustomerDiscount(fullGuestCount: number): number {
  if (!Number.isFinite(fullGuestCount) || fullGuestCount <= 0) return 0
  return RETURNING_CUSTOMER_DISCOUNT
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
// the exact total arrives by text + email once the visitor leaves a mobile
// number and an email. The range is the honest bracket around the exact
// figure, rounded outward to $25 (a total on a multiple of $25 shows as one
// number). Until 2026-11-05 the bracket also spanned the party-size discount
// and the text carried a discount code; there is neither now (D-1105-01).
// ---------------------------------------------------------------
export type DisplayRange = { low: number; high: number; single: boolean }

export function displayRange(low: number, high: number): DisplayRange {
  const lo = Math.floor(Math.min(low, high) / 25) * 25
  const hi = Math.ceil(Math.max(low, high) / 25) * 25
  return { low: lo, high: hi, single: lo === hi }
}

export function displayRangeForEstimate(est: SimpleEstimate): DisplayRange {
  return displayRange(est.total, est.total)
}

export function formatDisplayRange(r: DisplayRange): string {
  const f = (n: number) => `$${n.toLocaleString("en-US")}`
  return r.single ? `about ${f(r.high)}` : `${f(r.low)}–${f(r.high)}`
}
