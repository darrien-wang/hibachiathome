// Sales-tax rate for a party address, from the CDTFA rate API.
//
// Under the by-method pricing terms (lib/pricing.ts, D-1006-05) a card
// invoice carries the sales tax for the party's own address - never a flat
// figure - so every priced invoice needs the real rate of the place the meal
// is served. CDTFA publishes a free lookup (no key) that returns the combined
// state + local + district rate for a street address; La Puente is 10.75%,
// unincorporated LA County 10.25%, LA city 9.5%, Orange County 7.75%.
//
// Server-side only (plain fetch, 6 s timeout, small in-memory cache). When the
// lookup fails the caller falls back to DEFAULT_SALES_TAX_RATE and records
// that the rate is a default, so the invoice can be re-rated later.

export type SalesTaxRate = {
  /** e.g. 0.1075 */
  rate: number
  /** CDTFA jurisdiction label, e.g. "LA PUENTE" or "UNINCORPORATED AREA-LOS ANGELES". */
  jurisdiction: string
  /** CDTFA tax area code, useful on the quarterly return. */
  tac?: string
  source: "cdtfa"
}

export type ParsedAddress = { street?: string; city?: string; zip?: string }

const CDTFA_RATE_API = "https://services.maps.cdtfa.ca.gov/api/taxrate/GetRateByAddress"
const TIMEOUT_MS = 6000
const cache = new Map<string, { at: number; value: SalesTaxRate | null }>()
const CACHE_TTL_MS = 1000 * 60 * 60 * 24

/**
 * Split a one-line US address ("913 Ranlett Ave, La Puente, CA 91744") into
 * the three parts the CDTFA API wants. Tolerates a trailing ", USA", a
 * missing state, and a ZIP+4.
 */
export function parseUsAddress(full: string | null | undefined): ParsedAddress {
  if (!full) return {}
  const cleaned = full.replace(/\s+/g, " ").replace(/,?\s*(USA|United States)\s*$/i, "").trim()
  const zipMatch = cleaned.match(/\b(\d{5})(?:-\d{4})?\b(?!.*\b\d{5}\b)/)
  const zip = zipMatch?.[1]
  const parts = cleaned.split(",").map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return { zip }
  const street = parts[0]
  // The city is the part before the "CA 91744" / "CA" piece, or the second part.
  let city: string | undefined
  for (let i = parts.length - 1; i >= 1; i--) {
    const p = parts[i].replace(/\b(CA|California)\b/i, "").replace(/\b\d{5}(?:-\d{4})?\b/, "").trim()
    if (p) { city = p; break }
  }
  return { street, city, zip }
}

function cacheKey(a: ParsedAddress): string {
  return [a.street, a.city, a.zip].map((s) => (s ?? "").toLowerCase().trim()).join("|")
}

/**
 * The combined sales-tax rate at an address, or null when CDTFA cannot place
 * it (bad address, API down, non-California). Never throws.
 */
export async function lookupSalesTaxRate(input: ParsedAddress | string | null | undefined): Promise<SalesTaxRate | null> {
  const addr = typeof input === "string" ? parseUsAddress(input) : input ?? {}
  if (!addr.street || !addr.zip) return null
  const key = cacheKey(addr)
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value
  const params = new URLSearchParams({ address: addr.street, city: addr.city ?? "", zip: addr.zip })
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  let value: SalesTaxRate | null = null
  try {
    const res = await fetch(`${CDTFA_RATE_API}?${params.toString()}`, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 RealHibachi-marketing" },
    })
    if (res.ok) {
      const json = (await res.json()) as { taxRateInfo?: Array<{ rate?: number; jurisdiction?: string; tac?: string }> }
      const info = json.taxRateInfo?.[0]
      if (info && typeof info.rate === "number" && info.rate > 0 && info.rate < 0.2) {
        value = { rate: info.rate, jurisdiction: (info.jurisdiction ?? "").trim(), tac: info.tac, source: "cdtfa" }
      }
    }
  } catch {
    value = null
  } finally {
    clearTimeout(timer)
  }
  cache.set(key, { at: Date.now(), value })
  return value
}

/** "10.75%" for 0.1075 - the label every surface prints next to the tax line. */
export function formatTaxRate(rate: number): string {
  const pct = rate * 100
  return `${Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(2).replace(/0$/, "")}%`
}
