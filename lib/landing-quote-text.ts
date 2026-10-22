// Wording the landing-quote text and email share (app/api/landing-quote).
// The numbers come from config/pricing-rules, never from here.
import { GUEST_TIERS, MINIMUM_SPEND, type SimpleEstimate } from "@/config/pricing-rules"

/** The party as the quote says it: "1 adult", "12 adults + 1 kid". */
export function partyLine(adults: number, kids: number): string {
  const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`
  return kids > 0 ? `${count(adults, "adult")} + ${count(kids, "kid")}` : count(adults, "adult")
}

/**
 * Guests the minimum pays for at the full adult rate: $599 / $59.90 = 10.
 * Counted in cents, so a quotient a hair under 10 cannot floor to 9.
 */
export const MINIMUM_COVERS_GUESTS = Math.floor(Math.round(MINIMUM_SPEND * 100) / Math.round(GUEST_TIERS.adult.price * 100))

const dollars = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`

/**
 * What the price is when the minimum set it, or null when the food cleared it.
 * "$599.00 for 1 adults" read as $599 a head (Susan Romero, La Puente,
 * 2026-10-22), and the desk had to text her that it is the minimum and covers
 * 10 guests. Any party of up to MINIMUM_COVERS_GUESTS pays exactly the
 * minimum on either rate; a bigger one lands on it only when kids or the
 * Mon-Thu rate keep the food under it, and is told it covers them all. With
 * travel the total is more than the minimum, so the note names both.
 */
export function minimumNote(est: Pick<SimpleEstimate, "minApplied" | "travelFee">, guests: number): string | null {
  if (!est.minApplied) return null
  const travel = est.travelFee > 0
  return guests <= MINIMUM_COVERS_GUESTS
    ? `our ${MINIMUM_COVERS_GUESTS}-guest minimum${travel ? ` (${dollars(MINIMUM_SPEND)}) plus travel` : ""}, so it covers up to ${MINIMUM_COVERS_GUESTS} guests`
    : `our ${dollars(MINIMUM_SPEND)} minimum${travel ? " plus travel" : ""}, which covers all ${guests} guests`
}
