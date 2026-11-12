// Layer-2 self-test: the inbox rules of the order-flow rebuild (lib/inbox.ts,
// 2026-11-11, D-1111-03), end to end through computeInbox.
//   - a chef's text is listed above the customers and rings from 15 minutes on
//     (one asking for a fresh prep sheet had sat 18 hours, unseen)
//   - an open change request stays until it is handled, with what changed; one
//     filed inside 48 hours and held for a person rings (12 were open on 11-11,
//     all past the old 24-hour window)
//   - a change notice the chef has not confirmed shows after two hours and rings
//     inside three hours of the party - and nothing breaks while that table does
//     not exist yet
//   - a change text that never went out (card A marks the row) is listed at once
//     with the chefs' items and rings: the link it carried replaced his old one,
//     so he holds no sheet until one reaches him again
// In-memory database; Twilio is two canned lists behind a replaced fetch.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { computeInbox, type InboxEvent } from "../lib/inbox"
import { changeRequestBody, changeRequestOpen, changeRequestRings, changeSummaryText, customerNoteOf } from "../lib/change-requests"
import type { TwilioMessage } from "../lib/sms-thread"
import { fakeSupabase, type Row } from "./fixtures/fake-supabase"

const OURS = "+12137707788"
// Not 555 numbers: the inbox drops those as our own test traffic. Exchange 000 is never assigned either.
const GARY_PHONE = "+16260000102"
const CUSTOMER = "+19090000142"
const GARY = "00000000-0000-4000-8000-0000000000b2"
const BLU = "00000000-0000-4000-8000-0000000000b1"
const BLU_PHONE = "+16260000101"
const ORDER_ID = "00000000-0000-4000-8000-0000000000a1"
// Noon Pacific on Wed Nov 13 2030. The party below is 5:30 PM Pacific the next day: 29.5 hours out.
const NOW = Date.parse("2030-11-13T20:00:00Z")
const MIN = 60_000
const H = 60 * MIN
const iso = (ms: number) => new Date(ms).toISOString()
const ORDER = { id: ORDER_ID, order_no: "RH-20301105-0001", customer_name: "Joyce Lin", customer_phone: "+16265550100", event_start: "2030-11-14T17:30:00+00:00", event_address: "12 Test Way, Irvine, CA 92602", order_status: "active", deposit_status: "paid_verified", source_ref: "web-1", source_metadata: {}, created_at: "2030-11-05T00:00:00Z" }

const out = (to: string, at: number, body: string): TwilioMessage => ({ sid: `SMo${at}`, direction: "outbound-api", body, from: OURS, to, status: "delivered", date_sent: iso(at), date_created: iso(at) })
const inb = (from: string, at: number, body: string, media = 0): TwilioMessage => ({ sid: `SMi${at}${body.length}`, direction: "inbound", body, from, to: OURS, status: "received", date_sent: iso(at), date_created: iso(at), num_media: String(media) })

type World = { tables?: Record<string, Row[]>; missing?: string[]; outbound?: TwilioMessage[]; inbound?: TwilioMessage[] }

async function inbox(w: World, now = NOW) {
  const db = fakeSupabase(
    {
      staff_members: [{ id: GARY, display_name: "Gary", full_name: null, phone: "6260000102", role: "chef" }],
      orders: [ORDER],
      // Gary is the chef on the party unless a test says otherwise.
      order_staff_assignments: [{ id: "as1", order_id: ORDER_ID, staff_member_id: GARY, assignment_status: "confirmed" }],
      ...(w.tables ?? {}),
    },
    { missing: w.missing ?? [] },
  )
  const saved = { fetch: globalThis.fetch, sid: process.env.TWILIO_ACCOUNT_SID, token: process.env.TWILIO_AUTH_TOKEN, caller: process.env.TWILIO_CALLER_ID }
  process.env.TWILIO_ACCOUNT_SID = "ACtest"
  process.env.TWILIO_AUTH_TOKEN = "test"
  process.env.TWILIO_CALLER_ID = OURS
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input)
    if (!url.startsWith("https://api.twilio.com/")) throw new Error(`inbox test: unexpected request ${url}`)
    const list = url.includes("Messages.json?From=") ? (w.outbound ?? []) : (w.inbound ?? [])
    return new Response(JSON.stringify({ messages: list }), { headers: { "content-type": "application/json" } })
  }) as typeof fetch
  try {
    const result = await computeInbox(db as never, now, { includeFresh: true, noCache: true })
    assert.deepEqual(db.writes, [], "the inbox only reads")
    return result
  } finally {
    globalThis.fetch = saved.fetch
    for (const [k, v] of [["TWILIO_ACCOUNT_SID", saved.sid], ["TWILIO_AUTH_TOKEN", saved.token], ["TWILIO_CALLER_ID", saved.caller]] as const) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
}
const kinds = (events: InboxEvent[]) => events.map((e) => e.kind)
const one = (events: InboxEvent[], kind: InboxEvent["kind"]) => {
  const hits = events.filter((e) => e.kind === kind)
  assert.equal(hits.length, 1, `${kind}: ${JSON.stringify(events.map((e) => [e.kind, e.title]))}`)
  return hits[0]
}

// ---- [chef] --------------------------------------------------------------------

test("chef · a chef's text is listed above a customer who has waited longer, and rings from 15 minutes on", async () => {
  const inbound = [inb(GARY_PHONE, NOW - 20 * MIN, "备料单打不开，再发一次"), inb(CUSTOMER, NOW - 45 * MIN, "Do you bring the propane?")]
  const { events, counts } = await inbox({ inbound })
  assert.deepEqual(kinds(events), ["chef", "sms"])
  const chef = events[0]
  assert.equal(chef.title, "师傅 Gary 等了 20 分钟")
  assert.equal(chef.body, "备料单打不开，再发一次")
  assert.equal(chef.ring, true)
  assert.equal(chef.phone, GARY_PHONE)
  assert.equal(chef.url, `/admin?tab=chefs&chef=${GARY}&ctab=sms`)
  assert.equal(counts.chefTexts, 1)
  assert.equal(counts.unreplied, 1, "the customer count is the customers'")
})

test("chef · before 15 minutes it is listed, first, and quiet", async () => {
  const inbound = [inb(GARY_PHONE, NOW - 10 * MIN, "这场要带桌子吗"), inb(CUSTOMER, NOW - 45 * MIN, "Do you bring the propane?")]
  const { events } = await inbox({ inbound })
  assert.deepEqual(events.map((e) => [e.kind, e.ring]), [["chef", false], ["sms", true]])
})

test("chef · a text after midnight is on the list and does not ring until 7 AM Pacific", async () => {
  const oneAm = Date.parse("2030-11-14T09:00:00Z") // 1 AM PST
  const night = await inbox({ inbound: [inb(GARY_PHONE, oneAm - 40 * MIN, "到家了，现金 $800 明天给你")] }, oneAm)
  assert.deepEqual(night.events.map((e) => [e.kind, e.ring, e.urgent]), [["chef", false, true]])
  const sevenAm = Date.parse("2030-11-14T15:00:00Z")
  const morning = await inbox({ inbound: [inb(GARY_PHONE, sevenAm - 100 * MIN, "到家了，现金 $800 明天给你")] }, sevenAm)
  assert.equal(one(morning.events, "chef").ring, true)
})

test("chef · a text from 1 AM that nobody answered starts ringing at 7, not at the next three-hour window", async () => {
  const sevenAm = Date.parse("2030-11-14T15:00:00Z")
  const text = [inb(GARY_PHONE, sevenAm - 6 * H, "到家了，现金 $800 明天给你")]
  assert.equal(one((await inbox({ inbound: text }, sevenAm - MIN)).events, "chef").ring, false, "6:59 AM")
  assert.equal(one((await inbox({ inbound: text }, sevenAm)).events, "chef").ring, true, "7:00 AM")
})

test("chef · 好的 and a bare 1 are not waiting on anyone; our reply closes a question", async () => {
  assert.deepEqual(kinds((await inbox({ outbound: [out(GARY_PHONE, NOW - 30 * MIN, "明天早 30 分钟到")], inbound: [inb(GARY_PHONE, NOW - 20 * MIN, "好的")] })).events), [])
  assert.deepEqual(kinds((await inbox({ inbound: [inb(GARY_PHONE, NOW - 20 * MIN, "1")] })).events), [])
  const answered = await inbox({ inbound: [inb(GARY_PHONE, NOW - 20 * MIN, "这场要带桌子吗")], outbound: [out(GARY_PHONE, NOW - 5 * MIN, "要带，两张")] })
  assert.deepEqual(kinds(answered.events), [])
})

test("chef · an automatic change notice after his question does not hide it", async () => {
  const { events } = await inbox({ inbound: [inb(GARY_PHONE, NOW - 20 * MIN, "这场要带桌子吗")], outbound: [out(GARY_PHONE, NOW - 5 * MIN, "11月14日 Irvine 那场改了：加 2 位。回 1 确认")] })
  assert.equal(one(events, "chef").body, "这场要带桌子吗")
})

test("chef · marked handled by a person: gone, until he texts again", async () => {
  const marks = [{ key: "chef:ack:6260000102", kind: "chef", notified_at: iso(NOW - 10 * MIN) }]
  assert.deepEqual(kinds((await inbox({ inbound: [inb(GARY_PHONE, NOW - 20 * MIN, "这场要带桌子吗")], tables: { lead_watch_notified: marks } })).events), [])
  const again = await inbox({ inbound: [inb(GARY_PHONE, NOW - 20 * MIN, "这场要带桌子吗"), inb(GARY_PHONE, NOW - 3 * MIN, "还有餐具带几套")], tables: { lead_watch_notified: marks } })
  assert.equal(one(again.events, "chef").body, "还有餐具带几套")
})

test("chef · 收到 instead of 1 while a change notice is open is shown, for a person to decide", async () => {
  const notices = [{ id: "n1", order_id: ORDER_ID, staff_member_id: GARY, summary: "8 位加餐具", sent_at: iso(NOW - 40 * MIN), acked_at: null }]
  const { events } = await inbox({ inbound: [inb(GARY_PHONE, NOW - 30 * MIN, "收到")], outbound: [out(GARY_PHONE, NOW - 40 * MIN, "11月14日 Irvine 那场改了：8 位加餐具。回 1 确认")], tables: { chef_change_notices: notices } })
  const chef = one(events, "chef")
  assert.equal(chef.body, "回了「收到」，没回 1：他还有改动没确认，算不算确认要人定")
  assert.equal(chef.explain, true)
  // Once it is confirmed (his 1, or a person's), the 收到 is just an acknowledgement again.
  const done = await inbox({ inbound: [inb(GARY_PHONE, NOW - 30 * MIN, "收到")], tables: { chef_change_notices: [{ ...notices[0], acked_at: iso(NOW - 5 * MIN) }] } })
  assert.deepEqual(kinds(done.events), [])
})

// ---- change requests -----------------------------------------------------------

const request = (id: string, createdAt: number, over: Row = {}): Row => ({
  id,
  order_id: ORDER_ID,
  external_order_id: null,
  request_source: "order_page",
  status: "received",
  customer_name: "Joyce Lin",
  customer_message: "Submitted from the party planner: 10 adults, 0 kids 5-12. 10/10 guests have picked proteins.",
  change_summary: [{ field: "guest_count", label: "Guest Count", before: "8 adults + 2 kids", after: "10 adults + 2 kids" }],
  created_at: iso(createdAt),
  ...over,
})

test("change · a request held inside 48 hours rings, with what changed and what the customer wrote", async () => {
  const held = request("r1", NOW - 40 * MIN, {
    request_source: "order_page_within_48h",
    customer_message: "⏰ WITHIN 48H OF EVENT — customer requests this change, needs staff confirmation before it takes effect.\n\nSurprise birthday, please come in by the side gate\n\nSubmitted from the party planner: 10 adults, 2 kids 5-12. 12/12 guests have picked proteins.",
  })
  const { events, counts } = await inbox({ tables: { invoice_update_requests: [held] } })
  const e = one(events, "order_change")
  assert.equal(e.title, "改单等确认 · Joyce Lin")
  assert.equal(e.body, "RH-20301105-0001 · Thu, Nov 14 5:30 PM（还有 30 小时） · 48 小时内提交，确认后才写进订单 · Guest Count: 8 adults + 2 kids → 10 adults + 2 kids · 留言：Surprise birthday, please come in by the side gate")
  assert.equal(e.ring, true)
  assert.equal(e.urgent, true)
  assert.equal(e.explain, true)
  assert.equal(e.orderId, ORDER_ID)
  assert.equal(e.url, `/admin?tab=orders&order=${ORDER_ID}`)
  assert.deepEqual([counts.changedOrders, counts.heldChanges], [1, 1])
})

test("change · an open request does not fall off after a day: five days old, still listed, quiet", async () => {
  const far = { ...ORDER, event_start: "2030-11-28T18:00:00+00:00" }
  const { events, counts } = await inbox({ tables: { orders: [far], invoice_update_requests: [request("r1", NOW - 5 * 24 * H)] } })
  const e = one(events, "order_change")
  assert.equal(e.title, "客户改单 · Joyce Lin")
  assert.equal(e.ring, false)
  assert.equal(e.waitedMinutes, 5 * 24 * 60)
  assert.deepEqual([counts.changedOrders, counts.heldChanges], [1, 0])
})

test("change · three submits on one order are one line; once a person has confirmed the held one it stops ringing", async () => {
  const rows = [
    request("r1", NOW - 30 * H, { change_summary: [{ field: "no_material_changes", label: "No Material Changes", before: "Latest stored values", after: "Submitted values are the same as existing records" }] }),
    request("r2", NOW - 20 * H),
    request("r3", NOW - 2 * H, { request_source: "order_page_within_48h", status: "confirmed_in_progress", change_summary: ["Makiko 加龙虾尾", "8 位加餐具"] }),
  ]
  const { events, counts } = await inbox({ tables: { invoice_update_requests: rows } })
  const e = one(events, "order_change")
  assert.equal(e.key, "change:r3")
  assert.equal(e.title, "客户改单 · Joyce Lin")
  assert.match(e.body, /Guest Count: 8 adults \+ 2 kids → 10 adults \+ 2 kids；Makiko 加龙虾尾；8 位加餐具 · 共 3 次提交$/)
  assert.doesNotMatch(e.body, /没有实质改动/)
  assert.equal(e.ring, false)
  assert.equal(counts.heldChanges, 0)
})

test("change · gone when nothing can be done: order cancelled, party three hours in, or tied to no order and a day old", async () => {
  const req = [request("r1", NOW - 6 * H, { request_source: "order_page_within_48h" })]
  assert.deepEqual(kinds((await inbox({ tables: { orders: [{ ...ORDER, order_status: "cancelled" }], invoice_update_requests: req } })).events), [])
  // 5:30 PM Pacific on the 14th is 01:30Z on the 15th; at 04:31Z it started three hours ago.
  assert.deepEqual(kinds((await inbox({ tables: { invoice_update_requests: req } }, Date.parse("2030-11-15T04:31:00Z"))).events), [])
  assert.deepEqual(kinds((await inbox({ tables: { invoice_update_requests: req } }, Date.parse("2030-11-15T04:00:00Z"))).events), ["order_change"])
  const orphan = request("r9", NOW - 25 * H, { order_id: null })
  assert.deepEqual(kinds((await inbox({ tables: { invoice_update_requests: [orphan] } })).events), [])
  assert.deepEqual(kinds((await inbox({ tables: { invoice_update_requests: [request("r9", NOW - 2 * H, { order_id: null })] } })).events), ["order_change"])
})

test("change · a request filed by the website reference finds its order through source_ref", async () => {
  const { events } = await inbox({ tables: { invoice_update_requests: [request("r1", NOW - 3 * 24 * H, { order_id: null, external_order_id: "web-1" })] } })
  assert.equal(one(events, "order_change").orderId, ORDER_ID)
})

test("change rules · pure", () => {
  const held = { status: "received", request_source: "order_page_within_48h", created_at: iso(NOW - H) }
  assert.equal(changeRequestOpen(held, { event_start: null, order_status: "active" }, NOW), true, "a date on hold is still a party to come")
  assert.equal(changeRequestOpen({ ...held, status: "updated_chef_notified" }, { event_start: ORDER.event_start, order_status: "active" }, NOW), false)
  assert.equal(changeRequestRings(held, 60, NOW), true)
  assert.equal(changeRequestRings({ ...held, request_source: "order_page" }, 60, NOW), false)
  assert.equal(changeRequestRings(held, 300, Date.parse("2030-11-14T11:00:00Z")), false, "3 AM Pacific, past the first three hours: it waits for the morning")
  assert.equal(changeRequestRings(held, 20, Date.parse("2030-11-14T09:00:00Z")), false, "1 AM Pacific: a party page saved at night rings from 7, not now")
  assert.equal(changeRequestRings(held, 20, Date.parse("2030-11-14T15:00:00Z")), true, "7 AM Pacific")
  assert.equal(changeSummaryText([{ field: "special_notes", label: "Special Notes", before: "Not provided", after: "1 kid aged 3-4 (free)" }]), "Special Notes: 1 kid aged 3-4 (free)")
  assert.equal(changeSummaryText([{ field: "no_material_changes", label: "No Material Changes" }]), "摘要：没有实质改动")
  assert.equal(changeSummaryText(null), "")
  assert.equal(customerNoteOf("Submitted from the party planner: 8 adults."), "")
  assert.equal(customerNoteOf("Gate code 1234\n\nSubmitted from the party planner: 8 adults."), "Gate code 1234")
  assert.equal(changeRequestBody([{ change_summary: [], customer_message: null }]), "")
})

// ---- chef_change_notices --------------------------------------------------------

const noticeRow = (id: string, sentAt: number, over: Row = {}): Row => ({ id, order_id: ORDER_ID, staff_member_id: GARY, summary: "8 位加餐具", sent_at: iso(sentAt), acked_at: null, ...over })

test("notice · two hours without a 1: listed under the chef, quiet", async () => {
  const young = await inbox({ tables: { chef_change_notices: [noticeRow("n1", NOW - 119 * MIN)] } })
  assert.deepEqual(kinds(young.events), [])
  const { events, counts } = await inbox({ tables: { chef_change_notices: [noticeRow("n1", NOW - 130 * MIN)] } })
  const e = one(events, "chef_notice")
  assert.equal(e.title, "师傅没确认改动 · Gary")
  assert.equal(e.body, "11月14日下午5:30 Irvine（Joyce） · 8 位加餐具 · 发出 2 小时没回 1")
  assert.deepEqual([e.ring, e.urgent, e.explain], [false, false, true])
  assert.equal(e.phone, GARY_PHONE)
  assert.equal(e.orderId, ORDER_ID)
  assert.equal(e.key, `chef-notice:${ORDER_ID}:${GARY}`)
  assert.equal(counts.chefNotices, 1)
})

test("notice · inside three hours of the party it rings, and sits above the customers", async () => {
  // 2.5 hours before 5:30 PM Pacific on the 14th.
  const at = Date.parse("2030-11-15T01:30:00Z") - 2.5 * H
  const { events } = await inbox({ tables: { chef_change_notices: [noticeRow("n1", at - 40 * MIN)] }, inbound: [inb(CUSTOMER, at - 30 * MIN, "Do you bring the propane?")] }, at)
  assert.deepEqual(kinds(events), ["chef_notice", "sms"])
  assert.equal(events[0].body, "11月14日下午5:30 Irvine（Joyce） · 离开场 3 小时 · 8 位加餐具 · 发出 40 分钟没回 1")
  assert.deepEqual([events[0].ring, events[0].urgent], [true, true])
})

test("notice · confirmed, cancelled or not there at all: nothing shown, nothing broken", async () => {
  assert.deepEqual(kinds((await inbox({ tables: { chef_change_notices: [noticeRow("n1", NOW - 5 * H, { acked_at: iso(NOW - 4 * H) })] } })).events), [])
  // Reassigned after the notice went out: he is off the party, there is nothing for him to confirm.
  const offParty = [{ id: "as1", order_id: ORDER_ID, staff_member_id: GARY, assignment_status: "cancelled" }]
  assert.deepEqual(kinds((await inbox({ tables: { chef_change_notices: [noticeRow("n1", NOW - 5 * H)], order_staff_assignments: offParty } })).events), [])
  assert.deepEqual(kinds((await inbox({ tables: { orders: [{ ...ORDER, order_status: "cancelled" }], chef_change_notices: [noticeRow("n1", NOW - 5 * H)] } })).events), [])
  // Card A not deployed: the table does not exist. The rest of the inbox still answers.
  const { events, counts } = await inbox({ missing: ["chef_change_notices"], inbound: [inb(GARY_PHONE, NOW - 20 * MIN, "备料单打不开，再发一次")] })
  assert.deepEqual(kinds(events), ["chef"])
  assert.equal(counts.chefNotices, 0)
})

// ---- a change text that never went out -------------------------------------------
// Card A's mark (2026-11-11): no sms_sid, summary opening with 【短信没发出去：. By then the
// new link is issued and his old one revoked, so the chef has no sheet he can open.

const WHY_FAILED = "【短信没发出去：Twilio 21211 号码无效】8 位加餐具"
const failedRow = (id: string, at: number, over: Row = {}): Row => ({ id, order_id: ORDER_ID, staff_member_id: GARY, summary: WHY_FAILED, sent_at: iso(at), acked_at: null, sms_sid: "", ...over })
// Prep-sheet links: every send is a new row with a new token, and the one before it gets revoked_at.
const linkRow = (id: string, over: Row = {}): Row => ({ id, token: `tok-${id}`, order_id: ORDER_ID, staff_member_id: GARY, sent_via: "twilio", sent_at: null, first_opened_at: null, revoked_at: null, stale: false, ...over })
// What the failed change text leaves behind: the old link revoked, the new one live and never delivered.
const afterFailure = (at: number): Row[] => [linkRow("L1", { sent_at: iso(at - 20 * H), first_opened_at: iso(at - 19 * H), revoked_at: iso(at) }), linkRow("L2", { sent_via: "failed", sent_at: iso(at) })]

test("unsent · listed the moment it fails, in its own words, and it rings - no two-hour wait", async () => {
  const at = NOW - 3 * MIN
  const { events, counts } = await inbox({ tables: { chef_change_notices: [failedRow("f1", at)], chef_sheet_links: afterFailure(at) } })
  const e = one(events, "chef_unsent")
  assert.equal(e.title, "师傅没收到改单短信 · Gary")
  assert.equal(e.body, "他手里现在没有能打开的备料单 · 11月14日下午5:30 Irvine（Joyce） · 【短信没发出去：Twilio 21211 号码无效】8 位加餐具")
  assert.deepEqual([e.ring, e.urgent, e.explain, e.waitedMinutes], [true, true, true, 3])
  assert.equal(e.key, `chef-unsent:${ORDER_ID}:${GARY}`)
  assert.equal(e.at, iso(at))
  assert.equal(e.url, `/admin?tab=orders&order=${ORDER_ID}`)
  assert.equal(e.phone, GARY_PHONE)
  assert.equal(e.orderId, ORDER_ID)
  assert.deepEqual([counts.chefUnsent, counts.chefNotices, counts.chefTexts], [1, 0, 0])
  // The very minute it failed.
  assert.equal(one((await inbox({ tables: { chef_change_notices: [failedRow("f1", NOW)], chef_sheet_links: afterFailure(NOW) } })).events, "chef_unsent").ring, true)
})

test("unsent · it sits with the chefs' items, above a customer who has waited longer", async () => {
  const staff = [{ id: GARY, display_name: "Gary", full_name: null, phone: "6260000102", role: "chef" }, { id: BLU, display_name: "Blu", full_name: null, phone: "6260000101", role: "chef" }]
  const { events } = await inbox({
    tables: { staff_members: staff, chef_change_notices: [failedRow("f1", NOW - 3 * MIN)], chef_sheet_links: afterFailure(NOW - 3 * MIN) },
    inbound: [inb(BLU_PHONE, NOW - 20 * MIN, "这场要带桌子吗"), inb(CUSTOMER, NOW - 45 * MIN, "Do you bring the propane?")],
  })
  assert.deepEqual(events.map((e) => [e.kind, e.ring]), [["chef_unsent", true], ["chef", true], ["sms", true]])
})

test("unsent · inside three hours of the party the line says how long is left, and it rings the whole time", async () => {
  const start = Date.parse("2030-11-15T01:30:00Z")
  const at = start - 2.5 * H
  const { events } = await inbox({ tables: { chef_change_notices: [failedRow("f1", at - 5 * MIN)], chef_sheet_links: afterFailure(at - 5 * MIN) } }, at)
  assert.equal(one(events, "chef_unsent").body, "他手里现在没有能打开的备料单 · 11月14日下午5:30 Irvine（Joyce） · 离开场 3 小时 · 【短信没发出去：Twilio 21211 号码无效】8 位加餐具")
  // It failed at 9:30 AM and nobody fixed it. Five and a half hours on it is between ring windows...
  const morning = start - 8 * H
  const tables = { chef_change_notices: [failedRow("f1", morning)], chef_sheet_links: afterFailure(morning) }
  assert.equal(one((await inbox({ tables }, start - 3 * H - 60 * MIN)).events, "chef_unsent").ring, false, "four hours out, between windows")
  // ...but three hours from the party it is as loud as an unconfirmed notice is.
  assert.equal(one((await inbox({ tables }, at)).events, "chef_unsent").ring, true)
})

test("unsent · the same hours as the other new alarms: on the list all night, silent 11 PM-7 AM Pacific, ringing from 7", async () => {
  const oneAm = Date.parse("2030-11-14T09:00:00Z")
  const tables = { chef_change_notices: [failedRow("f1", oneAm - 10 * MIN)], chef_sheet_links: afterFailure(oneAm - 10 * MIN) }
  assert.deepEqual((await inbox({ tables }, oneAm)).events.map((e) => [e.kind, e.ring, e.urgent]), [["chef_unsent", false, true]])
  const sevenAm = Date.parse("2030-11-14T15:00:00Z")
  assert.equal(one((await inbox({ tables }, sevenAm - MIN)).events, "chef_unsent").ring, false, "6:59 AM")
  assert.equal(one((await inbox({ tables }, sevenAm)).events, "chef_unsent").ring, true, "7:00 AM, six hours after it failed")
  const elevenPm = Date.parse("2030-11-14T07:00:00Z")
  const late = { chef_change_notices: [failedRow("f1", elevenPm - 10 * MIN)], chef_sheet_links: afterFailure(elevenPm - 10 * MIN) }
  assert.equal(one((await inbox({ tables: late }, elevenPm - MIN)).events, "chef_unsent").ring, true, "10:59 PM")
  assert.equal(one((await inbox({ tables: late }, elevenPm)).events, "chef_unsent").ring, false, "11:00 PM")
})

test("unsent · sending the sheet again clears it: a new link with a new token, the failed one revoked", async () => {
  const at = NOW - 30 * MIN
  const resent = [afterFailure(at)[0], { ...afterFailure(at)[1], revoked_at: iso(NOW - 5 * MIN) }, linkRow("L3", { sent_at: iso(NOW - 5 * MIN) })]
  const { events, counts } = await inbox({ tables: { chef_change_notices: [failedRow("f1", at)], chef_sheet_links: resent } })
  assert.deepEqual(kinds(events), [])
  assert.equal(counts.chefUnsent, 0)
  // That re-send's own text bounced as well: he still holds nothing, the line stays.
  const bounced = [afterFailure(at)[0], { ...afterFailure(at)[1], revoked_at: iso(NOW - 5 * MIN) }, linkRow("L3", { sent_via: "failed", sent_at: iso(NOW - 5 * MIN) })]
  assert.deepEqual(kinds((await inbox({ tables: { chef_change_notices: [failedRow("f1", at)], chef_sheet_links: bounced } })).events), ["chef_unsent"])
  // He opened the link the failed text was carrying (someone passed it to him): he has it.
  const opened = [afterFailure(at)[0], { ...afterFailure(at)[1], first_opened_at: iso(NOW - 2 * MIN) }]
  assert.deepEqual(kinds((await inbox({ tables: { chef_change_notices: [failedRow("f1", at)], chef_sheet_links: opened } })).events), [])
})

test("unsent · gone when a later text reaches him, a person vouches, he is off the party, or the party is off", async () => {
  const at = NOW - 3 * H
  const links = afterFailure(at)
  // The next change text went out: it carried a newer link, and it waits for his 1 like any other.
  const later = await inbox({ tables: { chef_change_notices: [failedRow("f1", at), noticeRow("n2", NOW - 130 * MIN, { sms_sid: "SM2" })], chef_sheet_links: links } })
  assert.deepEqual(kinds(later.events), ["chef_notice"])
  assert.deepEqual(kinds((await inbox({ tables: { chef_change_notices: [failedRow("f1", at, { acked_at: iso(NOW - MIN) })], chef_sheet_links: links } })).events), [])
  const offParty = [{ id: "as1", order_id: ORDER_ID, staff_member_id: GARY, assignment_status: "cancelled" }]
  assert.deepEqual(kinds((await inbox({ tables: { chef_change_notices: [failedRow("f1", at)], chef_sheet_links: links, order_staff_assignments: offParty } })).events), [])
  assert.deepEqual(kinds((await inbox({ tables: { orders: [{ ...ORDER, order_status: "cancelled" }], chef_change_notices: [failedRow("f1", at)], chef_sheet_links: links } })).events), [])
  // An hour into the party there is nothing left to send.
  assert.deepEqual(kinds((await inbox({ tables: { chef_change_notices: [failedRow("f1", at)], chef_sheet_links: links } }, Date.parse("2030-11-15T02:31:00Z"))).events), [])
})

test("unsent · one line per chef per party: an earlier text he has not confirmed does not get a second line", async () => {
  const at = NOW - 10 * MIN
  const { events, counts } = await inbox({ tables: { chef_change_notices: [noticeRow("n1", NOW - 5 * H, { sms_sid: "SM1" }), failedRow("f1", at)], chef_sheet_links: afterFailure(at) } })
  assert.deepEqual(kinds(events), ["chef_unsent"])
  assert.deepEqual([counts.chefUnsent, counts.chefNotices], [1, 0])
})

test("unsent · the links table unreadable: the line stays, the inbox still answers", async () => {
  const { events } = await inbox({ tables: { chef_change_notices: [failedRow("f1", NOW - 3 * MIN)] }, missing: ["chef_sheet_links"] })
  assert.deepEqual(kinds(events), ["chef_unsent"])
})
