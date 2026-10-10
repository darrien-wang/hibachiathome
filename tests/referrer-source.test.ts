import assert from "node:assert/strict"
import { test } from "node:test"

import { referrerSource } from "../lib/tracking"

test("search engines become <engine> + organic", () => {
  assert.deepEqual(referrerSource("https://www.google.com/"), { source: "google", medium: "organic" })
  assert.deepEqual(referrerSource("https://www.google.co.uk/"), { source: "google", medium: "organic" })
  assert.deepEqual(referrerSource("https://www.bing.com/search?q=hibachi"), { source: "bing", medium: "organic" })
  assert.deepEqual(referrerSource("https://duckduckgo.com/"), { source: "duckduckgo", medium: "organic" })
  assert.deepEqual(referrerSource("https://search.yahoo.com/"), { source: "yahoo", medium: "organic" })
})

test("other sites become <host> + referral", () => {
  assert.deepEqual(referrerSource("https://chatgpt.com/"), { source: "chatgpt.com", medium: "referral" })
  assert.deepEqual(referrerSource("https://l.facebook.com/l.php?u=x"), { source: "l.facebook.com", medium: "referral" })
  assert.deepEqual(referrerSource("https://www.yelp.com/biz/real-hibachi"), { source: "yelp.com", medium: "referral" })
  // Gemini is an AI answer, not Google search.
  assert.deepEqual(referrerSource("https://gemini.google.com/"), { source: "gemini.google.com", medium: "referral" })
})

test("our own pages, Stripe's checkout and junk are not a source", () => {
  assert.equal(referrerSource("https://www.realhibachi.com/quote"), null)
  assert.equal(referrerSource("https://party.realhibachi.com/order"), null)
  assert.equal(referrerSource("https://checkout.stripe.com/c/pay/cs_live_x"), null)
  assert.equal(referrerSource(""), null)
  assert.equal(referrerSource("not a url"), null)
})
