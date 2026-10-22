import zipCity from "./data/ca-zip-city.json"

// ============================================================
// The party address in the form the order keeps: "street, City, CA zip"
// ============================================================
// What a customer types on the deposit page is whatever they had in mind:
// "210 Georgina Avenue" (no city, no zip - the dispatch day map could not
// place it, RH-20261022-0063), "44528 17th street west Lancaster CA 93534",
// "22400 Henry Rd, Desert Hot Springs, CA 92241, USA". The order, the chef's
// sheet, the day map and the travel measurement all want one shape:
// "210 Georgina Ave, Santa Monica, CA 90402".
//
// Same recipe as the invoice app's address autocomplete (its
// lib/format-address.ts and /api/address-suggest), server-side here:
//   1. The US Census geocoder standardizes a full address to USPS form with
//      the right ZIP - but it cannot search, so it needs the city or ZIP.
//   2. A bare street line gets the city the customer was quoted for first,
//      then Nominatim (OpenStreetMap) proposes where in Southern California
//      it is. Several towns with that street and nothing to choose between
//      them is a question for the customer, not a guess.
//   3. City names come from the USPS table for the ZIP (lib/data/
//      ca-zip-city.json): what Google prints and what envelopes say -
//      "Woodland Hills", not the Census's "Los Angeles".
// An apartment or unit the customer typed is kept: the Census drops it, the
// chef still needs it.

const CA_ZIPS = zipCity as Record<string, string>

const CENSUS_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress"
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
const USER_AGENT = "RealHibachi-Marketing/1.0 (support@realhibachi.com)"
// Where we serve. Searched first, bounded, so a street line cannot land in
// another state's town of the same name.
const SOCAL_VIEWBOX = "-119.6,34.9,-116.0,32.4"

export type StandardAddress = {
  /** "210 Georgina Ave, Santa Monica, CA 90402" */
  address: string
  street: string
  city: string
  zip: string
  /** Who vouched for it: the Census match, OpenStreetMap, or the customer's own city + ZIP. */
  via: "census" | "osm" | "typed"
}

export type AddressFetch = (url: string, init?: RequestInit) => Promise<Response>

const STREET_ABBREV: Record<string, string> = {
  Drive: "Dr",
  Street: "St",
  Avenue: "Ave",
  Boulevard: "Blvd",
  Road: "Rd",
  Lane: "Ln",
  Court: "Ct",
  Place: "Pl",
  Highway: "Hwy",
  Parkway: "Pkwy",
  Circle: "Cir",
  Terrace: "Ter",
  Trail: "Trl",
  Square: "Sq",
  North: "N",
  South: "S",
  East: "E",
  West: "W",
  Northeast: "NE",
  Northwest: "NW",
  Southeast: "SE",
  Southwest: "SW",
}

const KEEP_UPPER = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW", "US", "CA", "PO"])

/** "LANDOR LN" -> "Landor Ln"; "17th street west" -> "17th Street West"; "1ST ST" -> "1st St". */
function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => {
      const up = w.toUpperCase()
      if (KEEP_UPPER.has(up)) return up
      if (/^\d+(st|nd|rd|th)$/.test(w)) return w
      return w.replace(/(^|['-])([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase())
    })
    .join(" ")
}

/** USPS-style street line: "44528 17th street west" -> "44528 17th St W". */
export function tidyStreet(street: string): string {
  return titleCase(street.replace(/\./g, "").replace(/\s+/g, " ").trim())
    .split(" ")
    .map((w) => STREET_ABBREV[w] ?? w)
    .join(" ")
}

export function uspsCityForZip(zip: string | null | undefined): string | null {
  const key = (zip ?? "").trim().slice(0, 5)
  return /^\d{5}$/.test(key) ? (CA_ZIPS[key] ?? null) : null
}

// "#5", "Apt 5A", "Unit B", "Ste. 200", "Space 12" - a number, or a single
// letter, after the word, so "Lotus Ave" or "Unit Rd" are left alone.
const UNIT_RE =
  /[\s,]+(#\s*[A-Za-z0-9-]+|(?:apt|apartment|unit|ste|suite|spc|space|lot|bldg|building)\b\.?\s*#?\s*(?:\d[A-Za-z0-9-]*|[A-Za-z]\d*)(?![A-Za-z]))(?=\s*(?:,|$|\s+[A-Za-z0-9]))/i

/** The apartment / unit the customer typed, tidied ("apt 5" -> "Apt 5"), and the address without it. */
export function splitUnit(address: string): { rest: string; unit: string | null } {
  const m = UNIT_RE.exec(address)
  if (!m || m.index === undefined) return { rest: address, unit: null }
  const raw = m[1].replace(/\s+/g, " ").trim()
  const unit = raw.startsWith("#")
    ? `#${raw.slice(1).trim().toUpperCase()}`
    : raw.replace(/^([a-z]+)\.?\s*#?\s*(.+)$/i, (_m, word: string, id: string) => `${word[0].toUpperCase()}${word.slice(1).toLowerCase()} ${id.toUpperCase()}`)
  const rest = (address.slice(0, m.index) + address.slice(m.index + m[0].length)).replace(/\s+,/g, ",").replace(/\s+/g, " ").trim()
  return { rest, unit }
}

/** Whitespace, trailing country, stray punctuation. */
function tidyTyped(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/[,\s]+(?:USA|U\.S\.A\.?|United States(?: of America)?|US)\s*$/i, "")
    .replace(/[\s,.;]+$/, "")
    .trim()
}

/** A house number up front: the only kind of address there is something to standardize in. */
export function hasHouseNumber(address: string): boolean {
  return /^\d+[a-z]?(?:-\d+)?\s+\S/i.test(address.trim())
}

/** The last credible CA ZIP in the text (never the house number). */
function zipIn(address: string): string | null {
  const all = [...address.matchAll(/\b(9[0-6]\d{3})(?:-\d{4})?\b/g)]
  const last = all[all.length - 1]
  if (!last || last.index === 0) return null
  return last[1]
}

async function fetchJson(fetchImpl: AddressFetch, url: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  try {
    const res = await fetchImpl(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/** The Census's USPS form of a complete address, in California, or null. */
async function census(query: string, fetchImpl: AddressFetch): Promise<{ street: string; city: string; zip: string } | null> {
  if (!hasHouseNumber(query)) return null
  const params = new URLSearchParams({ address: query, benchmark: "Public_AR_Current", format: "json" })
  const data = (await fetchJson(fetchImpl, `${CENSUS_URL}?${params}`, {}, 4000)) as {
    result?: { addressMatches?: Array<{ matchedAddress?: string }> }
  } | null
  const matched = data?.result?.addressMatches?.[0]?.matchedAddress
  if (!matched) return null
  // "600 LANDOR LN, PASADENA, CA, 91106"
  const parts = matched.split(",").map((p) => p.trim())
  if (parts.length < 4) return null
  const [street, censusCity, state, zip] = parts
  if (state.toUpperCase() !== "CA" || !/^\d{5}/.test(zip)) return null
  const zip5 = zip.slice(0, 5)
  return { street: titleCase(street), city: uspsCityForZip(zip5) ?? titleCase(censusCity), zip: zip5 }
}

type OsmRow = { address?: Record<string, string | undefined> }
type OsmPlace = { house: string; road: string; city: string; zip: string; localities: string[] }

async function nominatim(query: string, bounded: boolean, fetchImpl: AddressFetch): Promise<OsmPlace[]> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    addressdetails: "1",
    limit: "5",
    countrycodes: "us",
    viewbox: SOCAL_VIEWBOX,
    bounded: bounded ? "1" : "0",
  })
  const rows = (await fetchJson(fetchImpl, `${NOMINATIM_URL}?${params}`, { headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" } }, 5000)) as OsmRow[] | null
  const out: OsmPlace[] = []
  for (const row of Array.isArray(rows) ? rows : []) {
    const a = row.address ?? {}
    if ((a.state ?? "").trim() !== "California") continue
    const zip = (a.postcode ?? "").trim().slice(0, 5)
    const localities = [a.city, a.town, a.village, a.municipality, a.hamlet, a.suburb, a.neighbourhood]
      .map((v) => (v ?? "").trim())
      .filter(Boolean)
    const city = uspsCityForZip(zip) ?? localities[0] ?? ""
    const road = (a.road ?? a.pedestrian ?? "").trim()
    if (!road || !city || !/^\d{5}$/.test(zip)) continue
    out.push({ house: (a.house_number ?? "").trim(), road, city, zip, localities })
  }
  return out
}

const sameCity = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

function finish(street: string, city: string, zip: string, unit: string | null, via: StandardAddress["via"]): StandardAddress {
  const line = unit ? `${street} ${unit}` : street
  return { address: `${line}, ${city}, CA ${zip}`, street: line, city, zip, via }
}

/**
 * "street, City, CA zip" for what the customer typed, or null when it cannot
 * be pinned down (no house number, nothing found, or a street several towns
 * share with nothing to choose between them). Never throws.
 */
export async function standardizeAddress(
  raw: string | null | undefined,
  opts: { cityHint?: string | null; fetchImpl?: AddressFetch } = {},
): Promise<StandardAddress | null> {
  const fetchImpl: AddressFetch = opts.fetchImpl ?? ((url, init) => fetch(url, init))
  const typed = tidyTyped(raw ?? "")
  if (!hasHouseNumber(typed)) return null
  const { rest, unit } = splitUnit(typed)
  const typedZip = zipIn(rest)
  const typedZipCity = uspsCityForZip(typedZip)
  // The city, when commas say where it is: "…, Santa Monica" / "…, Indio, CA
  // 92201". Without commas there is no telling it from the street name.
  const parts = rest.split(",").map((p) => p.trim())
  const cityPart = parts.length >= 2 ? parts[1].replace(/\b(?:CA|California)\b/gi, "").replace(/\d{5}(?:-\d{4})?/g, "").trim() : ""
  const typedCity = /^[A-Za-z][A-Za-z .'-]{1,30}$/.test(cityPart) ? cityPart : null
  const bareStreet = !typedZip && !typedCity && parts.length < 2
  const hint = (opts.cityHint ?? "").trim()
  // "Santa Monica" keeps its "ca": only a separate CA / California word goes.
  const hintCity = hint && !/\d/.test(hint) ? hint.replace(/(?:,\s*|\s+)(?:CA|California)\.?\s*$/i, "").trim() : uspsCityForZip(hint) ?? ""

  // 1. The Census, as typed - enough whenever the city or ZIP is in there.
  if (!bareStreet) {
    const stated = typedZip || /\b(?:CA|California)\b/i.test(rest)
    const c = await census(stated ? rest : `${rest}, CA`, fetchImpl)
    if (c) return finish(c.street, c.city, c.zip, unit, "census")
  }
  // 2. A bare street line, in the town the customer was quoted for.
  if (bareStreet && hintCity) {
    const c = await census(`${rest}, ${hintCity}, CA`, fetchImpl)
    if (c) return finish(c.street, c.city, c.zip, unit, "census")
  }

  // 3. OpenStreetMap: Southern California first, then anywhere in the state.
  let places = await nominatim(rest, true, fetchImpl)
  if (places.length === 0) places = await nominatim(rest, false, fetchImpl)
  const pick = (pred: (p: OsmPlace) => boolean) => places.filter(pred)
  let candidates = places
  if (typedZip) candidates = pick((p) => p.zip === typedZip)
  else if (typedCity) candidates = pick((p) => sameCity(p.city, typedCity) || p.localities.some((l) => sameCity(l, typedCity)))
  else if (hintCity && pick((p) => sameCity(p.city, hintCity)).length > 0) candidates = pick((p) => sameCity(p.city, hintCity))
  const distinct = new Map(candidates.map((p) => [`${p.city.toLowerCase()}|${p.zip}`, p]))
  if (distinct.size === 1) {
    const place = [...distinct.values()][0]
    const house = place.house || /^(\d+[a-z]?)/i.exec(rest)?.[1] || ""
    const c = await census(`${house} ${place.road}, ${place.city}, CA`, fetchImpl)
    if (c) return finish(c.street, c.city, c.zip, unit, "census")
    if (house) return finish(tidyStreet(`${house} ${place.road}`), place.city, place.zip, unit, "osm")
  }

  // 4. Nobody found it, but the customer gave the ZIP: their street, the
  //    USPS town for that ZIP. "8050 Stargate, Yucca Valley, CA 92284" is a
  //    real address no map knows (2026-09-24).
  //    The street is what comes before the first comma, or - with no commas -
  //    before the ZIP's own town name; anything less certain is left as typed.
  if (typedZip && typedZipCity) {
    const at = rest.toLowerCase().lastIndexOf(` ${typedZipCity.toLowerCase()}`)
    const street = parts.length >= 2 ? parts[0] : at > 0 ? rest.slice(0, at) : ""
    if (hasHouseNumber(street)) return finish(tidyStreet(street), typedZipCity, typedZip, unit, "typed")
  }
  return null
}
