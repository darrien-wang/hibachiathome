import { test } from "node:test"
import assert from "node:assert/strict"
import { cityForZip } from "../lib/zip-city"
import { zipDestinations } from "../lib/base-drive"

test("a bare CA ZIP becomes its town", () => {
  assert.equal(cityForZip("92201"), "Indio")
  assert.equal(cityForZip(" 92201-1234 "), "Indio")
  assert.equal(cityForZip("91744"), "La Puente")
})

test("anything else gives nothing", () => {
  assert.equal(cityForZip("Palm Springs"), "")
  assert.equal(cityForZip("99999"), "")
  assert.equal(cityForZip("9220"), "")
  assert.equal(cityForZip(null), "")
})

test("a bare ZIP never goes to the router on its own", () => {
  // "90202" alone geocoded 882 miles away: an $832 travel fee for Bell (2026-10-29).
  // The ZIP's own area first, then the town for PO-box ZIPs the map lacks.
  assert.deepEqual(zipDestinations("90202"), ["90202, CA", "Bell, CA"])
  assert.deepEqual(zipDestinations(" 90707 "), ["90707, CA", "Bellflower, CA"])
  assert.deepEqual(zipDestinations("92109"), ["92109, CA", "San Diego, CA"])
  assert.deepEqual(zipDestinations("99999"), ["99999, CA"])
})
