// Layer-1 self-test: the party address in the order's form, "street, City, CA
// zip" (lib/address-standard.ts), from what customers actually typed on the
// deposit page. Census and Nominatim are faked by URL - no network.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { splitUnit, standardizeAddress, tidyStreet, type AddressFetch } from "../lib/address-standard"

type Osm = { house_number?: string; road: string; city?: string; town?: string; state?: string; postcode: string }

/** A fake of the two services: Census answers by full query, Nominatim by search text. */
function services(census: Record<string, string>, osm: Record<string, Osm[]> = {}) {
  const asked: string[] = []
  const fetchImpl: AddressFetch = async (url) => {
    const u = new URL(url)
    if (u.host === "geocoding.geo.census.gov") {
      const q = u.searchParams.get("address") ?? ""
      asked.push(`census:${q}`)
      const hit = census[q]
      return new Response(JSON.stringify({ result: { addressMatches: hit ? [{ matchedAddress: hit }] : [] } }))
    }
    if (u.host === "nominatim.openstreetmap.org") {
      const q = u.searchParams.get("q") ?? ""
      asked.push(`osm:${q}:${u.searchParams.get("bounded")}`)
      const rows = (osm[q] ?? []).map((a) => ({ address: { state: "California", ...a } }))
      return new Response(JSON.stringify(rows))
    }
    throw new Error(`unexpected ${url}`)
  }
  return { fetchImpl, asked }
}

const down: AddressFetch = async () => {
  throw new Error("offline")
}

test("a bare street line gets the town it was quoted for (RH-20261022-0063: '210 Georgina Avenue')", async () => {
  const s = services({ "210 Georgina Avenue, Santa Monica, CA": "210 GEORGINA AVE, SANTA MONICA, CA, 90402" })
  const r = await standardizeAddress("210 Georgina Avenue", { cityHint: "Santa Monica", fetchImpl: s.fetchImpl })
  assert.equal(r?.address, "210 Georgina Ave, Santa Monica, CA 90402")
  assert.equal(r?.zip, "90402")
  assert.equal(r?.city, "Santa Monica")
  assert.equal(r?.via, "census")
})

test("a bare street line with no town: OpenStreetMap places it when Southern California has only one", async () => {
  const s = services(
    { "210 Georgina Avenue, Santa Monica, CA": "210 GEORGINA AVE, SANTA MONICA, CA, 90402" },
    { "210 Georgina Avenue": [{ house_number: "210", road: "Georgina Avenue", city: "Santa Monica", postcode: "90402" }] },
  )
  const r = await standardizeAddress("210 Georgina Avenue", { fetchImpl: s.fetchImpl })
  assert.equal(r?.address, "210 Georgina Ave, Santa Monica, CA 90402")
  assert.ok(s.asked.includes("osm:210 Georgina Avenue:1"), "Southern California first, bounded")
})

test("a street several towns share, with nothing to choose between them, is not guessed", async () => {
  const s = services({}, {
    "123 Main St": [
      { house_number: "123", road: "Main Street", city: "Santa Monica", postcode: "90405" },
      { house_number: "123", road: "Main Street", city: "Alhambra", postcode: "91801" },
      { house_number: "123", road: "Main Street", city: "Huntington Beach", postcode: "92648" },
    ],
  })
  assert.equal(await standardizeAddress("123 Main St", { fetchImpl: s.fetchImpl }), null)
  // ...but the quoted town settles it.
  const hinted = await standardizeAddress("123 Main St", { cityHint: "Alhambra", fetchImpl: s.fetchImpl })
  assert.equal(hinted?.address, "123 Main St, Alhambra, CA 91801")
  assert.equal(hinted?.via, "osm")
})

test("a full address without commas is read by the Census (RH-20261022-5789)", async () => {
  const s = services({ "44528 17th street west Lancaster CA 93534": "44528 17TH ST W, LANCASTER, CA, 93534" })
  const r = await standardizeAddress("44528 17th street west Lancaster CA 93534", { fetchImpl: s.fetchImpl })
  assert.equal(r?.address, "44528 17th St W, Lancaster, CA 93534")
})

test("a trailing ', USA' is dropped and the Census form kept (RH-20261022-7105)", async () => {
  const s = services({ "22400 Henry Rd, Desert Hot Springs, CA 92241": "22400 HENRY RD, DESERT HOT SPRINGS, CA, 92241" })
  const r = await standardizeAddress("22400 Henry Rd, Desert Hot Springs, CA 92241, USA", { cityHint: "Palm Springs", fetchImpl: s.fetchImpl })
  assert.equal(r?.address, "22400 Henry Rd, Desert Hot Springs, CA 92241")
})

test("the city is the USPS name for the ZIP, not the Census's place name", async () => {
  const s = services({ "22000 Ventura Blvd, Los Angeles, CA": "22000 VENTURA BLVD, LOS ANGELES, CA, 91364" })
  const r = await standardizeAddress("22000 Ventura Blvd, Los Angeles", { fetchImpl: s.fetchImpl })
  assert.equal(r?.address, "22000 Ventura Blvd, Woodland Hills, CA 91364")
})

test("the apartment or unit the customer typed is kept - the Census drops it, the chef needs it", async () => {
  const s = services({ "600 Landor Ln, Pasadena, CA": "600 LANDOR LN, PASADENA, CA, 91106" })
  const r = await standardizeAddress("600 Landor Ln Apt 5, Pasadena, CA", { fetchImpl: s.fetchImpl })
  assert.equal(r?.address, "600 Landor Ln Apt 5, Pasadena, CA 91106")
  assert.deepEqual(splitUnit("12 Oak St #3B, Irvine, CA 92618"), { rest: "12 Oak St, Irvine, CA 92618", unit: "#3B" })
  assert.deepEqual(splitUnit("9 Pine Rd unit b Corona CA 92882"), { rest: "9 Pine Rd Corona CA 92882", unit: "Unit B" })
  assert.deepEqual(splitUnit("41 Lotus Ave, Irvine"), { rest: "41 Lotus Ave, Irvine", unit: null })
  assert.deepEqual(splitUnit("41 Unit Rd, Irvine"), { rest: "41 Unit Rd, Irvine", unit: null })
})

test("with every service down, an address that carries its ZIP is still put in form from what was typed", async () => {
  const r = await standardizeAddress("8050 stargate, yucca valley, ca 92284", { fetchImpl: down })
  assert.equal(r?.address, "8050 Stargate, Yucca Valley, CA 92284")
  assert.equal(r?.via, "typed")
  const noCommas = await standardizeAddress("44528 17th street west Lancaster CA 93534", { fetchImpl: down })
  assert.equal(noCommas?.address, "44528 17th St W, Lancaster, CA 93534")
  // No ZIP and nobody to ask: left as typed (null), never invented.
  assert.equal(await standardizeAddress("210 Georgina Avenue", { cityHint: "Santa Monica", fetchImpl: down }), null)
})

test("nothing to standardize without a house number; a Census match outside California is refused", async () => {
  const s = services({ "500 Main St, Springfield, CA": "500 MAIN ST, SPRINGFIELD, IL, 62701" })
  assert.equal(await standardizeAddress("Palm Springs", { fetchImpl: s.fetchImpl }), null)
  assert.equal(await standardizeAddress("LA & Orange County", { fetchImpl: s.fetchImpl }), null)
  assert.equal(await standardizeAddress("TBD", { fetchImpl: s.fetchImpl }), null)
  assert.equal(await standardizeAddress("500 Main St, Springfield", { fetchImpl: s.fetchImpl }), null)
})

test("tidyStreet: the street line the way Google and USPS print it", () => {
  assert.equal(tidyStreet("44528 17th street west"), "44528 17th St W")
  assert.equal(tidyStreet("210 georgina avenue"), "210 Georgina Ave")
  assert.equal(tidyStreet("1 N. Coast Highway"), "1 N Coast Hwy")
})
