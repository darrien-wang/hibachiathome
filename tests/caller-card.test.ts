// Layer-2 self-test: 来电卡片 (lib/caller-card.ts, 2026-10-10). When April called the 213 line on
// 10-10 the owner picked up knowing nothing; the ring now carries who it is, and the App and the web
// softphone show it. The card, its dates and money, where the price and name come from, and the
// TwiML leg that carries it.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  callerCard,
  callerCardFull,
  callerCardLine2,
  cardDate,
  textDate,
  clientLeg,
  displayName,
  greetedName,
  money,
  partyDateFromHint,
  pickPrice,
  priceInText,
  readTimeline,
  statedHeadcount,
  type CallerFacts,
  type TimelineRow,
} from "../lib/caller-card"
import { CALLER_CARD_PARAM, decodeCallerCard, encodeCallerCard } from "../lib/caller-card-param"

const SAT = "2026-10-10"
const april: CallerFacts = {
  name: "April Costigan",
  heads: 35,
  date: "2026-10-12",
  time: null,
  dateTbd: false,
  price: 1225,
  locked: false,
  order: false,
  returning: false,
  lastText: null,
  channel: null,
}

test("caller card · April after the 11:28 concession", () => {
  assert.deepEqual(callerCard(april, SAT), { name: "April Costigan", line: "35人 · 10月12日 周一 · 报价 $1,225 · 还没锁单" })
})

test("caller card · April at 11:15: the $1,337.40 we had texted, as written", () => {
  assert.equal(callerCard({ ...april, price: 1337.4 }, SAT)?.line, "35人 · 10月12日 周一 · 报价 $1,337.40 · 还没锁单")
})

test("caller card · a number we know nothing about gets no card", () => {
  const unknown: CallerFacts = { name: "", heads: null, date: null, time: null, dateTbd: false, price: null, locked: false, order: false, returning: false, lastText: null, channel: null }
  assert.equal(callerCard(unknown, SAT), null)
  assert.equal(callerCard({ ...unknown, heads: 0, price: 0 }, SAT), null)
})

test("caller card · no name: the party still shows (the number is on screen anyway)", () => {
  assert.deepEqual(callerCard({ ...april, name: "", price: null }, SAT), { name: "", line: "35人 · 10月12日 周一 · 还没锁单" })
})

test("caller card · a booked party: total, start time, locked, 今天 / 明天 / 日期待定", () => {
  const booked: CallerFacts = { ...april, name: "Maribel Martinez", heads: 26, date: SAT, time: "19:00", price: 1382, locked: true, order: true, lastText: null, channel: null }
  assert.equal(callerCard(booked, SAT)?.line, "26人 · 今天 19:00 · 总价 $1,382 · 已锁单")
  assert.equal(callerCard({ ...booked, date: "2026-10-11", time: null }, SAT)?.line, "26人 · 明天 · 总价 $1,382 · 已锁单")
  assert.equal(callerCard({ ...booked, date: "2026-10-13", time: "18:30", price: 1257.6 }, SAT)?.line, "26人 · 10月13日 周二 18:30 · 总价 $1,257.60 · 已锁单")
  assert.equal(callerCard({ ...booked, date: null, time: null, dateTbd: true, heads: 6, price: 599 }, SAT)?.line, "6人 · 日期待定 · 总价 $599 · 已锁单")
})

test("caller card · a returning customer says so", () => {
  assert.equal(callerCard({ ...april, name: "Jane", returning: true, heads: 20, date: null, price: null }, SAT)?.line, "老客人 · 20人 · 还没锁单")
})

test("caller card · dates and money read the way they were quoted", () => {
  assert.equal(cardDate("2026-10-12", SAT), "10月12日 周一")
  assert.equal(cardDate("2026-10-24", SAT), "10月24日 周六")
  assert.equal(cardDate("2027-01-09", SAT), "1月9日 周六")
  assert.equal(cardDate("2026-12-31", "2026-12-30"), "明天")
  assert.equal(money(1225), "$1,225")
  assert.equal(money(1337.4), "$1,337.40")
  assert.equal(money(1801.5), "$1,801.50")
  assert.equal(money(599), "$599")
  assert.equal(money(12000), "$12,000")
})

test("caller card · the price is the one the text gives, not its parts", () => {
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

test("caller card · the name we greeted them by", () => {
  assert.equal(greetedName("Hi April, it's Bling - sorry I was a step behind on the phone"), "April")
  assert.equal(greetedName("Hi Whitney - great to hear from you"), "Whitney")
  assert.equal(greetedName("Hey Jose Garcia, thanks for the call!"), "Jose")
  assert.equal(greetedName("Hi Yvette! You're already locked in"), "Yvette")
  for (const t of ["Hi! Bling from Real Hibachi 👋", "Hi, it's Bling from Real Hibachi", "Hi there!", "Hello Mrs. Smith,", "Got it - 18 seats."]) {
    assert.equal(greetedName(t), "", t)
  }
})

test("caller card · names; a phone number or a stand-in is no name", () => {
  assert.equal(displayName("April Costigan"), "April Costigan")
  assert.equal(displayName("Ellen  Vallee"), "Ellen Vallee")
  assert.equal(displayName("王小明"), "王小明")
  for (const n of ["+16262220069", "Unknown Contact", "Guest", "SMS Lead", "", null]) assert.equal(displayName(n), "", String(n))
})

test("caller card · a note's date without a year is the next one after the note", () => {
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

test("caller card · the party size a price was for", () => {
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

test("caller card · April's timeline: her name from our greeting, Monday from the note, $1,225", () => {
  const t = readTimeline(aprilTimeline)
  assert.equal(t.greeted, "April")
  assert.equal(t.date, "2026-10-12")
  assert.equal(pickPrice(t.shown, 35)?.value, 1225)
  // On the 11:15 call (before the $35-a-boy text) it was the $1,337.40 we had sent the day before.
  const at1115 = readTimeline(aprilTimeline.filter((r) => r.occurred_at < "2026-10-10T18:15:00Z"))
  assert.equal(pickPrice(at1115.shown, 35)?.value, 1337.4)
})

test("caller card · 'OWNER DECISION 09-28' in a note is not Dec 9: the party date is the real one", () => {
  const t = readTimeline([
    note("2026-10-01T20:12:03Z", "[data] 10-01 13:08 she asked when to pay - card total $1,019.10. Party tomorrow Fri 10-02 18:30."),
    note("2026-09-28T22:03:02Z", "[data] 09-28 address received, written to the order. With travel $999.80, balance $979.90. OWNER DECISION 09-28: keep it."),
    note("2026-09-28T21:55:40Z", "[data] 09-28 she submitted the full planner menu. PARTY IS FRI 2026-10-02 18:30, four days out."),
  ])
  assert.equal(t.date, "2026-10-02")
})

test("caller card · a price for another headcount is passed over (912-944-5781: 30, not the 15 we asked about)", () => {
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

test("caller card · rides on the App leg as one parameter that survives the trip", () => {
  const card = { name: "April Costigan", line: "35人 · 10月12日 周一 · 报价 $1,225 · 还没锁单" }
  const leg = clientLeg("agent_darrien", card)
  const value = /<Parameter name="([^"]+)" value="([^"]+)"\/>/.exec(leg)
  assert.ok(leg.startsWith("<Client><Identity>agent_darrien</Identity><Parameter "), leg)
  assert.ok(leg.endsWith("</Client>"), leg)
  assert.equal(value?.[1], CALLER_CARD_PARAM)
  assert.match(value?.[2] ?? "", /^[A-Za-z0-9_-]+$/) // nothing the push or the XML could mangle
  assert.deepEqual(decodeCallerCard(value?.[2]), card)
  assert.deepEqual(decodeCallerCard(encodeCallerCard({ name: "", line: "老客人 · 20人 · 还没锁单" })), { name: "", line: "老客人 · 20人 · 还没锁单" })
  // An unknown caller: the leg the App always got.
  assert.equal(clientLeg("agent_darrien", null), "<Client><Identity>agent_darrien</Identity></Client>")
  assert.equal(clientLeg("agent_<x>", null), "<Client><Identity>agent_&lt;x&gt;</Identity></Client>")
  for (const junk of ["", "not base64!", "e30", null]) assert.equal(decodeCallerCard(junk), null, String(junk))
})

test("caller card · line 2: the customer's last text and the channel (owner 2026-10-20)", () => {
  const f: CallerFacts = { ...april, lastText: { body: "Can we do Nov 6 at 7?  We're 16 now", at: "2026-10-09T19:12:00Z" }, channel: "google_ads" }
  assert.equal(callerCardLine2(f, SAT), "昨天短信：Can we do Nov 6 at 7? We're 16 now · Google Ads")
  assert.equal(callerCardLine2({ ...f, lastText: { ...f.lastText!, at: "2026-10-10T19:12:00Z" } }, SAT).slice(0, 5), "今天短信：")
  assert.equal(callerCardLine2({ ...f, lastText: { ...f.lastText!, at: "2026-10-01T19:12:00Z" } }, SAT).slice(0, 7), "10月1日短信")
  assert.equal(callerCardLine2({ ...april, channel: "meta_ads" }, SAT), "还没回过短信 · Meta Ads")
  assert.equal(callerCardLine2({ ...april, channel: null }, SAT), "还没回过短信")
  const long = "x".repeat(80)
  assert.equal(callerCardLine2({ ...april, lastText: { body: long, at: "2026-10-10T01:00:00Z" } }, SAT), `今天短信：${"x".repeat(47)}…`)
})

test("caller card · both lines travel in one card; nothing known reads 新号码 · 无记录", () => {
  const f: CallerFacts = { ...april, lastText: { body: "Does the price include tax?", at: "2026-10-10T15:00:00Z" }, channel: "google_ads" }
  assert.deepEqual(callerCardFull(f, SAT), {
    name: "April Costigan",
    line: "35人 · 10月12日 周一 · 报价 $1,225 · 还没锁单\n今天短信：Does the price include tax? · Google Ads",
  })
  const nothing: CallerFacts = { name: "", heads: null, date: null, time: null, dateTbd: false, price: null, locked: false, order: false, returning: false, lastText: null, channel: null }
  assert.deepEqual(callerCardFull(nothing, SAT), { name: "", line: "新号码 · 无记录" })
  // A number that only ever texted us still gets its text.
  assert.deepEqual(callerCardFull({ ...nothing, lastText: { body: "Hi, do you come to Big Bear?", at: "2026-10-10T15:00:00Z" } }, SAT), { name: "", line: "今天短信：Hi, do you come to Big Bear?" })
  const wire = decodeCallerCard(encodeCallerCard(callerCardFull(f, SAT)))
  assert.equal(wire?.line.split("\n").length, 2)
})

test("textDate · 今天 / 昨天 / 月日", () => {
  assert.equal(textDate("2026-10-10", SAT), "今天")
  assert.equal(textDate("2026-10-09", SAT), "昨天")
  assert.equal(textDate("2026-09-30", SAT), "9月30日")
})
