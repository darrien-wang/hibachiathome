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
    { staff_members: [{ id: GARY, display_name: "Gary", full_name: null, phone: "6260000102", role: "chef" }], orders: [ORDER], ...(w.tables ?? {}) },
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
  assert.deepEqual(kinds((await inbox({ tables: { orders: [{ ...ORDER, order_status: "cancelled" }], chef_change_notices: [noticeRow("n1", NOW - 5 * H)] } })).events), [])
  // Card A not deployed: the table does not exist. The rest of the inbox still answers.
  const { events, counts } = await inbox({ missing: ["chef_change_notices"], inbound: [inb(GARY_PHONE, NOW - 20 * MIN, "备料单打不开，再发一次")] })
  assert.deepEqual(kinds(events), ["chef"])
  assert.equal(counts.chefNotices, 0)
})
