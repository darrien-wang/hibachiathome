// Layer-2 self-test: which customer texts lead-watch lists as waiting on a person.
// 2026-11-12 10:35 it listed four, all "urgent", and none was: three chefs' "1" replies to a
// change text, and a question answered the evening before whose answer had fallen off the list
// of the last 60 texts we sent ("waiting 968 minutes").
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { notAQuestion } from "../lib/courtesy-text"
import { lastOutboundByPeer, smsWaiting, type SweepMessage } from "../lib/sms-waiting"

const OURS = "+12137707788"
const JEFFREY = "+16615550101"
const GILLIAN = "+15615550102"
const CHEF = "+16265550103"
const NOW = Date.parse("2026-11-12T18:35:00Z") // 10:35 PT

let seq = 0
const text = (from: string, to: string, at: string, body: string | null, media = 0): SweepMessage => ({
  sid: `SM${++seq}`,
  from,
  to,
  body,
  date_sent: at,
  date_created: at,
  num_media: String(media),
})
const inb = (from: string, at: string, body: string | null, media = 0) => text(from, OURS, at, body, media)
const out = (to: string, at: string, body = "ok") => text(OURS, to, at, body)

// Twilio lists newest first.
const newestFirst = (list: SweepMessage[]) => [...list].sort((a, b) => Date.parse(b.date_sent ?? "") - Date.parse(a.date_sent ?? ""))

const base = {
  now: NOW,
  cutoff: NOW - 24 * 3600_000,
  pageSize: 800,
  skip: (from: string) => from === CHEF,
  // The live rule adds holds and 不用回 marks; "not a question" is the part these cases need.
  quiet: (_from: string, _at: number, body: string | undefined) => body !== undefined && notAQuestion(body),
}
const run = (inbound: SweepMessage[], outbound: SweepMessage[], over: Partial<typeof base> = {}) =>
  smsWaiting(newestFirst(inbound), newestFirst(outbound), { ...base, ...over })

test("sms waiting · a question newer than anything we sent is waiting, with the minutes", () => {
  const got = run([inb(GILLIAN, "2026-11-12T18:24:33Z", "Is the linen for the tables provided by the way?")], [out(GILLIAN, "2026-11-12T18:06:00Z")])
  assert.equal(got.length, 1)
  assert.equal(got[0].from, GILLIAN)
  assert.equal(got[0].minutesWaiting, 10)
  assert.equal(got[0].body, "Is the linen for the tables provided by the way?")
})

test("sms waiting · answered, or closed with a thank-you after the answer, is not", () => {
  const question = inb(JEFFREY, "2026-11-12T02:26:00Z", "Hey Rowling. 5 pm dinner but arrival time is 4 pm correct ?")
  const answer = out(JEFFREY, "2026-11-12T02:27:00Z", "Yes, that's right. Your chef will see you Saturday at 4.")
  assert.deepEqual(run([question], [answer]), [])
  assert.deepEqual(run([question, inb(JEFFREY, "2026-11-12T02:30:14Z", "Awesome ! Thank you")], [answer]), [])
})

test("sms waiting · a reaction or a bare thanks does not hide the question before it", () => {
  const got = run(
    [inb(GILLIAN, "2026-11-12T18:00:00Z", "Can the chef come at 4 instead?"), inb(GILLIAN, "2026-11-12T18:01:00Z", "Thanks!")],
    [out(GILLIAN, "2026-11-12T17:00:00Z")],
  )
  assert.equal(got.length, 1)
  assert.equal(got[0].body, "Can the chef come at 4 instead?")
  assert.equal(got[0].minutesWaiting, 35)
})

test("sms waiting · a chef's 1 to a change text is not a customer waiting", () => {
  assert.deepEqual(run([inb(CHEF, "2026-11-12T17:45:05Z", "1")], [out(CHEF, "2026-11-12T08:42:00Z", "Real Hibachi 改单通知 … 看完请回 1 确认。")]), [])
})

test("sms waiting · pictures count, and say how many", () => {
  const got = run([inb(GILLIAN, "2026-11-12T18:20:00Z", null, 2)], [])
  assert.equal(got[0].body, "[2 image(s)]")
})

test("sms waiting · older than the cutoff is not looked at", () => {
  assert.deepEqual(run([inb(GILLIAN, "2026-11-11T10:00:00Z", "Do you bring the propane?")], []), [])
})

// The list of what we sent is one page. When it comes back full it stops somewhere, and before
// that point a number with nothing from us is "not on the list", not "never answered".
test("sms waiting · an answer that fell off a full page does not turn its question into 16 hours of waiting", () => {
  const inbound = [
    inb(JEFFREY, "2026-11-12T02:26:00Z", "Hey Rowling. 5 pm dinner but arrival time is 4 pm correct ?"),
    inb(JEFFREY, "2026-11-12T02:30:14Z", "Awesome ! Thank you"),
  ]
  // Three texts to other people since the small hours fill the page; the 02:27 answer is not on it.
  const outbound = [out("+13105550111", "2026-11-12T08:42:00Z"), out("+13105550112", "2026-11-12T15:00:00Z"), out("+13105550113", "2026-11-12T17:10:00Z")]
  assert.deepEqual(run(inbound, outbound, { pageSize: 3 }), [])
  // The same lists read as complete (a bigger page that did not fill) would have to say "waiting":
  // that is the old behaviour, and why the sweep now reads as far as the inbox does.
  assert.equal(run(inbound, outbound, { pageSize: 800 }).length, 1)
})

test("sms waiting · on a full page, a text from after the page's oldest entry is still reported", () => {
  const outbound = [out("+13105550111", "2026-11-12T08:42:00Z"), out("+13105550112", "2026-11-12T15:00:00Z"), out("+13105550113", "2026-11-12T17:10:00Z")]
  const got = run([inb(GILLIAN, "2026-11-12T18:24:33Z", "Is the linen for the tables provided by the way?")], outbound, { pageSize: 3 })
  assert.equal(got.length, 1)
  assert.equal(got[0].minutesWaiting, 10)
})

test("sms waiting · on a full page, a new thank-you does not bring back a question from before the page", () => {
  const inbound = [inb(JEFFREY, "2026-11-12T02:26:00Z", "5 pm dinner but arrival time is 4 pm correct ?"), inb(JEFFREY, "2026-11-12T17:30:00Z", "Thank you!")]
  const outbound = [out("+13105550111", "2026-11-12T08:42:00Z"), out("+13105550112", "2026-11-12T15:00:00Z"), out("+13105550113", "2026-11-12T17:10:00Z")]
  assert.deepEqual(run(inbound, outbound, { pageSize: 3 }), [])
})

test("lastOutboundByPeer keeps the newest text per number", () => {
  const map = lastOutboundByPeer(newestFirst([out(GILLIAN, "2026-11-12T17:00:00Z"), out(GILLIAN, "2026-11-12T18:06:00Z"), out(JEFFREY, "2026-11-12T02:27:00Z")]))
  assert.equal(map.get(GILLIAN), Date.parse("2026-11-12T18:06:00Z"))
  assert.equal(map.get(JEFFREY), Date.parse("2026-11-12T02:27:00Z"))
})
