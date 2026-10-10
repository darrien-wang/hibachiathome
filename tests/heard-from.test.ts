// Layer-2 self-test: "how did you find us?" for leads the system can't place (lib/heard-from.ts, 2026-10-10).
// Only organic_direct leads are asked, only after they book, only once; platform inquiries are
// placed by the sender's domain; answers land in a bucket the weekly report can count.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { ASKS_SOURCE, SOURCE_QUESTION, classifyHeard, partyStage, platformOf, platformOfText, sourceAsk } from "../lib/heard-from"

test("heard · our question is recognised in a sent text, however it's worded", () => {
  assert.equal(ASKS_SOURCE.test(`Got it, thank you! ${SOURCE_QUESTION}`), true)
  assert.equal(ASKS_SOURCE.test("Perfect - see you Saturday! How'd you hear about us, by the way?"), true)
  assert.equal(ASKS_SOURCE.test("Did you find the parking ok?"), false)
  assert.equal(ASKS_SOURCE.test("Let us know if you find a better date"), false)
})

test("heard · answers land in the right bucket", () => {
  assert.equal(classifyHeard("Google"), "google")
  assert.equal(classifyHeard("just searched hibachi at home"), "google")
  assert.equal(classifyHeard("Found you on google maps"), "google_maps")
  assert.equal(classifyHeard("your Google reviews"), "google_maps")
  assert.equal(classifyHeard("Yelp!"), "yelp")
  assert.equal(classifyHeard("IG"), "instagram")
  assert.equal(classifyHeard("Facebook marketplace"), "facebook")
  assert.equal(classifyHeard("saw a tiktok"), "tiktok")
  assert.equal(classifyHeard("ChatGPT recommended you"), "ai_assistant")
  assert.equal(classifyHeard("The Knot"), "platform")
  assert.equal(classifyHeard("My friend had you at her party"), "party_guest")
  assert.equal(classifyHeard("saw you at my cousin's birthday"), "party_guest")
  assert.equal(classifyHeard("We used you last year!"), "returning")
  assert.equal(classifyHeard("my coworker recommended you"), "friend")
  assert.equal(classifyHeard("A friend"), "friend")
  assert.equal(classifyHeard("saw your truck at the park"), "vehicle")
  assert.equal(classifyHeard("not sure honestly"), "other")
})

test("heard · platform inquiries are placed by the sender's domain", () => {
  assert.equal(platformOf("mitchell.norman.2108117@member.theknot.com"), "the_knot")
  assert.equal(platformOf("someone@member.weddingwire.com"), "weddingwire")
  assert.equal(platformOf("inquiries@zola.com"), "zola")
  assert.equal(platformOf("jane@gmail.com"), null)
  assert.equal(platformOf(""), null)
})

test("heard · a platform's notification text on the 213 line is the platform, a customer naming it is not", () => {
  assert.equal(platformOfText("Zola: New Zola inquiry for Real Hibachi from Taegan M and Taegan M. See details and reply here https://zola.com/z/L2GV7T"), "zola")
  assert.equal(platformOfText("The Knot: You have a new message from Mitchell"), "the_knot")
  assert.equal(platformOfText("Hi! I found you on Zola, are you free June 19?"), null)
  assert.equal(platformOfText("Hello"), null)
})

test("heard · ask only unknown leads, only after booking, only once", () => {
  assert.equal(sourceAsk({ channel: "google_ads", stage: "booked" }), "known")
  assert.equal(sourceAsk({ channel: "marketplace_referral", stage: "booked" }), "known")
  assert.equal(sourceAsk({ channel: "organic_direct", stage: "not_booked" }), "after_booking")
  assert.equal(sourceAsk({ channel: "organic_direct", stage: "booked" }), "ask_now")
  assert.equal(sourceAsk({ channel: "organic_direct", stage: "booked", heardAskedAt: "2026-10-10T18:00:00Z" }), "asked")
  assert.equal(sourceAsk({ channel: "organic_direct", stage: "booked", heardAskedAt: "2026-10-10T18:00:00Z", heardChannel: "google" }), "answered")
  // A view that could not be read is treated as unknown, not as known.
  assert.equal(sourceAsk({ channel: null, stage: "booked" }), "ask_now")
  // Not on the party day. After their own party it's fine (review asks are the chef's job since
  // 10-10, so a thank-you text from them is a free moment); a returning customer is never asked.
  assert.equal(sourceAsk({ channel: "organic_direct", stage: "party_day" }), "party_day")
  assert.equal(sourceAsk({ channel: "organic_direct", stage: "after_party" }), "ask_now")
  assert.equal(sourceAsk({ channel: "organic_direct", stage: "returning" }), "returning")
})

test("heard · party stage from the contact's orders, by wall date in PT", () => {
  const today = "2026-10-10"
  const lead = "2026-09-20"
  assert.equal(partyStage([], today, lead), "not_booked")
  assert.equal(partyStage([{ order_status: "active", event_start: "2026-11-15T19:00:00+00:00" }], today, lead), "booked")
  assert.equal(partyStage([{ order_status: "active", event_start: null }], today, lead), "booked") // date on hold
  assert.equal(partyStage([{ order_status: "active", event_start: "2026-10-10T19:00:00+00:00" }], today, lead), "party_day")
  assert.equal(partyStage([{ order_status: "active", event_start: "2026-10-09T19:00:00+00:00" }], today, lead), "after_party")
  // A party before this lead came in = they came back.
  assert.equal(partyStage([{ event_start: "2026-06-01T18:00:00+00:00" }, { event_start: "2026-12-01T18:00:00+00:00" }], today, lead), "returning")
  assert.equal(partyStage([{ order_status: "cancelled", event_start: "2026-06-01T18:00:00+00:00" }], today, lead), "not_booked")
})
