// The address picked out of a customer's text (lib/address-detect.ts). 2026-10-08:
// "add the $110 for the place setting" became a booked customer's city.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { extractStreetAddress } from "../lib/address-detect"

test("address · real addresses customers sent are still found", () => {
  assert.equal(extractStreetAddress("1610 Elmsford Ave La Habra Ca 90631"), "1610 Elmsford Ave La Habra Ca 90631")
  assert.equal(extractStreetAddress("8050 Stargate, Yucca Valley, CA 92284"), "8050 Stargate, Yucca Valley, CA 92284")
  assert.match(extractStreetAddress("5556 Myrtle Ave Long Beach CA") ?? "", /^5556 Myrtle Ave/)
  assert.match(extractStreetAddress("It's at 7392 Bradley Dr, Buena Park 90620 - thanks!") ?? "", /^7392 Bradley Dr/)
  assert.match(extractStreetAddress("1900 Avenue of the Stars, Los Angeles, CA 90067") ?? "", /^1900 Avenue of the Stars/)
})

test("address · prices, headcounts and durations are not addresses", () => {
  assert.equal(extractStreetAddress("Can you please update your quote to add the $110 for the place setting"), null)
  assert.equal(extractStreetAddress("We have 20 people in the backyard way out back"), null)
  assert.equal(extractStreetAddress("2 proteins per guest please"), null)
  assert.equal(extractStreetAddress("90 minutes of cooking and the show on the patio drive"), null)
})

test("address · a price earlier in the text does not hide a real address after it", () => {
  assert.match(extractStreetAddress("The $599 works. Address is 278 Calle Luna Dr, Walnut CA 91789") ?? "", /^278 Calle Luna Dr/)
})
