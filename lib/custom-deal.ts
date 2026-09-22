import { createHmac, timingSafeEqual } from "crypto"

// The owner's deal for one party, carried as RULES rather than one frozen
// number (owner 2026-09-22): "this party pays $54.90 a head and the tables and
// place settings are on me". The order system re-prices those rules against
// the party as it stands, so adding a guest or ticking the tables can never
// outrun the promise - which is exactly what the older agreed-total number did.
//
// The link is customer-visible, so the rules are signed. Without a valid
// signature the deposit flow ignores them and prices from the catalog.

export interface CustomDeal {
  adultRate?: number
  childRate?: number
  freeExtraIds?: string[]
  flatOff?: number
  note?: string
}

// Mirrors PARTY_EXTRAS in the invoice tool (v0-real-hibachi-invoice-generator
// lib/pricing.ts). Anything not on this list is dropped before signing.
const FREE_EXTRA_IDS = [
  "gyoza",
  "edamame",
  "spring_rolls",
  "noodles_party",
  "diy_rice_shrimp",
  "diy_rice_chicken",
  "extra_egg",
  "tables_chairs",
  "utensils",
] as const

function secret(): string | null {
  return process.env.AGREED_TOTAL_SECRET || process.env.ADMIN_DASH_KEY || null
}

function rate(value: unknown): number | undefined {
  const num = typeof value === "string" ? Number(value) : value
  if (typeof num !== "number" || !Number.isFinite(num) || num < 0 || num > 10_000) return undefined
  return Math.round(num * 100) / 100
}

/** Drop anything we would not bill: bad rates, unknown extras, empty deals. */
export function normalizeDeal(input: unknown): CustomDeal | null {
  if (!input || typeof input !== "object") return null
  const source = input as Record<string, unknown>
  const freeExtraIds = Array.isArray(source.freeExtraIds)
    ? (source.freeExtraIds.filter((id): id is string => typeof id === "string" && (FREE_EXTRA_IDS as readonly string[]).includes(id)))
    : []
  const deal: CustomDeal = {}
  const adultRate = rate(source.adultRate)
  const childRate = rate(source.childRate)
  const flatOff = rate(source.flatOff)
  if (adultRate !== undefined) deal.adultRate = adultRate
  if (childRate !== undefined) deal.childRate = childRate
  if (freeExtraIds.length > 0) deal.freeExtraIds = freeExtraIds
  if (flatOff !== undefined && flatOff > 0) deal.flatOff = flatOff
  const note = typeof source.note === "string" ? source.note.trim().slice(0, 80) : ""
  if (note) deal.note = note
  const hasRule =
    deal.adultRate !== undefined || deal.childRate !== undefined || deal.freeExtraIds !== undefined || deal.flatOff !== undefined
  return hasRule ? deal : null
}

/** Canonical JSON (fixed key order) so the same deal always signs the same. */
export function encodeDeal(deal: CustomDeal): string {
  const canonical = JSON.stringify({
    adultRate: deal.adultRate ?? null,
    childRate: deal.childRate ?? null,
    freeExtraIds: [...(deal.freeExtraIds ?? [])].sort(),
    flatOff: deal.flatOff ?? null,
    note: deal.note ?? "",
  })
  return Buffer.from(canonical, "utf8").toString("base64url")
}

export function decodeDeal(encoded: string | null | undefined): CustomDeal | null {
  const value = (encoded ?? "").trim()
  if (!value || value.length > 600) return null
  try {
    return normalizeDeal(JSON.parse(Buffer.from(value, "base64url").toString("utf8")))
  } catch {
    return null
  }
}

/** Signature for one lead's deal, or null when it cannot be signed. */
export function signDeal(leadId: string | null | undefined, encoded: string): string | null {
  const key = secret()
  if (!key || !encoded) return null
  return createHmac("sha256", key).update(`custom-deal:v1|${(leadId ?? "").trim()}|${encoded}`).digest("hex").slice(0, 24)
}

/** The deal only when `sig` was minted by us for exactly this lead and payload. */
export function verifyDeal(
  leadId: string | null | undefined,
  encoded: string | null | undefined,
  sig: string | null | undefined,
): CustomDeal | null {
  const value = (encoded ?? "").trim()
  const expected = signDeal(leadId, value)
  const given = (sig ?? "").trim()
  if (!expected || given.length !== expected.length) return null
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(given))) return null
  return decodeDeal(value)
}
