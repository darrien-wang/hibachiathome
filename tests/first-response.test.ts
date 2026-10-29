import assert from "node:assert/strict"
import { test } from "node:test"

import {
  instantToWallIso,
  partyContactFirstText,
  partyContactSecondText,
  partyContactStage,
  placeName,
  ptDate,
  quoteFollowUpPlan,
  shortDate,
  spokenDate,
  templateAMessage,
  templateAWording,
  wallTime,
  wallToInstant,
  textSignerFor,
  partyBillDue,
  partyBillText,
  payUrlFor,
} from "../lib/first-response"
import { priceInText, statedHeadcount } from "../lib/caller-card"

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

test("template B, dated: the date is open + what's the celebration (D-1008-02; wording per leads voice.md 2026-10-29)", () => {
  const plan = quoteFollowUpPlan({ adults: 12, kids: 3, eventDate: "2026-10-18", city: "Palm Springs", todayPt: today })
  assert.ok(plan.send)
  assert.equal(plan.text, "Hi, it's Rowling from Real Hibachi. Sunday the 18th is open for the 15 of you in Palm Springs. What's the celebration?")
  assert.equal(plan.dated, true)
  // Beyond two weeks the month is said; never an em dash, a 👋 or "your 15".
  const far = quoteFollowUpPlan({ adults: 30, kids: 0, eventDate: "2027-05-15", city: "San Diego", todayPt: today })
  assert.ok(far.send)
  assert.equal(far.text, "Hi, it's Rowling from Real Hibachi. Saturday, May 15 is open for the 30 of you in San Diego. What's the celebration?")
  assert.doesNotMatch(far.text, /—|👋|your \d/)
})

test("spokenDate: 'Saturday the 18th' inside two weeks, 'Saturday, Oct 18' beyond", () => {
  assert.equal(spokenDate("2026-10-17", "2026-10-07"), "Saturday the 17th")
  assert.equal(spokenDate("2026-10-21", "2026-10-07"), "Wednesday the 21st")
  assert.equal(spokenDate("2026-10-22", "2026-10-09"), "Thursday the 22nd")
  assert.equal(spokenDate("2026-10-23", "2026-10-10"), "Friday the 23rd")
  assert.equal(spokenDate("2026-11-11", "2026-10-30"), "Wednesday the 11th")
  // Day 14 is still "the 21st"; day 15 says the month.
  assert.equal(spokenDate("2026-10-22", "2026-10-07"), "Thursday, Oct 22")
  assert.equal(spokenDate("2027-05-15", "2026-10-07"), "Saturday, May 15")
  assert.equal(spokenDate("nope", "2026-10-07"), "")
})

test("template B, no date: asks the occasion, never the date or the start time", () => {
  const plan = quoteFollowUpPlan({ adults: 10, kids: 0, eventDate: null, city: "Temecula", todayPt: today })
  assert.ok(plan.send)
  assert.equal(plan.text, "Hi, it's Rowling from Real Hibachi. Saw your quote for 10 in Temecula. What's the celebration?")
  assert.equal(plan.dated, false)
  assert.doesNotMatch(plan.text, /which date|4 PM|7 PM/)
})

test("template B on the page's default leave-quote: no count (10-10 the real 13 + 4 arrived the same minute)", () => {
  const plan = quoteFollowUpPlan({ adults: 15, kids: 0, city: "Palm Springs", todayPt: today, numberUnknown: true })
  assert.ok(plan.send)
  assert.equal(plan.text, "Hi, it's Rowling from Real Hibachi. Saw your quote. What's the celebration?")
  assert.doesNotMatch(plan.text, /15/)
})

test("template B: ZIPs, region labels and missing cities fall back to the plain line", () => {
  const plain = "Hi, it's Rowling from Real Hibachi. Saw your quote for 15. What's the celebration?"
  for (const city of [null, "", "92270", "LA & Orange County", "Southern California"]) {
    const plan = quoteFollowUpPlan({ adults: 15, kids: 0, city, todayPt: today })
    assert.ok(plan.send)
    assert.equal(plan.text, plain, String(city))
  }
  const lower = quoteFollowUpPlan({ adults: 10, kids: 0, city: "irvine", todayPt: today })
  assert.ok(lower.send)
  assert.equal(lower.text, "Hi, it's Rowling from Real Hibachi. Saw your quote for 10 in Irvine. What's the celebration?")
})

test("template A says one price when both nights hit the minimum, and no travel promise for a region", () => {
  const daisy = templateAWording({ weekend: "$599.00", weekday: "$599.00", travel: 0, city: "Southern California" })
  assert.equal(daisy.price, "$599.00 any day of the week")
  assert.equal(daisy.where, "")
  assert.equal(daisy.travelSms, ", first 50 miles of travel free")
  assert.match(daisy.travelEmail, /first 50 miles free/)
  const ps = templateAWording({ weekend: "$838.50", weekday: "$763.50", travel: 42, city: "palm springs" })
  assert.equal(ps.price, "$838.50 Fri-Sun or $763.50 Mon-Thu")
  assert.equal(ps.where, " in Palm Springs")
  assert.equal(ps.travelSms, ", plus about $42 travel")
  assert.equal(ps.travelEmail, "- Travel to Palm Springs: about $42")
  const near = templateAWording({ weekend: "$838.50", weekday: "$763.50", travel: 0, city: "Irvine" })
  assert.equal(near.travelSms, ", no travel fee")
})

test("template A says '1 adult' / '1 kid', and that $599 is the 10-guest minimum, not a price a head (2026-10-22)", () => {
  const one = templateAMessage({ adults: 1, kids: 0, cityName: "La Puente", travelFee: 0 })
  assert.equal(
    one.sms,
    "Hi, it's Rowling from Real Hibachi. Our system was supposed to text you a price and didn't, sorry. For 1 adult in La Puente it's $599.00 any day of the week, no travel fee. Each guest gets 2 proteins, fried rice, veggies, salad and the chef show. That's our 10-guest minimum, so it covers up to 10 guests. What date are you thinking?",
  )
  assert.match(one.emailText, /^- 1 adult, Fri-Sun: \$599\.00 total$/m)
  assert.match(one.emailText, /^- That's our 10-guest minimum, so it covers up to 10 guests\.$/m)
  assert.match(templateAMessage({ adults: 1, kids: 1, cityName: "Whittier" }).sms, /For 1 adult \+ 1 kid in Whittier it's \$599\.00/)
  // The caller card reads the party and the price off our texts - 1, not the 10 the minimum covers.
  assert.equal(statedHeadcount(one.sms), 1)
  assert.equal(priceInText(one.sms), 599)
})

test("template A: travel stays its own phrase, and more than 10 on the minimum are all covered", () => {
  const bigBear = templateAMessage({ adults: 4, cityName: "Big Bear Lake", travelFee: 33 })
  assert.match(bigBear.sms, /it's \$599\.00 any day of the week, plus about \$33 travel\. Each guest gets .*\. That's our 10-guest minimum, so it covers up to 10 guests\. What date/)
  assert.match(templateAMessage({ adults: 2, kids: 9, cityName: "Downey" }).sms, /That's our \$599 minimum, which covers all 11 guests\./)
})

test("template A: no note once Fri-Sun clears the minimum (wording per leads voice.md 2026-10-29)", () => {
  assert.equal(
    templateAMessage({ adults: 15, cityName: "Anaheim" }).sms,
    "Hi, it's Rowling from Real Hibachi. Our system was supposed to text you a price and didn't, sorry. For 15 adults in Anaheim it's $838.50 Fri-Sun or $763.50 Mon-Thu, no travel fee. Each guest gets 2 proteins, fried rice, veggies, salad and the chef show. What date are you thinking?",
  )
  assert.doesNotMatch(templateAMessage({ adults: 11, cityName: "Torrance" }).sms, /minimum/, "$628.90 Fri-Sun or $599.00 Mon-Thu")
})

test("template A: the note shows exactly when the price is the minimum on both nights", () => {
  for (let adults = 1; adults <= 20; adults++) {
    for (let kids = 0; kids <= 12; kids++) {
      const sms = templateAMessage({ adults, kids, cityName: "Irvine" }).sms
      assert.equal(/That's our .*minimum/.test(sms), sms.includes("$599.00 any day of the week"), `${adults}+${kids}`)
    }
  }
})

test("placeName capitalizes what the customer typed, and keeps ZIPs and regions out", () => {
  assert.equal(placeName("idyllwild"), "Idyllwild")
  assert.equal(placeName("palm springs"), "Palm Springs")
  assert.equal(placeName("la"), "LA")
  assert.equal(placeName("Rancho Cucamonga"), "Rancho Cucamonga")
  // The quote text falls back to the raw value when there is no town to show.
  assert.equal(placeName("LA & Orange County"), "")
  assert.equal(placeName("92270"), "")
  assert.equal(placeName("southern california"), "")
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
    signer: "Bling",
    customerName: "Ellen  Vallee",
    eventStart: "2026-10-10T18:30:00+00:00",
    address: "452 North Monterey Road, Palm Springs, CA 92262",
    now: Date.parse("2026-10-07T20:00:00Z"),
  })
  assert.equal(text, "Hi Ellen, it's Bling from Real Hibachi. Your party is Saturday the 10th at 6:30 PM at 452 North Monterey Road. Reply YES if everything's still set, or tell me what changed.")
})

test("first party-contact text without a usable name or address", () => {
  const text = partyContactFirstText({ customerName: "+1 (310) 555-0100", eventStart: "2026-10-11T17:00:00+00:00", address: "", now: 0 })
  assert.equal(text, "Hi, it's Rowling from Real Hibachi. Your party is Sunday, Oct 11 at 5 PM. Reply YES if everything's still set, or tell me what changed.")
})

test("second text says tomorrow or today by the PT calendar", () => {
  const base = { customerName: "Carlos Maldonado", eventStart: "2026-10-13T18:30:00+00:00", address: "5556 Myrtle Ave, Long Beach, CA 90805" }
  // Oct 12, 7 PM PDT = Oct 13 02:00Z
  assert.equal(
    partyContactSecondText({ ...base, now: Date.parse("2026-10-13T02:00:00Z") }),
    "Hi Carlos, it's Rowling. Just making sure we're set for tomorrow at 6:30 PM at 5556 Myrtle Ave. Could you reply so I know you got this?",
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

test("text signer · customers who first wrote before 10-09 17:20 PT keep Bling, new ones get Rowling", () => {
  assert.equal(textSignerFor("2026-09-28T19:26:00Z"), "Bling")
  assert.equal(textSignerFor("2026-10-10T00:19:59Z"), "Bling")
  assert.equal(textSignerFor("2026-10-10T00:20:00Z"), "Rowling")
  assert.equal(textSignerFor(null), "Rowling")
  assert.equal(textSignerFor("not a date"), "Rowling")
})

// ---- an hour into the party: the bill text -------------------------------------

test("partyBillDue: from one hour after the start, not before, and not after four hours", () => {
  const start = wallToInstant("2026-10-24T18:00:00+00:00")
  const at = (min: number) => start + min * 60_000
  assert.equal(partyBillDue({ startMs: start, now: at(59), balanceDueCents: 64100, sent: false }), false)
  assert.equal(partyBillDue({ startMs: start, now: at(60), balanceDueCents: 64100, sent: false }), true)
  assert.equal(partyBillDue({ startMs: start, now: at(239), balanceDueCents: 64100, sent: false }), true)
  assert.equal(partyBillDue({ startMs: start, now: at(240), balanceDueCents: 64100, sent: false }), false)
})

test("partyBillDue: never twice, never when nothing is owed", () => {
  const start = wallToInstant("2026-10-24T18:00:00+00:00")
  const now = start + 70 * 60_000
  assert.equal(partyBillDue({ startMs: start, now, balanceDueCents: 64100, sent: true }), false)
  assert.equal(partyBillDue({ startMs: start, now, balanceDueCents: 0, sent: false }), false)
  assert.equal(partyBillDue({ startMs: start, now, balanceDueCents: null, sent: false }), false)
})

test("partyBillText: first name, signer, the order's own pay link, cash still fine, never 'optional'", () => {
  const text = partyBillText({ signer: "Bling", customerName: "Matthew Katz", payUrl: payUrlFor("d1233d22-a8f8-4ca3-8e40-78fe43c4495e") })
  assert.match(text, /^Hi Matthew, it's Bling from Real Hibachi\. Hope the party's going well\./)
  assert.match(text, /https:\/\/www\.realhibachi\.com\/pay\?o=d1233d22-a8f8-4ca3-8e40-78fe43c4495e/)
  assert.match(text, /Cash to your chef works too\.$/)
  assert.doesNotMatch(text, /optional/i)
  assert.match(partyBillText({ customerName: "", payUrl: "x" }), /^Hi, it's Rowling from Real Hibachi/)
})
