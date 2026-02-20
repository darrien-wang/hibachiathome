export type QuoteAddOns = {
  steak: boolean
  shrimp: boolean
  lobster: boolean
}

export type QuoteInput = {
  eventDate: string
  location: string
  adults: number
  kids: number
  tablewareRental: boolean
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
  baseSubtotal: number
  minimumSpend: number
  effectiveBase: number
  travelFeeRange: QuoteRange
  tablewareFee: number
  addOnTotalRange: QuoteRange
  totalRange: QuoteRange
  budgetFit: "within_budget" | "above_budget" | "not_provided"
}

const ADULT_PRICE = 59.9
const KID_PRICE = 29.9
const MINIMUM_SPEND = 599

const ADD_ON_PER_GUEST = {
  steak: 8,
  shrimp: 10,
  lobster: 18,
} as const

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

function normalizeGuests(input: number): number {
  if (!Number.isFinite(input) || input < 0) return 0
  return Math.floor(input)
}

export function getTravelFeeRange(location: string): QuoteRange {
  const normalizedLocation = location.trim().toLowerCase()

  if (!normalizedLocation) return { low: 30, high: 90 }

  if (
    normalizedLocation.includes("los angeles") ||
    normalizedLocation.includes("orange county") ||
    normalizedLocation.includes("irvine") ||
    normalizedLocation.includes("anaheim") ||
    normalizedLocation.includes("santa monica") ||
    normalizedLocation.includes("pasadena")
  ) {
    return { low: 25, high: 60 }
  }

  const zipMatch = normalizedLocation.match(/\b(\d{5})\b/)
  if (zipMatch) {
    const zip = Number.parseInt(zipMatch[1], 10)
    if (zip >= 90000 && zip <= 93999) return { low: 25, high: 60 }
    if (zip >= 94000 && zip <= 96199) return { low: 50, high: 110 }
  }

  return { low: 60, high: 140 }
}

export function calculateQuote(input: QuoteInput): QuoteResult {
  const adults = normalizeGuests(input.adults)
  const kids = normalizeGuests(input.kids)
  const guestCount = adults + kids
  const hasCoreInputs = Boolean(input.eventDate && input.location.trim() && guestCount > 0)

  const baseSubtotal = roundCurrency(adults * ADULT_PRICE + kids * KID_PRICE)
  const effectiveBase = Math.max(baseSubtotal, MINIMUM_SPEND)

  const travelFeeRange = getTravelFeeRange(input.location)
  const tablewareFee = input.tablewareRental ? Math.max(guestCount * 2.5, 30) : 0

  const selectedAddOnUnitPrice =
    (input.addOns.steak ? ADD_ON_PER_GUEST.steak : 0) +
    (input.addOns.shrimp ? ADD_ON_PER_GUEST.shrimp : 0) +
    (input.addOns.lobster ? ADD_ON_PER_GUEST.lobster : 0)

  const addOnBase = guestCount * selectedAddOnUnitPrice
  const addOnTotalRange: QuoteRange = {
    low: roundCurrency(addOnBase * 0.9),
    high: roundCurrency(addOnBase * 1.1),
  }

  const totalRange: QuoteRange = {
    low: roundCurrency(effectiveBase + tablewareFee + travelFeeRange.low + addOnTotalRange.low),
    high: roundCurrency(effectiveBase + tablewareFee + travelFeeRange.high + addOnTotalRange.high),
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
    baseSubtotal,
    minimumSpend: MINIMUM_SPEND,
    effectiveBase,
    travelFeeRange,
    tablewareFee: roundCurrency(tablewareFee),
    addOnTotalRange,
    totalRange,
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
  if (addOns.steak) labels.push("steak")
  if (addOns.shrimp) labels.push("shrimp")
  if (addOns.lobster) labels.push("lobster")
  return labels.length > 0 ? labels.join(", ") : "none"
}

export function buildQuoteSummary(input: QuoteInput, result: QuoteResult): string {
  return [
    `Date: ${input.eventDate || "TBD"}`,
    `Location: ${input.location || "TBD"}`,
    `Guests: ${result.guestCount} (Adults ${input.adults || 0}, Kids ${input.kids || 0})`,
    `Tableware rental: ${input.tablewareRental ? "yes" : "no"}`,
    `Upgrades: ${formatAddOnSummary(input.addOns)}`,
    `Budget: ${input.budget ? formatCurrency(input.budget) : "not provided"}`,
    `Estimated total: ${formatCurrency(result.totalRange.low)} - ${formatCurrency(result.totalRange.high)}`,
  ].join(" | ")
}

export function buildSmsBody(input: QuoteInput, result: QuoteResult): string {
  return `Hi Real Hibachi, I completed a quote and want to book. ${buildQuoteSummary(input, result)}`
}

export function buildEmailPayload(input: QuoteInput, result: QuoteResult): { subject: string; body: string } {
  return {
    subject: `Quote Request - ${input.eventDate || "TBD Date"} - ${input.location || "TBD Location"}`,
    body: [
      "Hi Real Hibachi team,",
      "",
      "I would like a confirmation for this event:",
      `- Event date: ${input.eventDate || "TBD"}`,
      `- Location: ${input.location || "TBD"}`,
      `- Adults: ${input.adults || 0}`,
      `- Kids: ${input.kids || 0}`,
      `- Tableware rental: ${input.tablewareRental ? "Yes" : "No"}`,
      `- Upgrades: ${formatAddOnSummary(input.addOns)}`,
      `- Budget: ${input.budget ? formatCurrency(input.budget) : "Not provided"}`,
      `- Estimated total range: ${formatCurrency(result.totalRange.low)} - ${formatCurrency(result.totalRange.high)}`,
      "",
      "Please confirm availability and next steps.",
      "",
      "Thank you.",
    ].join("\n"),
  }
}

export function buildCallScript(input: QuoteInput, result: QuoteResult): string {
  return `Hi, I am calling about a quote for ${input.eventDate || "my event"} in ${input.location || "my area"} for ${result.guestCount} guests. My estimate range is ${formatCurrency(result.totalRange.low)} to ${formatCurrency(result.totalRange.high)}.`
}
