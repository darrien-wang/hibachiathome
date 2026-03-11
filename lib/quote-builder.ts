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
  kids: number
  pricingTier: QuotePricingTier
  weekdaySaverProteins: WeekdaySaverProteins
  tablewareRental: boolean
  tent10x10: boolean
  budget?: number
  addOns: QuoteAddOns
}

export type QuoteRange = {
  low: number
  high: number
}

export type QuoteResult = {
  hasCoreInputs: boolean
  guestCount: number
  pricingTier: QuotePricingTier
  baseSubtotal: number
  minimumSpend: number
  effectiveBase: number
  travelFeeRange: QuoteRange
  tablewareFee: number
  addOnTotalRange: QuoteRange
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

const ADULT_PRICE = 59.9
const KID_FOOD_PRICE = 29.95
const FULL_SETUP_PER_GUEST = 15
const MINIMUM_SPEND = 599
const WEEKDAY_SAVER_ADULT_PRICE = 45.9
const WEEKDAY_SAVER_KID_PRICE = 22.95
const WEEKDAY_SAVER_MIN_GUESTS = 15

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

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

function normalizeGuests(input: number): number {
  if (!Number.isFinite(input) || input < 0) return 0
  return Math.floor(input)
}

function getEventDayOfWeek(eventDate: string): number | null {
  if (!eventDate) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(eventDate)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(year, month - 1, day)

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null
  }

  return parsed.getDay()
}

function isMondayToThursday(eventDate: string): boolean {
  const dayOfWeek = getEventDayOfWeek(eventDate)
  if (dayOfWeek === null) return false
  return dayOfWeek >= 1 && dayOfWeek <= 4
}

function getSelectedWeekdaySaverProteins(proteins: WeekdaySaverProteins): string[] {
  return (Object.keys(WEEKDAY_SAVER_PROTEIN_LABELS) as Array<keyof WeekdaySaverProteins>).filter((key) => proteins[key])
}

function formatWeekdaySaverProteinSummary(proteins: WeekdaySaverProteins): string {
  const selected = getSelectedWeekdaySaverProteins(proteins).map((key) => WEEKDAY_SAVER_PROTEIN_LABELS[key])
  return selected.length > 0 ? selected.join(", ") : "none selected"
}

function getQuoteTierLabel(pricingTier: QuotePricingTier): string {
  return pricingTier === "weekday_saver" ? "Weekday Saver ($45.9/adult, $22.95/child)" : "Standard Plan"
}

export function getTravelFeeRange(location: string): QuoteRange {
  const normalizedLocation = location.trim()
  if (!normalizedLocation) return { low: 0, high: 0 }
  return { low: 0, high: 0 }
}

export function calculateQuote(input: QuoteInput, travelFeeRangeOverride?: QuoteRange): QuoteResult {
  const adults = normalizeGuests(input.adults)
  const kids = normalizeGuests(input.kids)
  const guestCount = adults + kids
  const hasCoreInputs = Boolean(input.eventDate && input.location.trim() && guestCount > 0)
  const pricingTier = input.pricingTier
  const isWeekdaySaver = pricingTier === "weekday_saver"

  const selectedWeekdayProteins = getSelectedWeekdaySaverProteins(input.weekdaySaverProteins)
  const selectedWeekdayProteinCount = selectedWeekdayProteins.length
  const isWeekdayEligible = isMondayToThursday(input.eventDate)
  const isGuestCountEligible = guestCount >= WEEKDAY_SAVER_MIN_GUESTS
  const hasValidProteinSelection = selectedWeekdayProteinCount === 2

  const weekdayViolations: string[] = []
  if (isWeekdaySaver) {
    if (!isWeekdayEligible) weekdayViolations.push("Weekday Saver is available only for Monday-Thursday events.")
    if (!isGuestCountEligible) weekdayViolations.push("Weekday Saver requires at least 15 total guests.")
    if (!hasValidProteinSelection) weekdayViolations.push("Weekday Saver requires exactly 2 proteins from chicken, steak, shrimp.")
  }

  const weekdayIsEligible = isWeekdaySaver ? weekdayViolations.length === 0 : true

  const baseSubtotal = isWeekdaySaver
    ? roundCurrency(adults * WEEKDAY_SAVER_ADULT_PRICE + kids * WEEKDAY_SAVER_KID_PRICE)
    : roundCurrency(adults * ADULT_PRICE + kids * KID_FOOD_PRICE)
  const tablewareFee = input.tablewareRental ? roundCurrency(guestCount * FULL_SETUP_PER_GUEST) : 0
  const packageSubtotal = roundCurrency(baseSubtotal + tablewareFee)

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

  const totalBeforeTravelRange: QuoteRange = {
    low: Math.max(subtotalRange.low, MINIMUM_SPEND),
    high: Math.max(subtotalRange.high, MINIMUM_SPEND),
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
    pricingTier,
    baseSubtotal,
    minimumSpend: MINIMUM_SPEND,
    effectiveBase,
    travelFeeRange,
    tablewareFee,
    addOnTotalRange,
    totalRange,
    weekdaySaver: {
      isWeekdayEligible,
      isGuestCountEligible,
      hasValidProteinSelection,
      selectedProteinCount: selectedWeekdayProteinCount,
      selectedProteins: selectedWeekdayProteins.map((key) => WEEKDAY_SAVER_PROTEIN_LABELS[key]),
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
    `Guests: ${result.guestCount} (Adults ${input.adults || 0}, Kids ${input.kids || 0})`,
    `Full setup (tables/chairs/utensils): ${input.tablewareRental ? "yes" : "no"}`,
    `10'x10' tent: ${input.tent10x10 ? "yes" : "no"}`,
    input.pricingTier === "weekday_saver"
      ? `Weekday Saver proteins (pick 2): ${formatWeekdaySaverProteinSummary(input.weekdaySaverProteins)}`
      : `Upgrades: ${formatAddOnSummary(input.addOns)}`,
    input.pricingTier === "weekday_saver" ? "Premium upgrades: not available in Weekday Saver" : null,
    `Estimated total: ${formatCurrency(result.totalRange.low)} - ${formatCurrency(result.totalRange.high)}`,
  ]
    .filter((line): line is string => Boolean(line))
    .join(" | ")
}

export function createQuoteTemplateContext(input: QuoteInput, result: QuoteResult): QuoteTemplateContext {
  return {
    event_date: input.eventDate || "TBD",
    location: input.location || "TBD",
    adults: String(input.adults || 0),
    kids: String(input.kids || 0),
    guest_count: String(result.guestCount),
    tableware_rental: input.tablewareRental ? "Yes" : "No",
    tent_10x10: input.tent10x10 ? "Yes" : "No",
    quote_tier: getQuoteTierLabel(input.pricingTier),
    tier_menu:
      input.pricingTier === "weekday_saver"
        ? formatWeekdaySaverProteinSummary(input.weekdaySaverProteins)
        : "Not applicable",
    upgrades: input.pricingTier === "weekday_saver" ? "Not available for Weekday Saver" : formatAddOnSummary(input.addOns),
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

export function buildCallScript(input: QuoteInput, result: QuoteResult, template: string): string {
  const context = createQuoteTemplateContext(input, result)
  const interpolated = interpolateTemplate(template, context)
  const withKids = interpolated.includes("Kids") ? interpolated : `${interpolated} Kids: ${context.kids}.`
  return withKids.includes("tables/chairs/utensils") || withKids.includes("full setup")
    ? withKids
    : `${withKids} Full setup (tables/chairs/utensils): ${context.tableware_rental}.`
}
