import { test } from "node:test"
import assert from "node:assert/strict"
import { cityForZip } from "../lib/zip-city"

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
