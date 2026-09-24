// When the exact house does not geocode, fall back to the town - carefully.
//
// "8050 Stargate, Yucca Valley, CA 92284" is a real customer address with no
// entry in the map data (2026-09-24), and a town-level distance out in the
// desert beats quoting $0 travel for a 107-mile drive.
//
// The first version of this took the first 5-digit run in the string as the
// zip. In "30443 Sunrose Place, Canyon Country, 91387" that is the HOUSE
// NUMBER, so it looked up "30443" on its own, matched a house number in
// Minnesota, and priced the trip at 1,879 miles - a $1,829 travel fee on a
// Santa Clarita party. Two rules came out of that:
//   1. The zip is the LAST 5-digit run, it must look like a California zip,
//      and it may not be the token the address starts with.
//   2. A bare number is never sent to the geocoder by itself. It always
//      carries ", CA" so it is read as a postal code rather than a house
//      number somewhere in the country.

const CA_ZIP = /^9[0-6]\d{3}$/

/** The zip in a free-text address, or null when there isn't a credible one. */
export function zipFromAddress(address: string): string | null {
  const matches = [...address.matchAll(/\b(\d{5})(?:-\d{4})?\b/g)]
  const last = matches[matches.length - 1]
  if (!last) return null
  // A leading 5-digit token is the house number, not a zip.
  if (last.index === 0) return null
  return CA_ZIP.test(last[1]) ? last[1] : null
}

/** The city in "…, Canyon Country, CA 91387", or null. */
export function cityFromAddress(address: string): string | null {
  const m = address.match(/([A-Za-z][A-Za-z .'-]{1,30}),\s*(?:CA|California)\b/i)
  return m?.[1]?.trim() ?? null
}

/**
 * Progressively coarser stand-ins for an address, best first. Each one is
 * always anchored to California so nothing can be mistaken for a house number
 * in another state.
 */
export function coarserDestinations(address: string): string[] {
  const zip = zipFromAddress(address)
  const city = cityFromAddress(address)
  const out: string[] = []
  if (city && zip) out.push(`${city}, CA ${zip}`)
  if (city) out.push(`${city}, CA`)
  if (zip) out.push(`${zip}, CA`)
  const seen = new Set<string>()
  return out.filter((c) => {
    const key = c.toLowerCase()
    if (key === address.trim().toLowerCase() || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// We serve Southern California. A result past this is a bad geocode, not a
// booking - say we'll confirm travel instead of quoting a four-figure fee.
export const MAX_PLAUSIBLE_MILES = 300
