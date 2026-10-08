import assert from "node:assert/strict"
import { test } from "node:test"

import {
  instantToWallIso,
  partyContactFirstText,
  partyContactSecondText,
  partyContactStage,
  ptDate,
  quoteFollowUpPlan,
  shortDate,
  wallTime,
  wallToInstant,
} from "../lib/first-response"

// ---- wall clock stored as UTC ------------------------------------------------

test("wallToInstant: 6:30 PM PDT wall time is 01:30Z the next day", () => {
  assert.equal(new Date(wallToInstant("2026-10-10T18:30:00+00:00")).toISOString(), "2026-10-11T01:30:00.000Z")
})

test("wallToInstant: PST (after the November change) uses the -8 offset", () => {
  assert.equal(new Date(wallToInstant("2026-12-05T18:00:00+00:00")).toISOString(), "2026-12-06T02:00:00.000Z")
})

test("instantToWallIso round-trips", () => {
  const wall = "2026-10-17T18:00:00.000Z"
  assert.equal(instantToWallIso(wallToInstant(wall)), wall)
})

test("ptDate: 11 PM PDT is still the same PT day", () => {
  // 2026-10-10 23:00 PDT = 2026-10-11 06:00Z
  assert.equal(ptDate(Date.parse("2026-10-11T06:00:00Z")), "2026-10-10")
})

test("shortDate / wallTime formatting", () => {
  assert.equal(shortDate("2026-10-17"), "Sat, Oct 17")
  assert.equal(shortDate("2026-10-18"), "Sun, Oct 18")
  assert.equal(wallTime("2026-10-18T18:00:00+00:00"), "6 PM")
  assert.equal(wallTime("2026-10-10T18:30:00+00:00"), "6:30 PM")
  assert.equal(wallTime("2026-10-10T11:00:00+00:00"), "11 AM")
  assert.equal(wallTime("2026-10-10T12:00:00+00:00"), "12 PM")
})

// ---- template B -----------------------------------------------------------------

const today = "2026-10-07"

test("template B, dated: the date is open + what's the celebration (D-1008-02)", () => {
  const plan = quoteFollowUpPlan({ adults: 12, kids: 3, eventDate: "2026-10-18", city: "Palm Springs", todayPt: today })
  assert.ok(plan.send)
  assert.equal(plan.text, "Hi! Bling from Real Hibachi 👋 Sun, Oct 18 is open on our end for your 15 in Palm Springs — what's the celebration?")
  assert.equal(plan.dated, true)
})

test("template B, no date: asks the occasion, never the date or the start time", () => {
  const plan = quoteFollowUpPlan({ adults: 10, kids: 0, eventDate: null, city: "Temecula", todayPt: today })
  assert.ok(plan.send)
  assert.equal(plan.text, "Hi! Bling from Real Hibachi 👋 10 in Temecula — what's the celebration?")
  assert.equal(plan.dated, false)
  assert.doesNotMatch(plan.text, /which date|4 PM|7 PM/)
})

test("template B: ZIPs, region labels and missing cities fall back to the plain line", () => {
  const plain = "Hi! Bling from Real Hibachi 👋 Saw your quote for 15 — what's the celebration?"
  for (const city of [null, "", "92270", "LA & Orange County", "Southern California"]) {
    const plan = quoteFollowUpPlan({ adults: 15, kids: 0, city, todayPt: today })
    assert.ok(plan.send)
    assert.equal(plan.text, plain, String(city))
  }
  const lower = quoteFollowUpPlan({ adults: 10, kids: 0, city: "irvine", todayPt: today })
  assert.ok(lower.send)
  assert.equal(lower.text, "Hi! Bling from Real Hibachi 👋 10 in Irvine — what's the celebration?")
})

test("template B hands edge cases to a person", () => {
  assert.deepEqual(quoteFollowUpPlan({ adults: 0, kids: 0, todayPt: today }), { send: false, reason: "no_guests" })
  assert.deepEqual(quoteFollowUpPlan({ adults: 70, kids: 0, eventDate: "2026-12-05", todayPt: today }), { send: false, reason: "large_party" })
  assert.deepEqual(quoteFollowUpPlan({ adults: 10, kids: 0, eventDate: "2026-10-06", todayPt: today }), { send: false, reason: "date_past" })
  assert.deepEqual(quoteFollowUpPlan({ adults: 10, kids: 0, eventDate: "2026-10-08", todayPt: today }), { send: false, reason: "date_within_48h" })
  // Two days out is fine (the free-change window is still open).
  assert.ok(quoteFollowUpPlan({ adults: 10, kids: 0, eventDate: "2026-10-09", todayPt: today }).send)
  // 60 adults is the top of the engine's ladder and stays automatic.
  assert.ok(quoteFollowUpPlan({ adults: 60, kids: 0, eventDate: "2026-11-01", todayPt: today }).send)
})

// ---- pre-party contact ------------------------------------------------------------

test("first party-contact text: name, day, wall time, street only", () => {
  const text = partyContactFirstText({
    customerName: "Ellen  Vallee",
    eventStart: "2026-10-10T18:30:00+00:00",
    address: "452 North Monterey Road, Palm Springs, CA 92262",
    now: Date.parse("2026-10-07T20:00:00Z"),
  })
  assert.equal(text, "Hi Ellen, Bling from Real Hibachi 👋 Your hibachi party is Sat, Oct 10 at 6:30 PM at 452 North Monterey Road. Reply YES if everything's still set, or let me know if anything's changed.")
})

test("first party-contact text without a usable name or address", () => {
  const text = partyContactFirstText({ customerName: "+1 (310) 555-0100", eventStart: "2026-10-11T17:00:00+00:00", address: "", now: 0 })
  assert.equal(text, "Hi, Bling from Real Hibachi 👋 Your hibachi party is Sun, Oct 11 at 5 PM. Reply YES if everything's still set, or let me know if anything's changed.")
})

test("second text says tomorrow or today by the PT calendar", () => {
  const base = { customerName: "Carlos Maldonado", eventStart: "2026-10-13T18:30:00+00:00", address: "5556 Myrtle Ave, Long Beach, CA 90805" }
  // Oct 12, 7 PM PDT = Oct 13 02:00Z
  assert.equal(
    partyContactSecondText({ ...base, now: Date.parse("2026-10-13T02:00:00Z") }),
    "Hi Carlos, Bling here - just making sure we're all set for tomorrow at 6:30 PM at 5556 Myrtle Ave. Could you reply so I know you got this? 🙏",
  )
  // Oct 13, 8 AM PDT = 15:00Z
  assert.match(partyContactSecondText({ ...base, now: Date.parse("2026-10-13T15:00:00Z") }), /set for today at 6:30 PM/)
})

test("partyContactStage ladder", () => {
  const s = (hoursLeft: number, sentFirst = false, sentSecond = false, reached = false) => partyContactStage({ hoursLeft, sentFirst, sentSecond, reached })
  assert.equal(s(100), "wait")
  assert.equal(s(72), "first_text")
  assert.equal(s(60), "first_text")
  assert.equal(s(60, true), "wait")
  assert.equal(s(47, true), "flag_48h")
  assert.equal(s(23, true), "urgent_24h")
  assert.equal(s(23, true, true), "urgent_24h")
  assert.equal(s(23, true, true, true), "wait")
  assert.equal(s(-1, true), "past")
  // Reached customers are never texted, whatever the clock says.
  assert.equal(s(50, false, false, true), "wait")
})
