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
    weekdayPrice: 45.9,
    /** Counts as one whole guest for the Weekday Special headcount rule. */
    adultEquivalent: 1,
    /** Gets the full included-protein allowance and can take upgrades. */
    servesFullPortion: true,
  },
  child: {
    id: "child" as const,
    label: "Child",
    ageLabel: "5-12",
    price: 29.9,
    weekdayPrice: 22.95,
    adultEquivalent: 0.5,
    servesFullPortion: true,
  },
  toddler: {
    id: "toddler" as const,
    label: "Kid under 5",
    ageLabel: "under 5",
    price: 5,
    weekdayPrice: 5,
    /** Under-5s do not count toward the Weekday Special 15-guest minimum. */
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
export const DEPOSIT_AMOUNT = 19.9

/**
 * Card surcharge. Charged on the amount actually swiped — the outstanding
 * balance plus gratuity — never on a deposit that was already paid.
 */
export const CARD_SURCHARGE_RATE = 0.04
export const CARD_SURCHARGE_LABEL = "Venmo, Zelle, Credit Card"

/** Gratuity is quoted on the pre-discount order total. */
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
// Weekday Special
// ---------------------------------------------------------------
export const WEEKDAY_SPECIAL = {
  title: "Weekday Special",
  /** Monday(1) through Thursday(4). */
  eligibleWeekdays: [1, 2, 3, 4] as const,
  /** Adults + children x 0.5 must reach this; under-5s do not count. */
  minAdultEquivalents: 15,
  /** Guests pick 2 of these 3; no premium upgrades are available. */
  includedProteins: ["chicken", "steak", "shrimp"] as const,
  proteinPickCount: 2,
  allowsPremiumUpgrades: false,
} as const

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
  isHeadcountEligible: boolean
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
  const isHeadcountEligible = adultEquivalents >= WEEKDAY_SPECIAL.minAdultEquivalents

  const violations: string[] = []
  if (!isDateEligible) {
    violations.push("Weekday Special applies to Monday-Thursday events only.")
  }
  if (!isHeadcountEligible) {
    violations.push(
      `Weekday Special requires ${WEEKDAY_SPECIAL.minAdultEquivalents}+ guests (a child counts as half an adult; under-5s do not count). This party counts as ${adultEquivalents}.`,
    )
  }

  return {
    isDateEligible,
    isHeadcountEligible,
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
