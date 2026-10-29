import assert from "node:assert/strict"
import { test } from "node:test"

import { draftSms, type CustomerEvent, type CustomerRow } from "../lib/customers"
import {
  partyBillText,
  partyContactFirstText,
  partyContactSecondText,
  payUrlFor,
  quoteFollowUpPlan,
  templateAMessage,
} from "../lib/first-response"
import { MISSED_CALL_TEXT } from "../lib/missed-call"
import { voiceHits } from "../lib/voice-check"

// The ruler is config/voice-rules.json, the same one `desk send` uses
// (owner 2026-10-29, leads voice.md). These are the texts it was built from.

test("voice: the 10-28/29 texts that read like a bot are stopped, by the same rules desk uses", () => {
  const stopped: Array<[string, string]> = [
    ["Our pleasure - see you on the 17th! 🔥", "banned"],
    ["We're excited too - it's going to be an amazing 30th! 🔥", "banned"],
    ["Perfect - steak and shrimp for everyone, it's on your order! 🥩🍤", "opener"],
    ["Great question! Paying cash on the day, sales tax is already included.", "opener"],
    ["Hi, it's Rowling - figured you're still picking a date. Which weekend are you thinking for your 14?", "your_n"],
    ["Hi! Rowling from Real Hibachi 👋 Saw your quote — what's the celebration?", "em_dash"],
    ["Yay, so glad! 🎉 You can move or cancel for free up to 48 hours before!", "bangs"],
  ]
  for (const [text, rule] of stopped) {
    const hits = voiceHits(text)
    assert.ok(hits.some((h) => h.level === "stop" && h.rule === rule), `${rule}: ${text} -> ${JSON.stringify(hits)}`)
  }
})

test("voice: ordinary English is left alone", () => {
  for (const text of [
    "Yes, noon works. Your chef will get there around 11:30 to set up.",
    "For your 16 adults and 3 kids it's $991.10 all in.",
    "30 people is $1,707 with tax if you pay cash.",
    "Happy birthday! When's the party?",
    "Yes - under 5 eat free.",
    "Anytime. See you on the 17th.",
  ]) {
    assert.deepEqual(voiceHits(text).filter((h) => h.level === "stop"), [], text)
  }
  // One " - " after "Yes" is a note, not a stop.
  assert.deepEqual(voiceHits("Yes - under 5 eat free.").map((h) => h.rule), ["splice_opener"])
})

// A machine text goes to every customer word for word, so the allowance a
// person gets (one emoji, one " - " now and then) does not apply: none at all.
const clean = (label: string, text: string) => {
  assert.deepEqual(voiceHits(text), [], `${label}: ${text}`)
  assert.doesNotMatch(text, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, `${label} has an emoji: ${text}`)
  assert.ok(!text.includes(" - "), `${label} splices with " - ": ${text}`)
}

test("voice: every machine-written text is clean - template B", () => {
  const today = "2026-10-07"
  for (const input of [
    { adults: 12, kids: 3, eventDate: "2026-10-18", city: "Palm Springs" },
    { adults: 30, kids: 0, eventDate: "2027-05-15", city: "San Diego" },
    { adults: 10, kids: 0, city: "Temecula" },
    { adults: 15, kids: 0, city: "92270" },
    { adults: 15, kids: 0, numberUnknown: true },
  ]) {
    const plan = quoteFollowUpPlan({ ...input, todayPt: today })
    assert.ok(plan.send)
    clean("template B", plan.text)
  }
})

test("voice: every machine-written text is clean - template A", () => {
  for (const p of [
    { adults: 15, cityName: "Anaheim" },
    { adults: 1, kids: 0, cityName: "La Puente", travelFee: 0 },
    { adults: 4, cityName: "Big Bear Lake", travelFee: 33 },
    { adults: 2, kids: 9, cityName: "Downey" },
    { adults: 11, cityName: "Southern California" },
  ]) {
    clean("template A", templateAMessage(p).sms)
  }
})

test("voice: every machine-written text is clean - pre-party, bill, missed call", () => {
  const party = { customerName: "Ana Ruiz", eventStart: "2026-10-24T15:30:00+00:00", address: "10756 McLennan Ave, Granada Hills, CA 91344" }
  clean("72h", partyContactFirstText({ ...party, signer: "Rowling", now: Date.parse("2026-10-21T16:00:00Z") }))
  clean("72h, no name", partyContactFirstText({ customerName: "", eventStart: party.eventStart, address: "", now: 0 }))
  clean("24h", partyContactSecondText({ ...party, now: Date.parse("2026-10-23T20:00:00Z") }))
  clean("bill", partyBillText({ signer: "Bling", customerName: "Matthew Katz", payUrl: payUrlFor("d1233d22-a8f8-4ca3-8e40-78fe43c4495e") }))
  clean("missed call", MISSED_CALL_TEXT)
})

test("voice: every machine-written text is clean - returning-customer drafts", () => {
  const c = { full_name: "maria lopez", address: "12 Elm St, Irvine, CA 92618", city: "Irvine", last_event_date: "2025-11-08", occasions: ["birthday"] } as unknown as CustomerRow
  const e = { event_date: "2025-11-08", address: "12 Elm St, Irvine, CA 92618", occasion: "birthday" } as unknown as CustomerEvent
  for (const campaign of ["anniversary", "winback", "referral"] as const) {
    const text = draftSms(campaign, c, e)
    assert.ok(text.length > 0, campaign)
    clean(campaign, text)
  }
})
