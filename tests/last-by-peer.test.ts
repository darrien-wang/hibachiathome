// Layer-2 self-test: who spoke last, per customer number, from Twilio's two
// lists (lib/sms-thread.ts foldLastByPeer). The 2026-10-05 miss: three patio
// photos, then a "Loved …" reaction 30 s later. Every alert judged the
// reaction, an empty MMS body read as courtesy, and nothing rang for two days.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { foldLastByPeer, type TwilioMessage } from "../lib/sms-thread"

const OURS = "+12137707788"
const THEM = "+19092687235"
const out = (sid: string, at: string, body: string): TwilioMessage => ({ sid, direction: "outbound-api", body, from: OURS, to: THEM, status: "delivered", date_sent: at, date_created: at })
const inb = (sid: string, at: string, body: string, media = 0): TwilioMessage => ({ sid, direction: "inbound", body, from: THEM, to: OURS, status: "received", date_sent: at, date_created: at, num_media: String(media) })

test("photos followed by a tapback: the photos are what needs an answer", () => {
  const map = foldLastByPeer(
    [out("SM1", "2026-10-05T17:47:15.000Z", "Send me a photo if you're not sure.")],
    [
      inb("SM3", "2026-10-05T18:11:51.000Z", "Loved “We do - they're normally $10 a guest”"),
      inb("MM2", "2026-10-05T18:11:22.000Z", "", 1),
      inb("MM1", "2026-10-05T18:10:10.000Z", "", 2),
    ],
  )
  const v = map.get(THEM)!
  assert.equal(v.last.body.startsWith("Loved"), true, "the newest inbound is still the reaction")
  assert.equal(v.lastInAt, "2026-10-05T18:11:51.000Z")
  assert.ok(v.lastRealIn, "a photo counts as content")
  assert.equal(v.lastRealIn!.at, "2026-10-05T18:11:22.000Z")
  assert.equal(v.lastRealIn!.media, 1)
  assert.ok(v.lastRealIn!.at > v.lastOutAt!, "and it came after our last text, so it is unanswered")
})

test("a question followed by thanks: the question is what to judge", () => {
  const map = foldLastByPeer(
    [out("SM1", "2026-10-06T01:00:00.000Z", "7 PM works - want me to hold it?")],
    [inb("SM2", "2026-10-06T01:05:00.000Z", "Do you bring the propane?"), inb("SM3", "2026-10-06T01:06:00.000Z", "Thanks!!")],
  )
  const v = map.get(THEM)!
  assert.equal(v.last.body, "Thanks!!")
  assert.equal(v.lastRealIn!.body, "Do you bring the propane?")
})

test("only a reaction after our text: nothing real is waiting", () => {
  const map = foldLastByPeer(
    [out("SM1", "2026-10-06T01:00:00.000Z", "Locked - see you Saturday!")],
    [inb("SM0", "2026-10-06T00:50:00.000Z", "Yes please lock it"), inb("SM2", "2026-10-06T01:01:00.000Z", "Loved “Locked - see you Saturday!”")],
  )
  const v = map.get(THEM)!
  assert.equal(v.last.body.startsWith("Loved"), true)
  assert.ok(v.lastRealIn!.at < v.lastOutAt!, "the last real message was already answered")
})

test("we answered after the photos: not waiting", () => {
  const map = foldLastByPeer(
    [out("SM1", "2026-10-05T17:47:15.000Z", "Send me a photo"), out("SM4", "2026-10-05T18:20:00.000Z", "Plenty of room - tables go on the turf.")],
    [inb("MM1", "2026-10-05T18:10:10.000Z", "", 2)],
  )
  const v = map.get(THEM)!
  assert.equal(v.last.direction, "outbound")
  assert.ok(v.lastRealIn!.at < v.lastOutAt!)
})

test("delivery · three texts that never got a receipt: no delivered time, status sent", () => {
  const sent = (sid: string, at: string): TwilioMessage => ({ ...out(sid, at, "Got your booking request"), to: "+16265589648", status: "sent" })
  const map = foldLastByPeer([sent("SM3", "2026-10-07T22:35:34Z"), sent("SM2", "2026-10-06T23:33:28Z"), sent("SM1", "2026-10-06T23:32:53Z")], [])
  const v = map.get("+16265589648")!
  assert.equal(v.deliveredOutAt, null)
  assert.equal(v.lastOutStatus, "sent")
  assert.equal(v.lastOutAt, "2026-10-07T22:35:34.000Z")
})

test("delivery · a number that received earlier texts keeps its delivered time even if the newest is still sending", () => {
  const map = foldLastByPeer(
    [{ ...out("SM2", "2026-10-07T10:00:00Z", "On our way"), status: "sent" }, out("SM1", "2026-10-06T10:00:00Z", "Confirmed for Saturday")],
    [],
  )
  const v = map.get(THEM)!
  assert.equal(v.deliveredOutAt, "2026-10-06T10:00:00.000Z")
  assert.equal(v.lastOutStatus, "sent")
})
