// Channel-specific deposit offers.
//
// The standard date-lock deposit is DEPOSIT_AMOUNT (config/pricing-rules). An
// offer replaces it for customers who arrived from one of the listed paid
// channels while the offer is live - the 2026-09 Meta video test runs on
// "$9.90 holds your date". The server (lib/deposit-offer.ts, used by
// /api/deposit/start) is the only thing that decides what Stripe charges;
// everything on the client is display. Public pages never mention the
// deposit at all, so the offer surfaces in the ad, the quote text, /quote's
// deposit link and the pay page - nowhere else.
import { DEPOSIT_AMOUNT } from "./pricing-rules"

export type DepositOffer = {
  /** Rides in deposit links (?offer=) and Stripe metadata (deposit_offer). */
  code: string
  amount: number
  /** Channels as rh_resolve_channel (Supabase) names them: meta_ads, yelp_ads, chatgpt_ads … */
  channels: string[]
  /** Inclusive PT calendar dates. */
  startsOn: string
  endsOn: string
  /** Customer-facing, used in the quote text and on the pay page. */
  label: string
  /** Where the customer came from, in their words. */
  sourceLabel: string
}

export const DEPOSIT_OFFERS: DepositOffer[] = [
  {
    code: "meta990",
    amount: 9.9,
    channels: ["meta_ads"],
    startsOn: "2026-09-21",
    endsOn: "2026-10-31",
    label: "$9.90 holds your date",
    sourceLabel: "our Facebook / Instagram ad",
  },
]

// Mirrors the paid branches of rh_resolve_channel in Supabase; keep the two in step.
const META_SOURCES = new Set([
  "facebook", "fb", "instagram", "ig", "meta", "facebook.com", "instagram.com",
  "l.facebook.com", "m.facebook.com", "lm.facebook.com", "l.instagram.com",
])
const PAID_MEDIUMS = new Set(["cpc", "ppc", "paid", "paidsearch", "paid_search", "paid-social", "paid_social", "cpm", "display"])

export function resolvePaidChannel(utmSource?: string | null, utmMedium?: string | null): string | undefined {
  const src = (utmSource ?? "").trim().toLowerCase()
  const med = (utmMedium ?? "").trim().toLowerCase()
  if (!src || !PAID_MEDIUMS.has(med)) return undefined
  if (META_SOURCES.has(src)) return "meta_ads"
  if (src.startsWith("yelp")) return "yelp_ads"
  if (src.includes("chatgpt") || src.includes("openai")) return "chatgpt_ads"
  if (src.startsWith("google")) return "google_ads"
  return "other_ads"
}

function ptDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(now)
}

export function isOfferLive(offer: DepositOffer, now: Date = new Date()): boolean {
  const today = ptDate(now)
  return today >= offer.startsOn && today <= offer.endsOn
}

/** The live offer for a visit's attribution, if its paid channel has one. */
export function findDepositOffer(params: { utm_source?: string | null; utm_medium?: string | null; now?: Date }): DepositOffer | undefined {
  const channel = resolvePaidChannel(params.utm_source, params.utm_medium)
  if (!channel) return undefined
  return DEPOSIT_OFFERS.find((offer) => offer.channels.includes(channel) && isOfferLive(offer, params.now))
}

/** A live offer by its link code. Display only - the server re-derives eligibility from attribution. */
export function getLiveOfferByCode(code?: string | null, now: Date = new Date()): DepositOffer | undefined {
  const wanted = (code ?? "").trim().toLowerCase()
  if (!wanted) return undefined
  return DEPOSIT_OFFERS.find((offer) => offer.code === wanted && isOfferLive(offer, now))
}

export function depositAmountFor(offer?: DepositOffer | null): number {
  return offer ? offer.amount : DEPOSIT_AMOUNT
}

export type DepositOfferView = {
  code: string
  label: string
  sourceLabel: string
  amount: number
  standardAmount: number
}

export function toOfferView(offer: DepositOffer): DepositOfferView {
  return { code: offer.code, label: offer.label, sourceLabel: offer.sourceLabel, amount: offer.amount, standardAmount: DEPOSIT_AMOUNT }
}
