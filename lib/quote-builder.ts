import {
  GUEST_TIERS,
  WEEKDAY_SPECIAL,
  EXTRA_PROTEIN_PRICE,
  INCLUDED_PROTEINS_PER_PERSON,
  MINIMUM_SPEND as RULES_MINIMUM_SPEND,
  FULL_SETUP_PER_GUEST as RULES_FULL_SETUP,
  whiteClothFee as rulesWhiteClothFee,
  TRAVEL_FREE_RADIUS_MILES,
  TRAVEL_RATE_PER_MILE,
  CALL_OUT_FEE_PER_CHEF,
  calcChefCount,
  calcAdultEquivalents,
  tierHeadcount,
  calcReturningCustomerDiscount,
  PARTY_GUEST_CARD_DISCOUNT,
  isPromotionActive,
  isWeekdayEligibleDate,
  weekdayBlackoutLabel,
} from "@/config/pricing-rules"
import { describeSetup, type SetupSelection } from "@/config/table-themes"

export type QuoteAddOns = {
  steak: boolean
  shrimp: boolean
  lobster: boolean
}

export type WeekdaySaverProteins = {
  chicken: boolean
  steak: boolean
  shrimp: boolean
}

export type QuotePricingTier = "standard" | "weekday_saver"

export type QuoteInput = {
  eventDate: string
  location: string
  adults: number
  /** Children 5-12. */
  kids: number
  /** Kids under 5 — flat $5 each. */
  toddlers?: number
  pricingTier: QuotePricingTier
  weekdaySaverProteins: WeekdaySaverProteins
  tablewareRental: boolean
  /**
   * What the visitor built on /rentals before coming here (theme, tablecloth,
   * guest count). Mostly so the lead says which plates to pack rather than
   * just "rental: yes" - the plates themselves are free either way. The one
   * exception is the tablecloth: white costs whiteClothFee() more ($5 a table).
   */
  setupSelection?: SetupSelection
  tent10x10: boolean
  budget?: number
  addOns: QuoteAddOns
  /**
   * How the customer already knows us (standard tier only, never stacks):
   * "returning" — booked before, flat $50 off (owner 2026-10-29; was $60 per 10 guests);
   * "party_guest" — attended one of our parties and holds a printed card, flat $50 off.
   */
  loyaltyStatus?: "returning" | "party_guest"
}

export type QuoteRange = {
  low: number
  high: number
}

export type QuoteResult = {
  hasCoreInputs: boolean
  guestCount: number
  adultEquivalents: number
  /** Paying heads for promo thresholds: adults 1, half-price kids 0.5, free under-5s 0. */
  paidHeadcount: number
  chefCount: number
  callOutFee: number
  callOutFeeWaived: boolean
  pricingTier: QuotePricingTier
  baseSubtotal: number
  minimumSpend: number
  /**
   * What the $599 minimum adds on top of the food, rentals and upgrades as
   * picked - the figures the breakdown lists - measured as the invoice
   * measures it, before loyalty and travel. 0 when they clear the minimum.
   */
  minimumTopUp: number
  travelFeeRange: QuoteRange
  tablewareFee: number
  addOnTotalRange: QuoteRange
  loyaltyDiscount: number
  totalRange: QuoteRange
  weekdaySaver: {
    isWeekdayEligible: boolean
    isEligible: boolean
    violations: string[]
  }
  /** The Weekday Special includes a free appetizer of the customer's choice at any party size. */
  includesAppetizerPlatter: boolean
  isBookable: boolean
  budgetFit: "within_budget" | "above_budget" | "not_provided"
}

export type QuoteTemplateContext = {
  event_date: string
  event_date_pretty: string
  event_time: string
  location: string
  adults: string
  kids: string
  guest_count: string
  tableware_rental: string
  tent_10x10: string
  quote_tier: string
  tier_menu: string
  upgrades: string
  budget: string
  estimate_low: string
  estimate_high: string
  quote_summary: string
}

// Every figure below comes from config/pricing-rules.ts so the marketing
// quote and the invoice can never disagree.
const ADULT_PRICE = GUEST_TIERS.adult.price
const KID_FOOD_PRICE = GUEST_TIERS.child.price
const TODDLER_PRICE = GUEST_TIERS.toddler.price
const FULL_SETUP_PER_GUEST = RULES_FULL_SETUP
const MINIMUM_SPEND = RULES_MINIMUM_SPEND
const WEEKDAY_SAVER_ADULT_PRICE = GUEST_TIERS.adult.weekdayPrice
const WEEKDAY_SAVER_KID_PRICE = GUEST_TIERS.child.weekdayPrice

// The upgrade on each premium protein, as the invoice prices it (lib/pricing.ts
// PREMIUM_PROTEINS): what one serving adds over a regular protein.
const ADD_ON_PER_GUEST = {
  steak: 8, // filet mignon
  shrimp: 6, // scallops
  lobster: 12, // lobster tail
} as const

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * The most the picked upgrades add for one guest: that guest has every one of
 * them, priced the way the invoice prices a guest's proteins
 * (calcGuestProteinCost). An upgrade takes the place of one of the guest's 2
 * included proteins; past those 2 a protein is an extra one, $10 on top of its
 * upgrade. So one or two picks cost their upgrades, and all three cost $36
 * (8 + 6 + 12 + 10), not $26. Until 2026-11-11 /quote added the three up and
 * said "on top of the 2 regular proteins": on 11-08 a customer read her 8
 * guests' $208 as chicken + shrimp + all three, which is $448.
 */
export function upgradesPerGuestHigh(addOns: QuoteAddOns): number {
  const upgrades: number[] = []
  if (addOns.steak) upgrades.push(ADD_ON_PER_GUEST.steak)
  if (addOns.shrimp) upgrades.push(ADD_ON_PER_GUEST.shrimp)
  if (addOns.lobster) upgrades.push(ADD_ON_PER_GUEST.lobster)
  const beyondIncluded = Math.max(0, upgrades.length - INCLUDED_PROTEINS_PER_PERSON)
  return roundCurrency(upgrades.reduce((sum, fee) => sum + fee, 0) + beyondIncluded * EXTRA_PROTEIN_PRICE)
}

function normalizeGuests(input: number): number {
  if (!Number.isFinite(input) || input < 0) return 0
  return Math.floor(input)
}

const WEEKDAY_PLATTER_LINE = `${WEEKDAY_SPECIAL.appetizerPlatter.label} (${WEEKDAY_SPECIAL.appetizerPlatter.detail})`

function getQuoteTierLabel(pricingTier: QuotePricingTier): string {
  return pricingTier === "weekday_saver"
    ? `Weekday Special ($${WEEKDAY_SAVER_ADULT_PRICE.toFixed(2)}/adult, $${WEEKDAY_SAVER_KID_PRICE.toFixed(2)}/child + free appetizer of your choice)`
    : "Standard Plan"
}

/**
 * Travel is priced on routed driving miles, so a quote cannot name a figure
 * until the address is looked up. /api/quote/travel-fee does that and the
 * client passes the answer in as travelFeeRangeOverride; this is only the
 * before-we-know-anything default.
 */
export const TRAVEL_FEE_POLICY = {
  freeRadiusMiles: TRAVEL_FREE_RADIUS_MILES,
  ratePerMile: TRAVEL_RATE_PER_MILE,
  basis: "driving miles" as const,
}

export function getTravelFeeRange(location: string): QuoteRange {
  void location
  return { low: 0, high: 0 }
}

export function calculateQuote(input: QuoteInput, travelFeeRangeOverride?: QuoteRange): QuoteResult {
  const adults = normalizeGuests(input.adults)
  const kids = normalizeGuests(input.kids)
  const toddlers = normalizeGuests(input.toddlers ?? 0)
  const guestCount = adults + kids + toddlers
  const adultEquivalents = calcAdultEquivalents({ adult: adults, child: kids, toddler: toddlers })
  const hasCoreInputs = Boolean(input.eventDate && input.location.trim() && guestCount > 0)
  const pricingTier = input.pricingTier
  const isWeekdaySaver = pricingTier === "weekday_saver"

  const isWeekdayEligible = isWeekdayEligibleDate(input.eventDate)

  const weekdayViolations: string[] = []
  if (isWeekdaySaver && !isWeekdayEligible) {
    const holiday = weekdayBlackoutLabel(input.eventDate)
    weekdayViolations.push(
      holiday
        ? `Dates around ${holiday} book at the standard rate — the Weekday Special doesn't apply.`
        : "Weekday Special is available only for Monday-Thursday events.",
    )
  }

  const weekdayIsEligible = isWeekdaySaver ? weekdayViolations.length === 0 : true

  const baseSubtotal = isWeekdaySaver
    ? roundCurrency(adults * WEEKDAY_SAVER_ADULT_PRICE + kids * WEEKDAY_SAVER_KID_PRICE + toddlers * TODDLER_PRICE)
    : roundCurrency(adults * ADULT_PRICE + kids * KID_FOOD_PRICE + toddlers * TODDLER_PRICE)
  // 白桌布按张加 $5，4 人一桌（老板 09-23 定加价、09-30 改按张）。只有从
  // /rentals 带着选择过来的才知道桌布颜色；在 /quote 自己勾的没得选,按黑布算。
  const whiteClothFee =
    input.tablewareRental && input.setupSelection?.cloth === "white"
      ? roundCurrency(rulesWhiteClothFee(guestCount))
      : 0
  const tablewareFee = input.tablewareRental ? roundCurrency(guestCount * FULL_SETUP_PER_GUEST) + whiteClothFee : 0

  // One chef per 28 guests, one call-out fee per chef — currently waived.
  const chefCount = calcChefCount(guestCount)
  const callOutFeeWaived = isPromotionActive("call_out_fee_waived")
  const callOutFee = callOutFeeWaived ? 0 : roundCurrency(chefCount * CALL_OUT_FEE_PER_CHEF)

  const packageSubtotal = roundCurrency(baseSubtotal + tablewareFee + callOutFee)

  const travelFeeRange = travelFeeRangeOverride ?? getTravelFeeRange(input.location)

  // High end: every guest takes every picked upgrade (low end: nobody does).
  const addOnBaseHigh = guestCount * upgradesPerGuestHigh(input.addOns)
  const addOnTotalRange: QuoteRange = {
    low: 0,
    high: roundCurrency(addOnBaseHigh),
  }

  const subtotalRange: QuoteRange = {
    low: roundCurrency(packageSubtotal + addOnTotalRange.low),
    high: roundCurrency(packageSubtotal + addOnTotalRange.high),
  }

  // Standard tier only: Weekday Special is already discounted pricing, and
  // stacking would cut margin below the floor. The two identities never stack
  // with each other either — the input is a single choice. Under-5s don't count.
  const loyaltyDiscount = isWeekdaySaver
    ? 0
    : input.loyaltyStatus === "returning"
      ? calcReturningCustomerDiscount(adults + kids)
      : input.loyaltyStatus === "party_guest"
        ? PARTY_GUEST_CARD_DISCOUNT
        : 0

  // The $599 floor, as the invoice bills it. No party-size discount since
  // 2026-11-05 (D-1105-01).
  const floorLow = Math.max(subtotalRange.low, MINIMUM_SPEND)
  const floorHigh = Math.max(subtotalRange.high, MINIMUM_SPEND)
  // The breakdown's minimum line. The invoice floors the whole subtotal -
  // food, upgrades, rentals (calcInvoiceTotal) - so the line is measured on
  // what the breakdown lists, the upgrades as picked. It was effectiveBase -
  // baseSubtotal, the food alone: 7 adults + 1 kid with $208 of upgrades
  // ($657.20) read "+$149.80" of minimum on top of them, and a rented setup
  // was counted a second time under it (2026-11-08).
  const minimumTopUp = roundCurrency(floorHigh - subtotalRange.high)

  // A thank-you never takes a party under the $599 minimum (owner 2026-10-29):
  // a party already at the minimum gets no loyalty dollars.
  const loyaltyLow = Math.min(loyaltyDiscount, Math.max(0, floorLow - MINIMUM_SPEND))
  const loyaltyHigh = Math.min(loyaltyDiscount, Math.max(0, floorHigh - MINIMUM_SPEND))
  const totalBeforeTravelRange: QuoteRange = {
    low: roundCurrency(floorLow - loyaltyLow),
    high: roundCurrency(floorHigh - loyaltyHigh),
  }

  const totalRange: QuoteRange = {
    low: roundCurrency(totalBeforeTravelRange.low + travelFeeRange.low),
    high: roundCurrency(totalBeforeTravelRange.high + travelFeeRange.high),
  }

  const budgetFit =
    input.budget && input.budget > 0
      ? totalRange.low <= input.budget
        ? "within_budget"
        : "above_budget"
      : "not_provided"

  return {
    hasCoreInputs,
    guestCount,
    paidHeadcount: tierHeadcount({ adults, kids }),
    adultEquivalents,
    chefCount,
    callOutFee,
    callOutFeeWaived,
    pricingTier,
    baseSubtotal,
    minimumSpend: MINIMUM_SPEND,
    minimumTopUp,
    travelFeeRange,
    tablewareFee,
    addOnTotalRange,
    loyaltyDiscount: roundCurrency(loyaltyLow),
    totalRange,
    weekdaySaver: {
      isWeekdayEligible,
      isEligible: weekdayIsEligible,
      violations: weekdayViolations,
    },
    includesAppetizerPlatter: isWeekdaySaver && weekdayIsEligible,
    isBookable: hasCoreInputs && (!isWeekdaySaver || weekdayIsEligible),
    budgetFit,
  }
}

/**
 * What the Weekday Special saves this party against the Standard rate. Both
 * sides go through calculateQuote, so the $599 minimum is measured the
 * invoice's way on each (food, rentals, the upgrades as picked); /quote used
 * to floor the food alone, which read $0 for a small party its upgrades
 * already carry past the minimum. Loyalty stays out of it, as before.
 */
export function weekdaySpecialSavings(input: QuoteInput): number {
  // Two plain calls, not a small helper called twice: SWC's minifier inlined
  // that helper into /quote's useMemo and left its second copy reading an
  // undeclared `input`, which failed the production build (2026-11-09).
  const standard = calculateQuote({ ...input, pricingTier: "standard", loyaltyStatus: undefined })
  const weekday = calculateQuote({ ...input, pricingTier: "weekday_saver", loyaltyStatus: undefined })
  return Math.round(standard.totalRange.high - weekday.totalRange.high)
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    value,
  )
}

function formatAddOnSummary(addOns: QuoteAddOns): string {
  const labels: string[] = []
  if (addOns.steak) labels.push("filet mignon")
  if (addOns.shrimp) labels.push("scallops")
  if (addOns.lobster) labels.push("lobster tail")
  return labels.length > 0 ? labels.join(", ") : "none"
}

function formatSelectedUpgradeLabels(addOns: QuoteAddOns): string[] {
  const labels: string[] = []
  if (addOns.steak) labels.push("Filet Mignon")
  if (addOns.shrimp) labels.push("Scallops")
  if (addOns.lobster) labels.push("Lobster Tail")
  return labels
}

function interpolateTemplate(template: string, context: QuoteTemplateContext): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (match, key: keyof QuoteTemplateContext) => {
    return context[key] ?? match
  })
}

export function buildQuoteSummary(input: QuoteInput, result: QuoteResult): string {
  return [
    `Plan: ${getQuoteTierLabel(input.pricingTier)}`,
    `Date: ${input.eventDate || "TBD"}`,
    `Location: ${input.location || "TBD"}`,
    `Guests: ${result.guestCount} (Adults ${input.adults || 0}, Kids 5-12 ${input.kids || 0}, Under 5 ${input.toddlers || 0})`,
    `Full setup (tables/chairs/utensils): ${input.tablewareRental ? "yes" : "no"}`,
    input.setupSelection ? `Setup picked on /rentals: ${describeSetup(input.setupSelection)}` : null,
    `Upgrades: ${formatAddOnSummary(input.addOns)}`,
    result.includesAppetizerPlatter ? `Included: ${WEEKDAY_PLATTER_LINE}` : null,
    result.loyaltyDiscount > 0
      ? input.loyaltyStatus === "party_guest"
        ? `Party guest card discount: -$${result.loyaltyDiscount}`
        : `Returning customer discount: -$${result.loyaltyDiscount}`
      : null,
    `Estimated total: ${formatCurrency(result.totalRange.low)} - ${formatCurrency(result.totalRange.high)}`,
  ]
    .filter((line): line is string => Boolean(line))
    .join(" | ")
}

// The SMS a customer sends in their own name should read the way they would
// write it, so the prefilled body gets "Sat, Sep 13" rather than 2026-09-13.
function formatEventDatePretty(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim())
  if (!m) return isoDate || "TBD"
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

export function createQuoteTemplateContext(input: QuoteInput, result: QuoteResult, eventTime?: string): QuoteTemplateContext {
  return {
    event_date: input.eventDate || "TBD",
    event_date_pretty: formatEventDatePretty(input.eventDate || ""),
    event_time: eventTime || "TBD",
    location: input.location || "TBD",
    adults: String(input.adults || 0),
    kids: String(input.kids || 0),
    guest_count: String(result.guestCount),
    tableware_rental: input.tablewareRental ? "Yes" : "No",
    tent_10x10: input.tent10x10 ? "Yes" : "No",
    quote_tier: getQuoteTierLabel(input.pricingTier),
    tier_menu:
      input.pricingTier === "weekday_saver"
        ? `Weekday Special; 2 regular proteins per guest + ${WEEKDAY_PLATTER_LINE}`
        : "Standard Plan; 2 regular proteins per guest",
    upgrades: formatAddOnSummary(input.addOns),
    budget: input.budget ? formatCurrency(input.budget) : "Not provided",
    estimate_low: formatCurrency(result.totalRange.low),
    estimate_high: formatCurrency(result.totalRange.high),
    quote_summary: buildQuoteSummary(input, result),
  }
}

export function buildSmsBody(input: QuoteInput, result: QuoteResult, template: string): string {
  const context = createQuoteTemplateContext(input, result)
  return interpolateTemplate(template, context)
}

export function buildEmailPayload(
  input: QuoteInput,
  result: QuoteResult,
  templates: { subject: string; body: string },
): { subject: string; body: string } {
  const context = createQuoteTemplateContext(input, result)
  return {
    subject: interpolateTemplate(templates.subject, context),
    body: interpolateTemplate(templates.body, context),
  }
}

export function buildCallScript(input: QuoteInput, result: QuoteResult, template: string, eventTime?: string): string {
  void template

  const guestsLine = `We have ${result.guestCount} guests (Adults ${input.adults || 0}, Kids ${input.kids || 0}).`
  const details: string[] = []

  if (input.tablewareRental) {
    details.push(`We would like tableware rental at $${FULL_SETUP_PER_GUEST} per person.`)
  }


  const selectedUpgrades = formatSelectedUpgradeLabels(input.addOns)
  if (selectedUpgrades.length > 0) {
    details.push(`We are interested in premium upgrades: ${selectedUpgrades.join(", ")}.`)
  }

  return [
    `Hi, I am calling about a quote for ${input.eventDate || "TBD"} at ${eventTime || "TBD"} in ${input.location || "TBD"}.`,
    guestsLine,
    ...details,
  ].join(" ")
}
