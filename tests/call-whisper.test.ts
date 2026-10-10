// Layer-2 self-test: 来电耳语 (lib/call-whisper.ts, 2026-10-10). When April called the 213 line
// on 10-10 the owner picked up knowing nothing; whoever answers now hears who it is first.
// The sentence, its numbers and dates, and where the price and name come from.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  firstName,
  greetedName,
  partyDateFromHint,
  pickPrice,
  priceInText,
  readTimeline,
  spokenDate,
  statedHeadcount,
  whisperAttribute,
  whisperLine,
  zhNumber,
  type TimelineRow,
  type WhisperFacts,
} from "../lib/call-whisper"

const SAT = "2026-10-10"
const april: WhisperFacts = {
  name: "April",
  phone: "+16262220069",
  heads: 35,
  date: "2026-10-12",
  dateTbd: false,
  price: 1225,
  locked: false,
  order: false,
  returning: false,
}

test("whisper · April after the 11:28 concession: the owner's own example", () => {
  assert.equal(whisperLine(april, SAT), "April，三十五人，周一十月十二号，报价一千二百二十五，还没锁单")
})

test("whisper · April at 11:15: the $1,337.40 we had texted, said as written", () => {
  assert.equal(whisperLine({ ...april, price: 1337.4 }, SAT), "April，三十五人，周一十月十二号，报价一千三百三十七，还没锁单")
})

test("whisper · a number we know nothing about gets no whisper", () => {
  const unknown: WhisperFacts = { name: "", phone: "+13105550123", heads: null, date: null, dateTbd: false, price: null, locked: false, order: false, returning: false }
  assert.equal(whisperLine(unknown, SAT), null)
  assert.equal(whisperLine({ ...unknown, heads: 0, price: 0 }, SAT), null)
})

test("whisper · no name: the last four digits, as the callback ring says them", () => {
  assert.equal(whisperLine({ ...april, name: "", price: null }, SAT), "尾号 0 0 6 9 的客人，三十五人，周一十月十二号，还没锁单")
})

test("whisper · a booked party: total, locked, 今天 / 明天 / 日期待定", () => {
  const booked: WhisperFacts = { ...april, name: "Maribel", heads: 26, date: SAT, price: 1382, locked: true, order: true }
  assert.equal(whisperLine(booked, SAT), "Maribel，二十六人，今天，总价一千三百八十二，已锁单")
  assert.equal(whisperLine({ ...booked, date: "2026-10-11" }, SAT), "Maribel，二十六人，明天，总价一千三百八十二，已锁单")
  assert.equal(whisperLine({ ...booked, date: null, dateTbd: true, heads: 6, price: 599 }, SAT), "Maribel，六人，日期待定，总价五百九十九，已锁单")
})

test("whisper · a returning customer says so", () => {
  assert.equal(
    whisperLine({ ...april, name: "Jane", returning: true, heads: 20, date: null, price: null }, SAT),
    "Jane，老客人，二十人，还没锁单",
  )
})

test("whisper · numbers are written out, never left to the voice", () => {
  const cases: Array<[number, string]> = [
    [6, "六"],
    [10, "十"],
    [12, "十二"],
    [35, "三十五"],
    [101, "一百零一"],
    [110, "一百一十"],
    [599, "五百九十九"],
    [1005, "一千零五"],
    [1010, "一千零一十"],
    [1225, "一千二百二十五"],
    [1337.4, "一千三百三十七"],
    [1801.5, "一千八百零一"],
    [2000, "两千"],
    [2319, "两千三百一十九"],
    [3114, "三千一百一十四"],
    [10050, "一万零五十"],
    [12000, "一万两千"],
  ]
  for (const [n, zh] of cases) assert.equal(zhNumber(n), zh, String(n))
})

test("whisper · dates: weekday, month, day; no year", () => {
  assert.equal(spokenDate("2026-10-12", SAT), "周一十月十二号")
  assert.equal(spokenDate("2026-10-24", SAT), "周六十月二十四号")
  assert.equal(spokenDate("2027-01-09", SAT), "周六一月九号")
  assert.equal(spokenDate("2026-12-31", "2026-12-30"), "明天")
})

test("whisper · the price is the one the text gives, not its parts", () => {
  const cases: Array<[string, number | null]> = [
    // April, 10-10 11:28 and 10-09 13:24
    ["Hi April, it's Bling - For Monday I can do $35 a boy, $1,225 for all 35, and every boy gets all three", 1225],
    ["Here's one simple price for all 35 on Monday, Oct 12: $1,337.40, with no travel fee to North Hollywood.", 1337.4],
    // the instant quote's own text: the discount and the rental rates are not the price
    ["Real Hibachi: your North Hollywood hibachi price is $1,801.50 for 35 adults (Weekday Special (Mon-Thu), Mon, Oct 12, 2026). Includes the $120 party-size discount (31-40 adults). Tables, chairs & linens $10/guest, plates & silverware $5", 1801.5],
    // itemized: the food subtotal comes first, the total last
    ["Here's your quote:\n27 guests x $59.90 = $1,617.30\nParty-size discount: -$90.00\nTravel: +$65.00\nTotal: $1,592.30", 1592.3],
    ["21 adults x $59.90 + 1 kid x $29.90 = $1,287.80; party-size discount -$60; plates for 22: +$110. Total $1,337.80 (cash)", 1337.8],
    ["Done - 22 adults: 22 x $59.90 = $1,317.80, minus the $60 party discount, plus $110 for plates = $1,367.80 cash.", 1367.8],
    ["Napkins are in - you're set for 22 - $1,337.80 cash total. Lock Oct 17 here", 1337.8],
    ["Pasadena's inside our free-travel area, so $1,707 is your total.", 1707],
    ["I can do $54.90 a guest instead of $59.90, and take another $90 off - $1,831.50 all in for 35", 1831.5],
    ["Got it - 21 adults and a child comes to $1,227.80 all in. Monday through Thursday drops it to $1,120.35.", 1227.8],
    // the price it replaced is not the price
    ["Good news on Dec 12: 36 is now $2,078.40 instead of $2,198.40.", 2078.4],
    ["I can bring it down from $1,337.40 to $1,225 for all 35.", 1225],
    ["Plates and silverware for 28 are $140 ($5 a guest), which brings it to $1,645.20 with the travel.", 1645.2],
    ["Your total comes to $1,355.25 ($1,335.35 on the day).", 1355.25],
    ["Total $1,071.20, balance $1,051.30 tonight.", 1071.2],
    ["With everyone's picks it comes to $1,006.30, so $986.40 after your deposit.", 1006.3],
    // a balance, a note about a rate, a $19.90 hold: no price here
    ["See you tomorrow at 7! Your balance is $1,382.00 - cash to your chef at the end is easiest.", null],
    ["Quick note on the $30: kids 12 and under are half price. The extra $10 was for a 3rd protein. The $35 gives every boy all three.", null],
    ["$19.90 holds the date: https://www.realhibachi.com/d/8pnJax", null],
    ["", null],
  ]
  for (const [text, price] of cases) assert.equal(priceInText(text), price, text)
})

test("whisper · the name we greeted them by", () => {
  assert.equal(greetedName("Hi April, it's Bling - sorry I was a step behind on the phone"), "April")
  assert.equal(greetedName("Hi Whitney - great to hear from you"), "Whitney")
  assert.equal(greetedName("Hey Jose Garcia, thanks for the call!"), "Jose")
  assert.equal(greetedName("Hi Yvette! You're already locked in"), "Yvette")
  for (const t of ["Hi! Bling from Real Hibachi 👋", "Hi, it's Bling from Real Hibachi", "Hi there!", "Hello Mrs. Smith,", "Got it - 18 seats."]) {
    assert.equal(greetedName(t), "", t)
  }
})

test("whisper · first names; a phone number or a stand-in is no name", () => {
  assert.equal(firstName("April Costigan"), "April")
  assert.equal(firstName("Ellen  Vallee"), "Ellen")
  assert.equal(firstName("NIC TENWOLDE"), "Nic")
  assert.equal(firstName("D Johnson"), "D Johnson")
  assert.equal(firstName("王小明"), "王小明")
  for (const n of ["+16262220069", "Unknown Contact", "Guest", "SMS Lead", "", null]) assert.equal(firstName(n), "", String(n))
})

test("whisper · a note's date without a year is the next one after the note", () => {
  // April's [data] note, 10-09: "Engine Mon 10/12 weekday"
  assert.equal(partyDateFromHint("10/12", "2026-10-09T07:01:22Z"), "2026-10-12")
  assert.equal(partyDateFromHint("1/9", "2026-10-08T19:23:27Z"), "2027-01-09")
  assert.equal(partyDateFromHint("Oct 3", "2026-10-09T12:00:00Z"), "2026-10-03")
  assert.equal(partyDateFromHint("Dec 12th", "2026-10-07T00:40:00Z"), "2026-12-12")
  assert.equal(partyDateFromHint("10/24/26", "2026-10-02T00:00:00Z"), "2026-10-24")
  assert.equal(partyDateFromHint("2026-10-12", "2026-10-09T06:37:09Z"), "2026-10-12")
  assert.equal(partyDateFromHint("Sept 5", "2026-08-20T00:00:00Z"), "2026-09-05")
  assert.equal(partyDateFromHint("May 5", "2026-10-09T00:00:00Z"), "2027-05-05")
  assert.equal(partyDateFromHint("13/45", "2026-10-09T00:00:00Z"), null)
  assert.equal(partyDateFromHint("2/30", "2026-10-09T00:00:00Z"), null)
  // the timeline's pattern also matches these; they are not dates
  assert.equal(partyDateFromHint("DECISION 09", "2026-09-28T22:03:02Z"), null)
  assert.equal(partyDateFromHint("may 5", "2026-10-09T00:00:00Z"), null)
  assert.equal(partyDateFromHint("Marching 4", "2026-10-09T00:00:00Z"), null)
})

test("whisper · the party size a price was for", () => {
  const cases: Array<[string, number | null]> = [
    ["Real Hibachi: your hibachi price is $1,801.50 for 35 adults (Weekday Special). Includes the $120 party-size discount (31-40 adults).", 35],
    ["For Monday I can do $35 a boy, $1,225 for all 35, and every boy gets all three", 35],
    ["Hi - for 25 adults + 3 kids on Sat, Oct 17 at 6 it's $1,497.20 all in", 28],
    ["Got it - 21 adults and a child comes to $1,227.80 all in", 22],
    ["Done. Tue, Oct 13 for 24 at $1,257.60 all in", 24],
    ["Saw you ran it for 15 - that's $838.50 all in for Sat, Oct 17. Is it closer to 15 or 30?", 15],
    ["Your total comes to $1,355.25 ($1,335.35 on the day).", null],
    ["Lock it for 10/17 at 7 - the chef stays for 2 hours", null],
  ]
  for (const [text, heads] of cases) assert.equal(statedHeadcount(text), heads, text)
})

const sms = (at: string, body: string): TimelineRow => ({ touchpoint_type: "sms_outbound", occurred_at: at, raw_payload_json: { body } })
const note = (at: string, text: string): TimelineRow => ({ touchpoint_type: "agent_note", occurred_at: at, raw_payload_json: { note: text } })
const quote = (at: string, adults: number, eventDate: string, total: number): TimelineRow => ({
  touchpoint_type: "landing_quote_text",
  occurred_at: at,
  raw_payload_json: { auto: "leave", adults, kids: 0, eventDate, computed: { total } },
})

// April's timeline as it stood after 11:30 on 10-10, newest first (abridged).
const aprilTimeline: TimelineRow[] = [
  sms("2026-10-10T18:30:39Z", "Quick note on the $30: kids 12 and under are half price. The extra $10 on the phone was for a 3rd protein. The $35 gives every boy all three."),
  sms("2026-10-10T18:28:27Z", "Hi April, it's Bling - sorry I was a step behind on the phone. For Monday I can do $35 a boy, $1,225 for all 35, and every boy gets all three. https://www.realhibachi.com/d/DLP3Z4"),
  { touchpoint_type: "sms_inbound", occurred_at: "2026-10-10T18:20:25Z", raw_payload_json: { Body: "Yes this price ends up being 38 per person. I thought we discussed $30 per person?" } },
  { touchpoint_type: "call_inbound", occurred_at: "2026-10-10T18:15:20Z", raw_payload_json: { From: "+16262220069" } },
  sms("2026-10-10T17:34:34Z", "Hi April - figured you've got a lot going on before the big day. Monday's two days out - lock it now and I'll assign your chef."),
  sms("2026-10-09T20:24:04Z", "Hi April, thanks for your patience! Here's one simple price for all 35 on Monday, Oct 12: $1,337.40, with no travel fee. https://www.realhibachi.com/d/9JhjGD"),
  note("2026-10-09T07:01:22Z", "[data] 00:00 '35 boys who are 12 and 13'. Engine Mon 10/12 weekday: all 12 -> $900.75; 17A+18K -> $1,337.40."),
  sms("2026-10-09T06:39:00Z", "Hi! Bling from Real Hibachi 👋 Mon, Oct 12 is open on our end for your 35 in North Hollywood — what's the celebration?"),
  sms("2026-10-09T06:37:10Z", "Real Hibachi: your North Hollywood hibachi price is $1,801.50 for 35 adults (Weekday Special (Mon-Thu), Mon, Oct 12, 2026). Includes the $120 party-size discount (31-40 adults)."),
  quote("2026-10-09T06:37:09Z", 35, "2026-10-12", 1801.5),
]

test("whisper · April's timeline: her name from our greeting, Monday from the note, $1,225", () => {
  const t = readTimeline(aprilTimeline)
  assert.equal(t.greeted, "April")
  assert.equal(t.date, "2026-10-12")
  assert.equal(pickPrice(t.shown, 35)?.value, 1225)
  // On the 11:15 call (before the $35-a-boy text) it was the $1,337.40 we had sent the day before.
  const at1115 = readTimeline(aprilTimeline.filter((r) => r.occurred_at < "2026-10-10T18:15:00Z"))
  assert.equal(pickPrice(at1115.shown, 35)?.value, 1337.4)
})

test("whisper · 'OWNER DECISION 09-28' in a note is not Dec 9: the party date is the real one", () => {
  const t = readTimeline([
    note("2026-10-01T20:12:03Z", "[data] 10-01 13:08 she asked when to pay - card total $1,019.10. Party tomorrow Fri 10-02 18:30."),
    note("2026-09-28T22:03:02Z", "[data] 09-28 address received, written to the order. With travel $999.80, balance $979.90. OWNER DECISION 09-28: keep it."),
    note("2026-09-28T21:55:40Z", "[data] 09-28 she submitted the full planner menu. PARTY IS FRI 2026-10-02 18:30, four days out."),
  ])
  assert.equal(t.date, "2026-10-02")
})

test("whisper · a price for another headcount is passed over (912-944-5781: 30, not the 15 we asked about)", () => {
  const t = readTimeline([
    sms("2026-10-09T20:25:28Z", "Hi - Saturday the 17th is 8 days out. If you'd still like a chef for your 30, lock it here."),
    quote("2026-10-04T20:44:06Z", 15, "", 838.5), // the page's untouched default, not a quote
    sms("2026-10-04T19:01:05Z", "Saw you ran it for 15 - that's $838.50 all in for Sat, Oct 17, and the price just follows the headcount. Is it closer to 15 or 30?"),
    quote("2026-10-03T18:48:08Z", 30, "", 1707),
    sms("2026-10-03T18:45:19Z", "Real Hibachi: your LA & Orange County hibachi price is $1,707.00 for 30 adults (Standard (any day), Sat, Oct 17, 2026)."),
    quote("2026-10-03T18:45:19Z", 30, "2026-10-17", 1707),
  ])
  assert.equal(t.date, "2026-10-17")
  assert.equal(pickPrice(t.shown, 30)?.value, 1707)
  assert.equal(pickPrice(t.shown, null)?.value, 838.5)
  assert.equal(pickPrice([], 30), null)
})

test("whisper · the leg's url is signed as written: digits only, nothing for an unknown caller", () => {
  assert.equal(
    whisperAttribute("https://www.realhibachi.com", "+16262220069"),
    ' url="https://www.realhibachi.com/api/twilio/voice-whisper?from=16262220069" method="POST"',
  )
  assert.equal(whisperAttribute("https://www.realhibachi.com", "Anonymous"), "")
  assert.equal(whisperAttribute("https://www.realhibachi.com", ""), "")
})
