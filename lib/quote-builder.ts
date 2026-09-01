import {
  GUEST_TIERS,
  WEEKDAY_SPECIAL,
  MINIMUM_SPEND as RULES_MINIMUM_SPEND,
  FULL_SETUP_PER_GUEST as RULES_FULL_SETUP,
  TRAVEL_FREE_RADIUS_MILES,
  TRAVEL_RATE_PER_MILE,
  CALL_OUT_FEE_PER_CHEF,
  calcChefCount,
  calcAdultEquivalents,
  calcReturningCustomerDiscount,
  PARTY_GUEST_CARD_DISCOUNT,
  isPromotionActive,
  isWeekdayEligibleDate,
} from "@/config/pricing-rules"

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
  tent10x10: boolean
  budget?: number
  addOns: QuoteAddOns
  /**
   * How the customer already knows us (standard tier only, never stacks):
   * "returning" — booked before, $60 off per 10 full guests;
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
  chefCount: number
  callOutFee: number
  callOutFeeWaived: boolean
  pricingTier: QuotePricingTier
  baseSubtotal: number
  minimumSpend: number
  effectiveBase: number
  travelFeeRange: QuoteRange
  tablewareFee: number
  addOnTotalRange: QuoteRange
  loyaltyDiscount: number
  totalRange: QuoteRange
  weekdaySaver: {
    isWeekdayEligible: boolean
    isGuestCountEligible: boolean
    hasValidProteinSelection: boolean
    selectedProteinCount: number
    selectedProteins: string[]
    isEligible: boolean
    violations: string[]
  }
  isBookable: boolean
  budgetFit: "within_budget" | "above_budget" | "not_provided"
}

export type QuoteTemplateContext = {
  event_date: string
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
const WEEKDAY_SAVER_MIN_GUESTS = WEEKDAY_SPECIAL.minAdultEquivalents

const ADD_ON_PER_GUEST = {
  steak: 8,
  shrimp: 6,
  lobster: 12,
} as const

const WEEKDAY_SAVER_PROTEIN_LABELS: Record<keyof WeekdaySaverProteins, string> = {
  chicken: "Chicken",
  steak: "Steak",
  shrimp: "Shrimp",
}
const WEEKDAY_SAVER_INCLUDED_PROTEINS = Object.keys(WEEKDAY_SAVER_PROTEIN_LABELS) as Array<
  keyof WeekdaySaverProteins
>
const WEEKDAY_SAVER_MENU_SUMMARY = "Guests pick 2 of 3 proteins: Chicken, Steak, Shrimp"

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

function normalizeGuests(input: number): number {
  if (!Number.isFinite(input) || input < 0) return 0
  return Math.floor(input)
}

function getWeekdaySaverIncludedProteins(): string[] {
  return WEEKDAY_SAVER_INCLUDED_PROTEINS.map((key) => WEEKDAY_SAVER_PROTEIN_LABELS[key])
}

function formatWeekdaySaverProteinSummary(): string {
  return WEEKDAY_SAVER_MENU_SUMMARY
}

function getQuoteTierLabel(pricingTier: QuotePricingTier): string {
  return pricingTier === "weekday_saver" ? "Weekday Special ($45.9/adult, $22.95/child)" : "Standard Plan"
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

  const selectedWeekdayProteins = getWeekdaySaverIncludedProteins()
  const selectedWeekdayProteinCount = selectedWeekdayProteins.length
  const isWeekdayEligible = isWeekdayEligibleDate(input.eventDate)
  const isGuestCountEligible = adultEquivalents >= WEEKDAY_SAVER_MIN_GUESTS
  const hasValidProteinSelection = true

  const weekdayViolations: string[] = []
  if (isWeekdaySaver) {
    if (!isWeekdayEligible) weekdayViolations.push("Weekday Special is available only for Monday-Thursday events.")
    if (!isGuestCountEligible)
      weekdayViolations.push(
        `Weekday Special requires ${WEEKDAY_SAVER_MIN_GUESTS}+ guests (a child counts as half an adult; under-5s do not count).`,
      )
  }

  const weekdayIsEligible = isWeekdaySaver ? weekdayViolations.length === 0 : true

  const baseSubtotal = isWeekdaySaver
    ? roundCurrency(adults * WEEKDAY_SAVER_ADULT_PRICE + kids * WEEKDAY_SAVER_KID_PRICE + toddlers * TODDLER_PRICE)
    : roundCurrency(adults * ADULT_PRICE + kids * KID_FOOD_PRICE + toddlers * TODDLER_PRICE)
  const tablewareFee = input.tablewareRental ? roundCurrency(guestCount * FULL_SETUP_PER_GUEST) : 0

  // One chef per 28 guests, one call-out fee per chef — currently waived.
  const chefCount = calcChefCount(guestCount)
  const callOutFeeWaived = isPromotionActive("call_out_fee_waived")
  const callOutFee = callOutFeeWaived ? 0 : roundCurrency(chefCount * CALL_OUT_FEE_PER_CHEF)

  const packageSubtotal = roundCurrency(baseSubtotal + tablewareFee + callOutFee)

  const travelFeeRange = travelFeeRangeOverride ?? getTravelFeeRange(input.location)

  const selectedUpgradeUnitPrice = isWeekdaySaver
    ? 0
    : (input.addOns.steak ? ADD_ON_PER_GUEST.steak : 0) +
      (input.addOns.shrimp ? ADD_ON_PER_GUEST.shrimp : 0) +
      (input.addOns.lobster ? ADD_ON_PER_GUEST.lobster : 0)

  const addOnBaseHigh = guestCount * selectedUpgradeUnitPrice
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

  const totalBeforeTravelRange: QuoteRange = {
    low: Math.max(Math.max(subtotalRange.low, MINIMUM_SPEND) - loyaltyDiscount, 0),
    high: Math.max(Math.max(subtotalRange.high, MINIMUM_SPEND) - loyaltyDiscount, 0),
  }

  const effectiveBase = Math.max(packageSubtotal, MINIMUM_SPEND)

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
    adultEquivalents,
    chefCount,
    callOutFee,
    callOutFeeWaived,
    pricingTier,
    baseSubtotal,
    minimumSpend: MINIMUM_SPEND,
    effectiveBase,
    travelFeeRange,
    tablewareFee,
    addOnTotalRange,
    loyaltyDiscount,
    totalRange,
    weekdaySaver: {
      isWeekdayEligible,
      isGuestCountEligible,
      hasValidProteinSelection,
      selectedProteinCount: selectedWeekdayProteinCount,
      selectedProteins: selectedWeekdayProteins,
      isEligible: weekdayIsEligible,
      violations: weekdayViolations,
    },
    isBookable: hasCoreInputs && (!isWeekdaySaver || weekdayIsEligible),
    budgetFit,
  }
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
    input.pricingTier === "weekday_saver"
      ? `Weekday Special menu: ${formatWeekdaySaverProteinSummary()}`
      : `Upgrades: ${formatAddOnSummary(input.addOns)}`,
    input.pricingTier === "weekday_saver" ? "Premium upgrades: not available in Weekday Special" : null,
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

export function createQuoteTemplateContext(input: QuoteInput, result: QuoteResult, eventTime?: string): QuoteTemplateContext {
  return {
    event_date: input.eventDate || "TBD",
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
        ? formatWeekdaySaverProteinSummary()
        : "Standard Plan; 2 regular proteins per guest",
    upgrades: input.pricingTier === "weekday_saver" ? "Not available for Weekday Special" : formatAddOnSummary(input.addOns),
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
    details.push(`We would like tableware rental at $15 per person.`)
  }


  if (input.pricingTier !== "weekday_saver") {
    const selectedUpgrades = formatSelectedUpgradeLabels(input.addOns)
    if (selectedUpgrades.length > 0) {
      details.push(`We are interested in premium upgrades: ${selectedUpgrades.join(", ")}.`)
    }
  }

  return [
    `Hi, I am calling about a quote for ${input.eventDate || "TBD"} at ${eventTime || "TBD"} in ${input.location || "TBD"}.`,
    guestsLine,
    ...details,
  ].join(" ")
}
