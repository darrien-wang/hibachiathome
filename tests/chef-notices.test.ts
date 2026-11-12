// Layer-2 self-test: chef_change_notices on this side (lib/chef-notices.ts,
// order-flow rebuild 2026-11-11). The invoice app texts the chef what changed
// and files a row; here his "1" stamps acked_at, a notice two hours old with no
// "1" is listed, and one still open three hours before the party rings the
// owner. The table arrives with the invoice app's deploy: until then every
// read is empty and every write a no-op, which is tested too.
// A notice whose text never went out (no sms_sid, summary 【短信没发出去：…】) is
// its own case: the link it carried replaced his old one, so he holds no sheet
// until one reaches him again - the second half of this file.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { CHEF_NOTICE_WHY, LIVE_PARTY_RING_HOURS_PT, isAlarm, isChefNoticeAlarm, isLivePartyAlarm, requestCallback, withinRingHours, type RingOutcome } from "../lib/callback-ring"
import {
  FAILED_SEND_MARK,
  NOTICE_LOOKBACK_MS,
  RESEND_MARGIN_MS,
  ackNotices,
  ackNoticesFromPhone,
  SHEETLESS_LOOKBACK_MS,
  failedSendAlarmText,
  failedSendState,
  groupFailedSends,
  groupNotices,
  isFailedSend,
  loadNoticeBoard,
  loadOpenNoticeGroups,
  loadOpenNotices,
  loadSheetless,
  noticeAlarmText,
  noticeAt,
  noticeState,
  noticeSummary,
  onStaffText,
  ringUnackedNotices,
  sheetReachedSince,
  sheetlessAlarmText,
  type ChefNotice,
  type SentLink,
} from "../lib/chef-notices"
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

function world(notices: Row[], over: { missing?: boolean; marks?: Row[]; order?: Row; assignments?: Row[]; links?: Row[]; noLinksTable?: boolean; events?: Row[] } = {}) {
  return fakeSupabase(
    {
      ...(over.missing ? {} : { chef_change_notices: notices }),
      ...(over.noLinksTable ? {} : { chef_sheet_links: over.links ?? [] }),
      orders: [{ ...ORDER, ...over.order }],
      // Gary and Blu are both on the party unless a test takes one off.
      order_staff_assignments: over.assignments ?? [
        { id: "as1", order_id: ORDER_ID, staff_member_id: GARY, assignment_status: "confirmed" },
        { id: "as2", order_id: ORDER_ID, staff_member_id: BLU, assignment_status: "confirmed" },
      ],
      staff_members: [
        { id: GARY, display_name: "Gary", full_name: null, phone: "6265550102", role: "chef" },
        { id: BLU, display_name: "Blu", full_name: null, phone: "(626) 555-0101", role: "chef" },
      ],
      order_events: over.events ?? [],
      lead_watch_notified: over.marks ?? [],
    },
    { missing: [...(over.missing ? ["chef_change_notices"] : []), ...(over.noLinksTable ? ["chef_sheet_links"] : [])] },
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

test("open notices · a chef taken off the party has nothing left to confirm: not listed, never rung", async () => {
  const sent = START - 20 * H
  const off = [{ id: "as1", order_id: ORDER_ID, staff_member_id: GARY, assignment_status: "cancelled" }, { id: "as2", order_id: ORDER_ID, staff_member_id: BLU, assignment_status: "confirmed" }]
  const db = world([notice("n1", sent), notice("n2", sent, { staff_member_id: BLU })], { assignments: off })
  assert.deepEqual((await loadOpenNoticeGroups(db as never)).map((g) => g.staffId), [BLU])
  const { calls, request } = ringer()
  const out = await ringUnackedNotices(db as never, START - 2 * H, { request, openOf: noCallback })
  assert.deepEqual(out.map((r) => r.chef), ["Blu"])
  assert.equal(calls.length, 1)
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

// ---- a change text that never went out ---------------------------------------------
// Card A's contract (2026-11-11): the row has no sms_sid and its summary opens with
// 【短信没发出去：. The new link was issued and the old one revoked before the text
// bounced, so that chef has no sheet he can open.

const WHY_FAILED = "【短信没发出去：Twilio 21211 号码无效】8 位加餐具"
const failed = (id: string, at: number | null, over: Partial<ChefNotice> = {}): ChefNotice => ({ id, order_id: ORDER_ID, staff_member_id: GARY, summary: WHY_FAILED, sent_at: at === null ? null : new Date(at).toISOString(), acked_at: null, sms_sid: "", ...over })
const at = (ms: number) => new Date(ms).toISOString()
// A prep-sheet link row. Every send is a new row with a new token; the one before it gets revoked_at.
const link = (id: string, over: Partial<SentLink> & Row = {}): SentLink & Row => ({ id, token: `tok-${id}`, order_id: ORDER_ID, staff_member_id: GARY, sent_via: "twilio", sent_at: null, first_opened_at: null, revoked_at: null, stale: false, ...over })

test("failed send · what counts as one: no sms_sid and the summary card A writes", () => {
  assert.equal(WHY_FAILED.startsWith(FAILED_SEND_MARK), true)
  assert.equal(isFailedSend({ summary: WHY_FAILED, sms_sid: "" }), true)
  assert.equal(isFailedSend({ summary: WHY_FAILED, sms_sid: null }), true)
  assert.equal(isFailedSend({ summary: WHY_FAILED }), true)
  assert.equal(isFailedSend({ summary: `  ${WHY_FAILED}`, sms_sid: " " }), true)
  assert.equal(isFailedSend({ summary: WHY_FAILED, sms_sid: "SM0123" }), false, "a text with a Twilio id went out")
  assert.equal(isFailedSend({ summary: "8 位加餐具", sms_sid: "" }), false, "an empty sid alone is not card A's mark")
  assert.equal(isFailedSend({ summary: "8 位加餐具（上次【短信没发出去：…】）", sms_sid: "" }), false, "the mark opens the summary")
  assert.equal(isFailedSend({ summary: null, sms_sid: null }), false)
})

test("failed send · when it happened: sent_at, else the row's created_at, else unknown", () => {
  assert.equal(noticeAt({ sent_at: at(START - 5 * H), created_at: at(START - 6 * H) }), at(START - 5 * H))
  assert.equal(noticeAt({ sent_at: null, created_at: at(START - 6 * H) }), at(START - 6 * H))
  assert.equal(noticeAt({ sent_at: null }), null)
  assert.equal(noticeAt({ sent_at: "not a date", created_at: null }), null)
})

test("failed send · it is not a text waiting for a 1, and one chef on one party is one line", () => {
  const t = START - 30 * H
  const rows = [notice("n1", t - H), failed("f1", t), failed("f2", t + H), failed("f3", t, { staff_member_id: BLU })]
  assert.deepEqual(groupNotices(rows).map((g) => [g.staffId, g.notices.map((n) => n.id)]), [[GARY, ["n1"]]])
  const groups = groupFailedSends(rows)
  assert.deepEqual(groups.map((g) => [g.staffId, g.notices.map((n) => n.id), g.at]), [[GARY, ["f1", "f2"], at(t + H)], [BLU, ["f3"], at(t)]])
  assert.equal(noticeSummary(groups[0]), WHY_FAILED, "the reason and the change, once")
})

test("failed send · a later text that did go out to him on that party makes it history; an earlier one does not", () => {
  const t = START - 30 * H
  assert.deepEqual(groupFailedSends([failed("f1", t), notice("n2", t + H)]), [], "the later text carried a newer link")
  assert.deepEqual(groupFailedSends([notice("n0", t - H), failed("f1", t)]).map((g) => g.notices.map((n) => n.id)), [["f1"]])
  // Blu's text going out says nothing about Gary's.
  assert.deepEqual(groupFailedSends([failed("f1", t), notice("n2", t + H, { staff_member_id: BLU })]).map((g) => g.staffId), [GARY])
  // Two failures, a delivery between them: the second failure stands.
  assert.deepEqual(groupFailedSends([failed("f1", t), notice("n2", t + H), failed("f3", t + 2 * H)]).map((g) => g.notices.map((n) => n.id)), [["f3"]])
  // No time on the row: it cannot be placed against the other texts and is kept.
  assert.deepEqual(groupFailedSends([failed("f1", null), notice("n2", t + H)]).map((g) => [g.notices.map((n) => n.id), g.at]), [[["f1"], null]])
})

test("failed send · state: on the list from the moment it failed, urgent three hours out, same ends as any notice", () => {
  const t = START - 30 * H
  const g = { at: at(t) }
  assert.deepEqual(failedSendState(g, ORDER, t), { show: true, urgent: false, waitedMinutes: 0, hoursToParty: 30 }, "no two-hour wait")
  assert.deepEqual(failedSendState(g, ORDER, t + 40 * 60_000), { show: true, urgent: false, waitedMinutes: 40, hoursToParty: 29.3 })
  assert.equal(failedSendState(g, ORDER, START - 3 * H - 60_000).urgent, false)
  assert.equal(failedSendState(g, ORDER, START - 3 * H).urgent, true)
  // No grace either: there is nothing for him to read and answer.
  assert.deepEqual(failedSendState({ at: at(START - 2 * H) }, ORDER, START - 2 * H + 60_000), { show: true, urgent: true, waitedMinutes: 1, hoursToParty: 2 })
  assert.equal(failedSendState(g, { ...ORDER, order_status: "cancelled" }, START - H).show, false)
  assert.equal(failedSendState(g, ORDER, START + 61 * 60_000).show, false)
  assert.equal(failedSendState(g, ORDER, START + 30 * 60_000).show, true)
  assert.equal(failedSendState(g, null, START - H).show, false)
  assert.deepEqual(failedSendState(g, { ...ORDER, event_start: null }, t + H), { show: true, urgent: false, waitedMinutes: 60, hoursToParty: null })
  assert.deepEqual(failedSendState({ at: null }, ORDER, START - 10 * H), { show: true, urgent: false, waitedMinutes: 0, hoursToParty: 10 })
})

test("he holds a sheet again · a re-send is a new link: what counts is the live one, sent after the failure", () => {
  const t = START - 30 * H
  const g = { orderId: ORDER_ID, staffId: GARY, at: at(t) }
  // Straight after the failure: his old link is revoked, the one the failed text carried is live and never arrived.
  const old = link("L1", { sent_at: at(t - 20 * H), first_opened_at: at(t - 19 * H), revoked_at: at(t) })
  const carried = link("L2", { sent_via: "failed", sent_at: at(t) })
  assert.equal(sheetReachedSince(g, [old, carried]), false)
  // The owner sends it again: L2 is revoked, L3 - another row, another token - is texted to him.
  const resent = link("L3", { sent_at: at(t + 10 * 60_000) })
  assert.notEqual(resent.token, carried.token)
  assert.equal(sheetReachedSince(g, [old, { ...carried, revoked_at: at(t + 10 * 60_000) }, resent]), true)
  assert.equal(sheetReachedSince(g, [link("L3", { sent_via: "manual", sent_at: at(t + 10 * 60_000) })]), true, "handed over by hand counts")
  // That re-send's own text bounces: he holds nothing again.
  assert.equal(sheetReachedSince(g, [link("L3", { sent_via: "failed", sent_at: at(t + 10 * 60_000) })]), false)
  // A re-send that worked, then one more whose text bounced: the one that worked is revoked now.
  assert.equal(sheetReachedSince(g, [{ ...resent, revoked_at: at(t + 20 * 60_000) }, link("L4", { sent_via: "failed", sent_at: at(t + 20 * 60_000) })]), false)
})

test("he holds a sheet again · the link the failed text carried is not its own cure, opening it is", () => {
  const t = START - 30 * H
  const g = { orderId: ORDER_ID, staffId: GARY, at: at(t) }
  // Should card A stamp that link as texted at about the moment the notice failed, it still did not arrive.
  assert.equal(sheetReachedSince(g, [link("L2", { sent_at: at(t + 5_000) })]), false)
  assert.equal(sheetReachedSince(g, [link("L2", { sent_at: at(t + RESEND_MARGIN_MS) })]), false)
  assert.equal(sheetReachedSince(g, [link("L2", { sent_at: at(t + RESEND_MARGIN_MS + 1_000) })]), true)
  // He opened the live link after the failure (someone passed him the URL): he has it.
  assert.equal(sheetReachedSince(g, [link("L2", { sent_via: "failed", sent_at: at(t), first_opened_at: at(t + 3 * 60_000) })]), true)
  // Opened before the failure, or opened on a link that has since been replaced: not in his hands.
  assert.equal(sheetReachedSince(g, [link("L2", { sent_via: "failed", first_opened_at: at(t - 60_000) })]), false)
  assert.equal(sheetReachedSince(g, [link("L1", { first_opened_at: at(t + 3 * 60_000), sent_at: at(t + 2 * 60_000), revoked_at: at(t + 5 * 60_000) })]), false)
  // Somebody else's sheet, or another party's, is not his.
  assert.equal(sheetReachedSince(g, [link("L9", { staff_member_id: BLU, sent_at: at(t + H) })]), false)
  assert.equal(sheetReachedSince(g, [link("L9", { order_id: "00000000-0000-4000-8000-0000000000a9", sent_at: at(t + H) })]), false)
  assert.equal(sheetReachedSince(g, []), false)
})

test("he holds a sheet again · a failed row with no time on it goes by the live link alone", () => {
  const g = { orderId: ORDER_ID, staffId: GARY, at: null }
  assert.equal(sheetReachedSince(g, [link("L2", { sent_via: "failed" })]), false)
  assert.equal(sheetReachedSince(g, [link("L2", { sent_via: "failed", revoked_at: at(START - 9 * H) }), link("L3", { sent_at: at(START - 9 * H) })]), true)
  assert.equal(sheetReachedSince(g, [link("L2", { sent_via: "failed", first_opened_at: at(START - 9 * H) })]), true)
  assert.equal(sheetReachedSince(g, [link("L1", { sent_at: at(START - 20 * H), revoked_at: at(START - 10 * H) })]), false, "a revoked link is not held")
})

test("open notices · a failed row is kept without a sent_at; an unsent row that is not marked failed is not a notice yet", async () => {
  const t = START - 5 * H
  const db = world([failed("f1", null), failed("f2", t), { ...notice("n3", t), sent_at: null }, failed("f4", t, { acked_at: at(t + 60_000) })])
  assert.deepEqual((await loadOpenNotices(db as never)).map((n) => n.id).sort(), ["f1", "f2"])
})

test("open notices · only the last two weeks are read, oldest first: old unconfirmed rows do not pile onto every poll", async () => {
  const now = START - 5 * H
  const rows = [
    notice("recent", now - 2 * H),
    notice("ancient", now - NOTICE_LOOKBACK_MS - H),
    failed("cured-long-ago", now - NOTICE_LOOKBACK_MS - 24 * H),
    failed("today", now - H),
    notice("edge", now - NOTICE_LOOKBACK_MS),
    // No sent_at, dated by created_at only: the window applies to that as well.
    failed("undated-old", null, { created_at: at(now - NOTICE_LOOKBACK_MS - H) }),
    failed("undated-new", null, { created_at: at(now - 30 * 60_000) }),
    failed("no-time-at-all", null),
  ]
  assert.deepEqual((await loadOpenNotices(world(rows) as never, now)).map((n) => n.id), ["no-time-at-all", "edge", "recent", "today", "undated-new"])
  const board = await loadNoticeBoard(world(rows) as never, now)
  assert.deepEqual(board.waiting.map((g) => g.notices.map((n) => n.id)), [["edge", "recent"]])
  assert.deepEqual(board.failed.map((g) => [g.notices.map((n) => n.id), g.at]), [[["no-time-at-all", "today", "undated-new"], at(now - 30 * 60_000)]])
})

test("board · the failed send and the texts waiting for a 1 are read apart; a chef off the party is on neither", async () => {
  const t = START - 20 * H
  const rows = [notice("n1", t - H), failed("f1", t), notice("n2", t, { staff_member_id: BLU })]
  const board = await loadNoticeBoard(world(rows, { links: [link("L2", { sent_via: "failed", sent_at: at(t) })] }) as never)
  assert.deepEqual(board.waiting.map((g) => [g.staffId, g.notices.map((n) => n.id)]), [[GARY, ["n1"]], [BLU, ["n2"]]])
  assert.deepEqual(board.failed.map((g) => [g.staffId, g.notices.map((n) => n.id)]), [[GARY, ["f1"]]])
  const off = [{ id: "as1", order_id: ORDER_ID, staff_member_id: GARY, assignment_status: "cancelled" }, { id: "as2", order_id: ORDER_ID, staff_member_id: BLU, assignment_status: "confirmed" }]
  const after = await loadNoticeBoard(world(rows, { assignments: off }) as never)
  assert.deepEqual([after.waiting.map((g) => g.staffId), after.failed], [[BLU], []])
})

test("board · sending the sheet again clears the failed send, though the link is a different row with a different token", async () => {
  const t = START - 20 * H
  const before = [link("L1", { sent_at: at(t - 20 * H), revoked_at: at(t) }), link("L2", { sent_via: "failed", sent_at: at(t) })]
  assert.equal((await loadNoticeBoard(world([failed("f1", t)], { links: before }) as never)).failed.length, 1)
  const after = [before[0], { ...before[1], revoked_at: at(t + 8 * 60_000) }, link("L3", { sent_at: at(t + 8 * 60_000) })]
  assert.deepEqual((await loadNoticeBoard(world([failed("f1", t)], { links: after }) as never)).failed, [])
  // The row is still unconfirmed in the table - nobody acked it, the sheet answered it.
  assert.equal((await loadOpenNotices(world([failed("f1", t)], { links: after }) as never)).length, 1)
  // When the links cannot be read the line stays: an extra line beats a missing one.
  assert.equal((await loadNoticeBoard(world([failed("f1", t)], { noLinksTable: true }) as never)).failed.length, 1)
})

test("the chef's 1 · does not confirm a text he never got; a later text that reached him covers it", async () => {
  const t = START - 5 * H
  // He answers 1 to the earlier text. The failed one came after it and he has not seen it.
  const db = world([notice("n1", t - H), failed("f1", t)])
  assert.deepEqual(await ackNoticesFromPhone(db as never, "6265550102", t + 60_000), { acked: 1, orderIds: [ORDER_ID], staffIds: [GARY] })
  assert.deepEqual(db.tables.chef_change_notices.map((r) => [r.id, Boolean(r.acked_at)]), [["n1", true], ["f1", false]])
  assert.equal((await loadNoticeBoard(db as never)).failed.length, 1, "still on the list")
  // A failed text followed by one that went out: his 1 answers the newer text, and with it the older change.
  const both = world([failed("f1", t), notice("n2", t + H)])
  assert.equal((await ackNoticesFromPhone(both as never, "6265550102", t + 2 * H)).acked, 2)
  assert.deepEqual(both.tables.chef_change_notices.map((r) => Boolean(r.acked_at)), [true, true])
  // Only a failed text open: his 1 (to something else) stamps nothing.
  const only = world([failed("f1", t)])
  assert.equal((await ackNoticesFromPhone(only as never, "6265550102", t + H)).acked, 0)
  assert.deepEqual(only.writes, [])
})

test("confirmed by hand · a person can vouch for a text that never went out (he got the sheet some other way)", async () => {
  const t = START - 5 * H
  const db = world([notice("n1", t - H), failed("f1", t), failed("f2", t, { staff_member_id: BLU })])
  const out = await ackNotices(db as never, { staffIds: [GARY], via: "manual:Darrien", includeFailed: true, now: t + H })
  assert.equal(out.acked, 2)
  assert.deepEqual(db.tables.chef_change_notices.map((r) => [r.id, Boolean(r.acked_at)]), [["n1", true], ["f1", true], ["f2", false]])
  assert.deepEqual((await loadNoticeBoard(db as never)).failed.map((g) => g.staffId), [BLU])
})

test("ring · a text that never went out, three hours before the party: its own words, once, with his other open texts", async () => {
  assert.equal(failedSendAlarmText("Gary", ORDER), "师傅未确认：Gary 没收到 11月14日下午5:30 Irvine（Joyce）那场的改单短信，手里没有能打开的备料单，派对不到 3 小时就开始。")
  assert.equal(isChefNoticeAlarm(failedSendAlarmText("Gary", ORDER)), true, "rides the same alarm kind: same hours, same dedupe")
  const db = world([notice("n1", START - 20 * H), failed("f1", START - 10 * H)], { links: [link("L2", { sent_via: "failed", sent_at: at(START - 10 * H) })] })
  const { calls, request } = ringer()
  assert.deepEqual(await ringUnackedNotices(db as never, START - 3 * H - 60_000, { request, openOf: noCallback }), [], "not before three hours")
  const out = await ringUnackedNotices(db as never, START - 2.5 * H, { request, openOf: noCallback })
  assert.equal(calls.length, 1, "one call for this chef and this party")
  assert.deepEqual(calls[0], { leadId: LEAD_ID, phone: "6265550102", name: "Gary", why: failedSendAlarmText("Gary", ORDER), source: "chef_notice:f1" })
  assert.deepEqual(out.map((r) => [r.chef, r.failedSend, r.rang, r.notices]), [["Gary", true, true, ["f1", "n1"]]])
  assert.deepEqual(db.tables.lead_watch_notified.map((m) => m.key).sort(), ["cn:ring:f1", "cn:ring:n1"])
  const again = ringer()
  assert.deepEqual(await ringUnackedNotices(db as never, START - 2.3 * H, { request: again.request, openOf: noCallback }), [])
})

test("ring · a failure inside three hours rings on the next sweep, no fifteen-minute grace; a sheet sent again means no call", async () => {
  const t = START - 2 * H
  const links = [link("L2", { sent_via: "failed", sent_at: at(t) })]
  const { calls, request } = ringer()
  const out = await ringUnackedNotices(world([failed("f1", t)], { links }) as never, t + 2 * 60_000, { request, openOf: noCallback })
  assert.deepEqual(out.map((r) => [r.failedSend, r.rang]), [[true, true]])
  assert.equal(calls.length, 1)
  const fixed = [{ ...links[0], revoked_at: at(t + 5 * 60_000) }, link("L3", { sent_at: at(t + 5 * 60_000) })]
  const quiet = ringer()
  assert.deepEqual(await ringUnackedNotices(world([failed("f1", t)], { links: fixed }) as never, t + 10 * 60_000, { request: quiet.request, openOf: noCallback }), [])
  assert.equal(quiet.calls.length, 0)
  // Dry run: planned, nothing written, nobody called.
  const dry = world([failed("f1", t)], { links })
  const plan = await ringUnackedNotices(dry as never, t + 2 * 60_000, { dryRun: true, request: quiet.request, openOf: noCallback })
  assert.deepEqual(plan.map((r) => [r.failedSend, r.dryRun, r.why]), [[true, true, failedSendAlarmText("Gary", ORDER)]])
  assert.deepEqual(dry.writes, [])
})

// ---- a chef a sheet never reached (owner 2026-11-12, D-1112-01) --------------------------
// Reassigning sends the new chef his sheet at once; when that - or any sheet text to a chef on
// a coming party - does not get to him, he holds no sheet he can open, and it is listed the
// same way as a change text that never went out.

const LIVE_UNTIL = at(START + 6 * H)
const sentEvent = (linkId: string, error: string, when: number): Row => ({ id: `e-${linkId}`, order_id: ORDER_ID, action: "chef_sheet_sent", created_at: at(when), metadata: { link_id: linkId, staff_member_id: GARY, sms: { error } } })
const refusedEvent = (when: number, error = "备料单没发：菜单还空着。改好发票再发，或确认后 force 发。"): Row => ({ id: `r-${when}`, order_id: ORDER_ID, action: "chef_sheet_send_failed", created_at: at(when), metadata: { staff_member_id: GARY, staff_name: "Gary", error, code: "order_lint" } })

test("sheetless · a sheet text that bounced on a coming party: listed, with what Twilio said", async () => {
  const t = START - 20 * H
  const db = world([], { links: [link("L2", { sent_via: "failed", sent_at: at(t), expires_at: LIVE_UNTIL })], events: [sentEvent("L2", "Twilio 21211: invalid 'To' number", t)] })
  assert.deepEqual(await loadSheetless(db as never, t + 10 * 60_000), [{ orderId: ORDER_ID, staffId: GARY, at: at(t), reason: "Twilio 21211: invalid 'To' number", mark: "link:L2" }])
  // He opened it after all (someone passed him the URL), or it has expired: not listed.
  assert.deepEqual(await loadSheetless(world([], { links: [link("L2", { sent_via: "failed", sent_at: at(t), expires_at: LIVE_UNTIL, first_opened_at: at(t + H) })] }) as never, t + 2 * H), [])
  assert.deepEqual(await loadSheetless(world([], { links: [link("L2", { sent_via: "failed", sent_at: at(t), expires_at: at(t + H) })] }) as never, t + 2 * H), [])
  assert.deepEqual(db.writes, [])
})

test("sheetless · a send that made no link at all: listed from the order's timeline, with the reason", async () => {
  const t = START - 20 * H
  const out = await loadSheetless(world([], { links: [link("L1", { staff_member_id: BLU, first_opened_at: at(t - H) })], events: [refusedEvent(t)] }) as never, t + 60_000)
  assert.deepEqual(out, [{ orderId: ORDER_ID, staffId: GARY, at: at(t), reason: "备料单没发：菜单还空着。改好发票再发，或确认后 force 发。", mark: `send:${ORDER_ID}:${GARY}:${at(t)}` }])
  // A week on it is history.
  assert.deepEqual(await loadSheetless(world([], { events: [refusedEvent(t)] }) as never, t + SHEETLESS_LOOKBACK_MS + H), [])
})

test("sheetless · gone once he holds a sheet that reached him, is off the party, or holds a stale one (the change flow's)", async () => {
  const t = START - 20 * H
  // Sent again and it went through: the failed link was replaced (revoked), the new one is live.
  const resent = [link("L2", { sent_via: "failed", sent_at: at(t), expires_at: LIVE_UNTIL, revoked_at: at(t + H) }), link("L3", { sent_at: at(t + H), expires_at: LIVE_UNTIL })]
  assert.deepEqual(await loadSheetless(world([], { links: resent, events: [refusedEvent(t - H)] }) as never, t + 2 * H), [])
  const off = [{ id: "as1", order_id: ORDER_ID, staff_member_id: GARY, assignment_status: "cancelled" }]
  assert.deepEqual(await loadSheetless(world([], { assignments: off, events: [refusedEvent(t)] }) as never, t + H), [])
  // A helper's text bouncing is not a chef without a sheet: he works from the lead's (易非 has no phone on file).
  const helper = [{ id: "as1", order_id: ORDER_ID, staff_member_id: GARY, assignment_status: "confirmed", assignment_role: "assistant_chef" }]
  assert.deepEqual(await loadSheetless(world([], { assignments: helper, links: [link("L2", { sent_via: "failed", sent_at: at(t), expires_at: LIVE_UNTIL })] }) as never, t + H), [])
  assert.deepEqual(await loadSheetless(world([], { links: [link("L3", { stale: true, sent_at: at(t - H), expires_at: LIVE_UNTIL })], events: [refusedEvent(t)] }) as never, t + H), [])
})

test("board · a failed change text and the dead link it left are one line, the notice's", async () => {
  const t = START - 20 * H
  const db = world([failed("f1", t)], { links: [link("L2", { sent_via: "failed", sent_at: at(t), expires_at: LIVE_UNTIL })] })
  const board = await loadNoticeBoard(db as never, t + 60_000)
  assert.deepEqual([board.failed.map((g) => g.staffId), board.sheetless], [[GARY], []])
  // Blu's sheet text bounced on the same party: his own line.
  const both = world([failed("f1", t)], { links: [link("L2", { sent_via: "failed", sent_at: at(t), expires_at: LIVE_UNTIL }), link("L9", { staff_member_id: BLU, sent_via: "failed", sent_at: at(t), expires_at: LIVE_UNTIL })] })
  assert.deepEqual((await loadNoticeBoard(both as never, t + 60_000)).sheetless.map((g) => g.staffId), [BLU])
})

test("ring · a chef a sheet never reached, three hours before the party: once, in its own words", async () => {
  const t = START - 10 * H
  const db = world([], { links: [link("L2", { sent_via: "failed", sent_at: at(t), expires_at: LIVE_UNTIL })] })
  assert.equal(sheetlessAlarmText("Gary", ORDER), "师傅未确认：Gary 没收到 11月14日下午5:30 Irvine（Joyce）那场的备料单，手里没有能打开的，派对不到 3 小时就开始。")
  const { calls, request } = ringer()
  assert.deepEqual(await ringUnackedNotices(db as never, START - 3 * H - 60_000, { request, openOf: noCallback }), [])
  const out = await ringUnackedNotices(db as never, START - 2.5 * H, { request, openOf: noCallback })
  assert.deepEqual(calls.map((c) => [c.why, c.source]), [[sheetlessAlarmText("Gary", ORDER), "chef_notice:sheet:link:L2"]])
  assert.deepEqual(out.map((r) => [r.chef, r.failedSend, r.notices]), [["Gary", true, ["sheet:link:L2"]]])
  assert.deepEqual(db.tables.lead_watch_notified.map((m) => m.key), ["cn:ring:sheet:link:L2"])
  const again = ringer()
  assert.deepEqual(await ringUnackedNotices(db as never, START - 2.3 * H, { request: again.request, openOf: noCallback }), [])
})
