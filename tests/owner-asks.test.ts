// The workbench App rings only when the owner is needed (owner 2026-11-24: "需要我回复的时候在 app 上加个单独的响铃，
// 平常你能够自己回复的消息就不用在 app 上做消息提醒了").
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import type { InboxEvent } from "../lib/inbox"
import {
  appVersionFromUA,
  isOpenAsk,
  mobileEvents,
  ownerAskEvent,
  safetyNetRings,
  versionAtLeast,
  type OwnerAskRow,
} from "../lib/owner-asks"

const AT_10AM_PT = Date.parse("2026-11-24T18:00:00Z") // 10:00 PST
const AT_1130PM_PT = Date.parse("2026-11-25T07:30:00Z") // 23:30 PST
const AT_659AM_PT = Date.parse("2026-11-24T14:59:00Z") // 06:59 PST

const ask = (over: Partial<OwnerAskRow> = {}): OwnerAskRow => ({
  id: "a1",
  question: "要不要明早发 Rayna 相册链接？",
  lead_id: "lead-1",
  order_no: null,
  created_at: "2026-11-24T17:50:00Z",
  answered_at: null,
  ...over,
})

const ev = (over: Partial<InboxEvent> = {}): InboxEvent => ({
  key: "sms:+15551230000",
  kind: "sms",
  title: "Rayna 等了 31 分钟",
  body: "Can we add tables?",
  url: "/admin?tab=leads&lead=lead-1",
  at: "2026-11-24T17:29:00Z",
  waitedMinutes: 31,
  ring: true,
  urgent: true,
  leadId: "lead-1",
  phone: "+15551230000",
  orderId: null,
  ...over,
})

test("owner asks · the App version comes from the user agent", () => {
  assert.equal(appVersionFromUA("Mozilla/5.0 (Linux; Android 16) RealHibachiWorkbenchAndroid/2.3.0"), "2.3.0")
  assert.equal(appVersionFromUA("Mozilla/5.0 (Windows NT 10.0) Chrome/131"), null)
  assert.equal(appVersionFromUA(null), null)
  assert.equal(versionAtLeast("2.3.0", "2.3.0"), true)
  assert.equal(versionAtLeast("2.10.0", "2.3.0"), true)
  assert.equal(versionAtLeast("2.2.2", "2.3.0"), false)
  assert.equal(versionAtLeast(null, "2.3.0"), false)
})

test("owner asks · ring on their own channel in App 2.3.0+, on the new-lead channel before it", () => {
  const e = ownerAskEvent(ask(), AT_10AM_PT, "2.3.0")
  assert.equal(e.kind, "owner")
  assert.equal(e.key, "owner_ask:a1")
  assert.equal(e.title, "需要你回复")
  assert.equal(e.body, "要不要明早发 Rayna 相册链接？")
  assert.equal(e.url, "/admin?tab=leads&lead=lead-1")
  assert.equal(e.ring, true)
  assert.equal(e.waitedMinutes, 10)
  assert.equal(ownerAskEvent(ask(), AT_10AM_PT, "2.2.2").kind, "lead")
  assert.equal(ownerAskEvent(ask({ lead_id: null }), AT_10AM_PT, null).url, "/admin")
})

test("owner asks · answered or older than 12 hours stop ringing", () => {
  assert.equal(isOpenAsk(ask(), AT_10AM_PT), true)
  assert.equal(isOpenAsk(ask({ answered_at: "2026-11-24T17:55:00Z" }), AT_10AM_PT), false)
  assert.equal(isOpenAsk(ask({ created_at: "2026-11-24T05:59:00Z" }), AT_10AM_PT), false)
})

test("safety net · a customer still waiting 30 minutes in the daytime rings; under 30 does not", () => {
  assert.equal(safetyNetRings(ev(), AT_10AM_PT), true)
  assert.equal(safetyNetRings(ev({ waitedMinutes: 29 }), AT_10AM_PT), false)
  assert.equal(safetyNetRings(ev({ kind: "email", waitedMinutes: 45 }), AT_10AM_PT), true)
  assert.equal(safetyNetRings(ev({ kind: "lead", waitedMinutes: 30 }), AT_10AM_PT), true)
  assert.equal(safetyNetRings(ev({ kind: "chef", waitedMinutes: 60 }), AT_10AM_PT), true)
})

test("safety net · quiet at night (23:00-07:00 Pacific)", () => {
  assert.equal(safetyNetRings(ev({ waitedMinutes: 120 }), AT_1130PM_PT), false)
  assert.equal(safetyNetRings(ev({ waitedMinutes: 120 }), AT_659AM_PT), false)
})

test("safety net · never for what the owner turned off or what is not someone waiting", () => {
  // 11-22: a text that never arrived no longer rings (「以后别提醒了」)
  assert.equal(safetyNetRings(ev({ kind: "undelivered", waitedMinutes: 600 }), AT_10AM_PT), false)
  assert.equal(safetyNetRings(ev({ kind: "deposit", waitedMinutes: 90 }), AT_10AM_PT), false)
  assert.equal(safetyNetRings(ev({ kind: "call_summary", waitedMinutes: 177 }), AT_10AM_PT), false)
  assert.equal(safetyNetRings(ev({ kind: "reddit", waitedMinutes: 90 }), AT_10AM_PT), false)
  assert.equal(safetyNetRings(ev({ kind: "party_contact", waitedMinutes: 90 }), AT_10AM_PT), false)
  // order changes and chef confirmations only while they ring
  assert.equal(safetyNetRings(ev({ kind: "order_change", ring: false, waitedMinutes: 90 }), AT_10AM_PT), false)
  assert.equal(safetyNetRings(ev({ kind: "chef_notice", ring: true, waitedMinutes: 90 }), AT_10AM_PT), true)
})

test("mobile events · owner asks first, the desk's routine work dropped, the safety net on the loud channel", () => {
  const events = [
    ev({ key: "lead:new", kind: "lead", waitedMinutes: 0 }),
    ev({ key: "sms:fresh", waitedMinutes: 3 }),
    ev({ key: "sms:stuck", waitedMinutes: 42 }),
    ev({ key: "undelivered:x", kind: "undelivered", waitedMinutes: 6000 }),
  ]
  const out = mobileEvents(events, [ask(), ask({ id: "a2", answered_at: "2026-11-24T17:59:00Z" })], { now: AT_10AM_PT, appVersion: "2.3.0" })
  assert.deepEqual(out.map((e) => [e.key, e.kind]), [["owner_ask:a1", "owner"], ["sms:stuck", "sms"]])
  const stuck = out[1] as Record<string, unknown>
  assert.equal(stuck.title, "客服没回 · Rayna 等了 31 分钟")
  for (const k of ["leadId", "phone", "orderId", "justArrived", "urgent", "explain"]) assert.equal(k in stuck, false, k)
})

test("mobile events · nothing open, nothing rings", () => {
  assert.deepEqual(mobileEvents([ev({ waitedMinutes: 5 })], [], { now: AT_10AM_PT, appVersion: "2.3.0" }), [])
})
