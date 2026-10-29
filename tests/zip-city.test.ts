import { test } from "node:test"
import assert from "node:assert/strict"
import { cityForZip } from "../lib/zip-city"
import { zipDestination } from "../lib/base-drive"

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
  // "90202" alone geocoded 882 miles away: an $832 travel fee for Bell (2026-10-29)
  assert.equal(zipDestination("90202"), "Bell, CA 90202")
  assert.equal(zipDestination(" 90707 "), "Bellflower, CA 90707")
  assert.equal(zipDestination("99999"), "99999, CA")
})
