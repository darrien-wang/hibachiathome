import test from "node:test"
import assert from "node:assert/strict"
import { adCityName } from "../config/ad-city-names"

test("ad city names: LA Cities groups map utm_content to the city the ad named", () => {
  assert.equal(adCityName("downey"), "Downey")
  assert.equal(adCityName("rancho_cucamonga"), "Rancho Cucamonga")
  assert.equal(adCityName("long_beach"), "Long Beach")
  assert.equal(adCityName(" Long_Beach "), "Long Beach")
})

test("ad city names: sitelinks, other campaigns and junk fall through to the loc lookup", () => {
  assert.equal(adCityName("cities_sl_menu"), null)
  assert.equal(adCityName("A_show"), null)
  assert.equal(adCityName("__proto__"), null)
  assert.equal(adCityName(""), null)
  assert.equal(adCityName(null), null)
  assert.equal(adCityName(undefined), null)
})
