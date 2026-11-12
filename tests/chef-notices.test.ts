// Layer-2 self-test: chef_change_notices on this side (lib/chef-notices.ts,
// order-flow rebuild 2026-11-11). The invoice app texts the chef what changed
// and files a row; here his "1" stamps acked_at, a notice two hours old with no
// "1" is listed, and one still open three hours before the party rings the
// owner. The table arrives with the invoice app's deploy: until then every
// read is empty and every write a no-op, which is tested too.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { CHEF_NOTICE_WHY, LIVE_PARTY_RING_HOURS_PT, isAlarm, isChefNoticeAlarm, isLivePartyAlarm, requestCallback, withinRingHours, type RingOutcome } from "../lib/callback-ring"
import { ackNotices, ackNoticesFromPhone, groupNotices, loadOpenNotices, noticeAlarmText, noticeState, noticeSummary, onStaffText, ringUnackedNotices, type ChefNotice } from "../lib/chef-notices"
import { fakeSupabase, type Row } from "./fixtures/fake-supabase"

const ORDER_ID = "00000000-0000-4000-8000-0000000000a1"
const LEAD_ID = "00000000-0000-4000-8000-0000000000c1"
const GARY = "00000000-0000-4000-8000-0000000000b2"
const BLU = "00000000-0000-4000-8000-0000000000b1"
// The party: 5:30 PM Pacific on Nov 14 2030, stored as 17:30+00; really 2030-11-15T01:30Z.
const ORDER = { id: ORDER_ID, order_no: "RH-20301105-0001", customer_name: "Joyce Lin", customer_phone: "+16265550100", event_start: "2030-11-14T17:30:00+00:00", event_address: "12 Test Way, Irvine, CA 92602", order_status: "active", source_metadata: { lead_id: LEAD_ID } }
const START = Date.parse("2030-11-15T01:30:00Z")
const H = 3600_000
const notice = (id: string, sentAt: number, over: Partial<ChefNotice> = {}): ChefNotice => ({ id, order_id: ORDER_ID, staff_member_id: GARY, summary: "8 位加餐具", sent_at: new Date(sentAt).toISOString(), acked_at: null, ...over })
const group = (sentAt: number) => groupNotices([notice("n1", sentAt)])[0]

function world(notices: Row[], over: { missing?: boolean; marks?: Row[]; order?: Row } = {}) {
  return fakeSupabase(
    {
      ...(over.missing ? {} : { chef_change_notices: notices }),
      orders: [{ ...ORDER, ...over.order }],
      staff_members: [
        { id: GARY, display_name: "Gary", full_name: null, phone: "6265550102", role: "chef" },
        { id: BLU, display_name: "Blu", full_name: null, phone: "(626) 555-0101", role: "chef" },
      ],
      order_events: [],
      lead_watch_notified: over.marks ?? [],
    },
    over.missing ? { missing: ["chef_change_notices"] } : {},
  )
}

test("state · two hours without a 1 puts it on the list; before that it is nobody's business yet", () => {
  const sent = START - 40 * H
  assert.deepEqual(noticeState(group(sent), ORDER, sent + 119 * 60_000), { show: false, urgent: false, waitedMinutes: 119, hoursToParty: 38 })
  const two = noticeState(group(sent), ORDER, sent + 2 * H)
  assert.equal(two.show, true)
  assert.equal(two.urgent, false)
  assert.equal(two.waitedMinutes, 120)
})

test("state · three hours before the party it is urgent - by the Pacific clock", () => {
  const sent = START - 10 * H
  assert.equal(noticeState(group(sent), ORDER, START - 3 * H - 60_000).urgent, false)
  const at3 = noticeState(group(sent), ORDER, START - 3 * H)
  assert.deepEqual([at3.show, at3.urgent, at3.hoursToParty], [true, true, 3])
  // Read as real UTC the column would say the party is at 17:30Z: three hours before that is 14:30Z,
  // which is in fact eleven hours before the party. Not urgent then.
  assert.equal(noticeState(group(sent), ORDER, Date.parse("2030-11-14T14:30:00Z")).urgent, false)
})

test("state · a notice that just went out gets fifteen minutes before anyone is rung", () => {
  const sent = START - 2 * H
  assert.deepEqual(noticeState(group(sent), ORDER, sent + 14 * 60_000), { show: false, urgent: false, waitedMinutes: 14, hoursToParty: 1.8 })
  const after = noticeState(group(sent), ORDER, sent + 15 * 60_000)
  assert.deepEqual([after.show, after.urgent], [true, true])
})

test("state · a cancelled order or a party an hour in is nobody's to chase; no date means only the two-hour rule", () => {
  const sent = START - 10 * H
  assert.equal(noticeState(group(sent), { ...ORDER, order_status: "cancelled" }, START - H).show, false)
  assert.equal(noticeState(group(sent), ORDER, START + 61 * 60_000).show, false)
  assert.equal(noticeState(group(sent), ORDER, START + 30 * 60_000).urgent, true, "the first hour of the party still shows")
  assert.equal(noticeState(group(sent), null, START - H).show, false)
  const hold = noticeState(group(sent), { ...ORDER, event_start: null }, sent + 3 * H)
  assert.deepEqual([hold.show, hold.urgent, hold.hoursToParty], [true, false, null])
})

test("grouping · three saves for one chef on one party are one line, with each change once", () => {
  const sent = START - 30 * H
  const groups = groupNotices([notice("n1", sent), notice("n2", sent + H, { summary: "Makiko 加龙虾尾" }), notice("n3", sent + 2 * H), notice("n4", sent, { staff_member_id: BLU })])
  assert.equal(groups.length, 2)
  const g = groups.find((x) => x.staffId === GARY)!
  assert.equal(g.notices.length, 3)
  assert.equal(g.oldestSentAt, new Date(sent).toISOString())
  assert.equal(noticeSummary(g), "8 位加餐具；Makiko 加龙虾尾")
})

test("no table yet · reads are empty and a confirmation is a no-op, nothing throws", async () => {
  const db = world([], { missing: true })
  assert.deepEqual(await loadOpenNotices(db as never), [])
  assert.deepEqual(await ackNoticesFromPhone(db as never, "+16265550102"), { acked: 0, orderIds: [], staffIds: [GARY] })
  assert.deepEqual(await ringUnackedNotices(db as never, START - H), [])
  assert.deepEqual(db.writes, [])
})

test("open notices · only unconfirmed ones that were actually sent", async () => {
  const sent = START - 5 * H
  const db = world([notice("n1", sent), notice("n2", sent, { acked_at: new Date(sent + 60_000).toISOString() }), { ...notice("n3", sent), sent_at: null }])
  assert.deepEqual((await loadOpenNotices(db as never)).map((n) => n.id), ["n1"])
})

test("the chef's 1 · confirms everything he has open, leaves a line on the order, touches nobody else", async () => {
  const sent = START - 5 * H
  const db = world([notice("n1", sent), notice("n2", sent + H), notice("n3", sent, { staff_member_id: BLU })])
  const out = await ackNoticesFromPhone(db as never, "+1 (626) 555-0102", START - 4 * H)
  assert.deepEqual(out, { acked: 2, orderIds: [ORDER_ID], staffIds: [GARY] })
  const rows = db.tables.chef_change_notices
  assert.deepEqual(rows.map((r) => [r.id, r.acked_at]), [["n1", new Date(START - 4 * H).toISOString()], ["n2", new Date(START - 4 * H).toISOString()], ["n3", null]])
  assert.deepEqual(db.tables.order_events.map((e) => [e.action, e.actor, (e.metadata as Row).notice_id]), [["chef_change_acked", "chef_sms", "n1"], ["chef_change_acked", "chef_sms", "n2"]])
  // A second 1 has nothing left to confirm.
  assert.equal((await ackNoticesFromPhone(db as never, "6265550102")).acked, 0)
})

test("the chef's 1 · a number that is not staff confirms nothing", async () => {
  const db = world([notice("n1", START - 5 * H)])
  assert.deepEqual(await ackNoticesFromPhone(db as never, "+19095550199"), { acked: 0, orderIds: [], staffIds: [] })
  assert.deepEqual(db.writes, [])
})

test("the SMS webhook · a 1 from a staff number confirms; 好的, a question or a photo write nothing", async () => {
  const sent = START - 5 * H
  const db = world([notice("n1", sent)])
  for (const [body, media, kind] of [["好的", 0, "ack"], ["这场要带桌子吗", 0, "message"], ["1", 1, "message"], ["11", 0, "message"]] as const) {
    assert.deepEqual(await onStaffText(db as never, { from: "+16265550102", body, media }), { kind, acked: 0, orderIds: [] }, body)
  }
  assert.deepEqual(db.writes, [], "nothing but a 1 touches the database")
  assert.deepEqual(await onStaffText(db as never, { from: "+16265550102", body: " 1 ", media: 0, now: START - 4 * H }), { kind: "confirm", acked: 1, orderIds: [ORDER_ID] })
  assert.equal(db.tables.chef_change_notices[0].acked_at, new Date(START - 4 * H).toISOString())
  // No notice open, or no table at all: still a confirm, nothing to stamp, no throw.
  assert.deepEqual(await onStaffText(db as never, { from: "+16265550102", body: "1", media: 0 }), { kind: "confirm", acked: 0, orderIds: [] })
  assert.deepEqual(await onStaffText(world([], { missing: true }) as never, { from: "+16265550102", body: "1", media: 0 }), { kind: "confirm", acked: 0, orderIds: [] })
})

test("confirmed by hand · one party only when an order is named", async () => {
  const other = "00000000-0000-4000-8000-0000000000a9"
  const db = world([notice("n1", START - 5 * H), notice("n2", START - 5 * H, { order_id: other })])
  const out = await ackNotices(db as never, { staffIds: [GARY], orderId: other, via: "manual:Darrien" })
  assert.deepEqual([out.acked, out.orderIds], [1, [other]])
  assert.deepEqual(db.tables.chef_change_notices.map((r) => Boolean(r.acked_at)), [false, true])
  assert.equal(db.tables.order_events[0].actor, "manual:Darrien")
})

test("the alarm · its wording, and that the callback ring treats it as an alarm", () => {
  const why = noticeAlarmText("Gary", ORDER)
  assert.equal(why, "师傅未确认：Gary 还没确认 11月14日下午5:30 Irvine（Joyce）那场的改动，派对不到 3 小时就开始。")
  assert.equal(why.startsWith(CHEF_NOTICE_WHY), true)
  assert.equal(isChefNoticeAlarm(why), true)
  assert.equal(isAlarm(why), true)
  assert.equal(isLivePartyAlarm(why), false)
  assert.equal(isChefNoticeAlarm("I'm driving, call me"), false)
  assert.equal(isAlarm("现场：上菜慢"), true)
  // An alarm keeps the live-party hours: a lunch party's three-hour mark can be 7 AM.
  assert.equal(withinRingHours(Date.parse("2030-11-14T15:30:00Z"), LIVE_PARTY_RING_HOURS_PT), true) // 07:30 PST
  assert.equal(withinRingHours(Date.parse("2030-11-14T15:30:00Z")), false)
})

test("the alarm · a customer asking for a call while it is open on their lead gets a request of their own", async () => {
  // No Twilio here: the request is recorded and the ring itself is skipped (not configured, or outside ring hours).
  const saved = { sid: process.env.TWILIO_ACCOUNT_SID, token: process.env.TWILIO_AUTH_TOKEN }
  delete process.env.TWILIO_ACCOUNT_SID
  delete process.env.TWILIO_AUTH_TOKEN
  try {
    const db = fakeSupabase({ lead_touchpoints: [] })
    const alarm = { leadId: LEAD_ID, phone: "6265550102", name: "Gary", why: noticeAlarmText("Gary", ORDER), source: "chef_notice:n1" }
    const customer = { leadId: LEAD_ID, phone: "+16265550100", name: "Joyce", why: "Can you call me please?", source: "sms" }
    assert.equal((await requestCallback(db as never, alarm)).rang, false)
    await requestCallback(db as never, customer)
    const requests = () => db.tables.lead_touchpoints.filter((t) => t.touchpoint_type === "callback_request").map((t) => (t.raw_payload_json as Row).why)
    assert.deepEqual(requests(), [alarm.why, customer.why], "not folded into the alarm")
    // The same customer asking again within half an hour is still one request, as before.
    await requestCallback(db as never, { ...customer, why: "call me" })
    assert.equal(requests().length, 2)
  } finally {
    if (saved.sid !== undefined) process.env.TWILIO_ACCOUNT_SID = saved.sid
    if (saved.token !== undefined) process.env.TWILIO_AUTH_TOKEN = saved.token
  }
})

function ringer(outcome: RingOutcome = { rang: true, attempt: 1, callSids: ["CA1"] }) {
  const calls: Array<{ leadId: string; phone: string; name: string; why: string; source: string }> = []
  return { calls, request: async (_s: unknown, input: { leadId: string; phone: string; name: string; why: string; source: string }) => (calls.push(input), outcome) }
}
const noCallback = async () => null

test("ring · three hours out, unconfirmed: the owner's App rings once for that chef and party, on the order's lead", async () => {
  const sent = START - 20 * H
  const db = world([notice("n1", sent), notice("n2", sent + H)])
  const { calls, request } = ringer()
  const out = await ringUnackedNotices(db as never, START - 2.5 * H, { request, openOf: noCallback })
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0], { leadId: LEAD_ID, phone: "6265550102", name: "Gary", why: noticeAlarmText("Gary", ORDER), source: "chef_notice:n1" })
  assert.deepEqual(out.map((r) => [r.chef, r.rang, r.notices]), [["Gary", true, ["n1", "n2"]]])
  assert.deepEqual(db.tables.lead_watch_notified.map((m) => [m.key, m.kind]), [["cn:ring:n1", "cn"], ["cn:ring:n2", "cn"]])
  // The next sweep ten minutes later does not start over.
  const again = ringer()
  assert.deepEqual(await ringUnackedNotices(db as never, START - 2.3 * H, { request: again.request, openOf: noCallback }), [])
  assert.equal(again.calls.length, 0)
})

test("ring · a new change after the owner was rung rings again; a confirmed one never does", async () => {
  const db = world([notice("n1", START - 20 * H), notice("n2", START - 2 * H)], { marks: [{ key: "cn:ring:n1", kind: "cn", notified_at: new Date(START - 3 * H).toISOString() }] })
  const { calls, request } = ringer()
  const out = await ringUnackedNotices(db as never, START - 1.5 * H, { request, openOf: noCallback })
  assert.deepEqual(out.map((r) => r.notices), [["n2"]])
  assert.equal(calls.length, 1)
  await ackNoticesFromPhone(db as never, "6265550102", START - 1.4 * H)
  const later = ringer()
  assert.deepEqual(await ringUnackedNotices(db as never, START - 1.2 * H, { request: later.request, openOf: noCallback }), [])
})

test("ring · not before three hours, not inside the first fifteen minutes, not once the party has started", async () => {
  const db = world([notice("n1", START - 20 * H)])
  const { calls, request } = ringer()
  assert.deepEqual(await ringUnackedNotices(db as never, START - 3 * H - 60_000, { request, openOf: noCallback }), [])
  assert.deepEqual(await ringUnackedNotices(db as never, START + 5 * 60_000, { request, openOf: noCallback }), [])
  const fresh = world([notice("n1", START - 2 * H)])
  assert.deepEqual(await ringUnackedNotices(fresh as never, START - 2 * H + 10 * 60_000, { request, openOf: noCallback }), [])
  assert.equal(calls.length, 0)
})

test("ring · dry run plans it and touches nothing; a customer's own callback on that lead is not talked over", async () => {
  const db = world([notice("n1", START - 20 * H)])
  const { calls, request } = ringer()
  const plan = await ringUnackedNotices(db as never, START - 2 * H, { dryRun: true, request, openOf: noCallback })
  assert.deepEqual(plan.map((r) => [r.chef, r.rang, r.dryRun]), [["Gary", false, true]])
  assert.equal(calls.length, 0)
  assert.deepEqual(db.writes, [])
  const busy = async () => ({ leadId: LEAD_ID, phone: "+16265550100", name: "Joyce", why: "call me please", requestedAt: START - 2.1 * H, rings: 1, lastRingAt: null, snoozeUntil: null })
  const waited = await ringUnackedNotices(db as never, START - 2 * H, { request, openOf: busy })
  assert.deepEqual(waited.map((r) => r.skipped), ["customer_callback_open"])
  assert.equal(calls.length, 0)
  assert.deepEqual(db.writes, [], "not marked: the next sweep tries again")
})

test("ring · an order with no lead cannot use the callback ring: reported, the inbox line still rings", async () => {
  const db = world([notice("n1", START - 20 * H)], { order: { source_metadata: {} } })
  const { calls, request } = ringer()
  const out = await ringUnackedNotices(db as never, START - 2 * H, { request, openOf: noCallback })
  assert.deepEqual(out.map((r) => r.skipped), ["no_lead"])
  assert.equal(calls.length, 0)
})
