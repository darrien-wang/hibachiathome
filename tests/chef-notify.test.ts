// Layer-2 self-test: telling a chef he is off a party (lib/chef-notify.ts,
// order-flow rebuild 2026-11-11). Reassigning in the workbench used to tell the
// removed chef nothing - 11-09 Blu got a sheet and was swapped out 13 minutes
// later - and a cancellation only reached him if someone remembered to text.
// No network, no database: the SMS sender is a recorder and the client is the
// in-memory fake, which also proves a dry run writes and sends nothing.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { chefNoticeSummaryZh, logChefNotices, notifyRemovedChefs, partyCancelledText, partyLabelZh, removedFromPartyText, type PartyRef } from "../lib/chef-notify"
import { fakeSupabase } from "./fixtures/fake-supabase"

const ORDER: PartyRef = {
  id: "00000000-0000-4000-8000-0000000000a1",
  order_no: "RH-20301105-0001",
  customer_name: "Joyce Lin",
  // 5:30 PM on the Pacific wall clock, stored as if it were UTC.
  event_start: "2030-11-14T17:30:00+00:00",
  event_address: "12 Test Way, Irvine, CA 92602",
  source_metadata: {},
}
const BLU = "00000000-0000-4000-8000-0000000000b1"
const GARY = "00000000-0000-4000-8000-0000000000b2"
const NOPHONE = "00000000-0000-4000-8000-0000000000b3"
const BEFORE = Date.parse("2030-11-12T20:00:00Z") // two days ahead of the party

function world(links: Array<Record<string, unknown>>) {
  return fakeSupabase({
    staff_members: [
      { id: BLU, display_name: "Blu", full_name: "Blu Test", phone: "6265550101" },
      { id: GARY, display_name: "Gary", full_name: null, phone: "(626) 555-0102" },
      { id: NOPHONE, display_name: "易非", full_name: null, phone: null },
    ],
    chef_sheet_links: links,
  })
}
const link = (id: string, staff: string, over: Record<string, unknown> = {}) => ({ id, order_id: ORDER.id, staff_member_id: staff, sent_via: "twilio", first_opened_at: null, revoked_at: null, ...over })

function sender(result: (phone: string) => { ok: true; sid: string; status: string } | { ok: false; error: string } = () => ({ ok: true, sid: "SMtest", status: "queued" })) {
  const sent: Array<{ phone: string; body: string }> = []
  return { sent, send: async (phone: string, body: string) => (sent.push({ phone, body }), result(phone)) }
}

test("wording · the party the way a chef knows it, and the two texts word for word", () => {
  assert.equal(partyLabelZh(ORDER), "11月14日下午5:30 Irvine（Joyce）")
  assert.equal(removedFromPartyText(ORDER), "11月14日下午5:30 Irvine（Joyce）那场改给别人了，你不用去，之前的备料单作废。")
  assert.equal(partyCancelledText(ORDER, true), "11月14日下午5:30 Irvine（Joyce）那场取消了，你不用去，之前的备料单作废。")
  assert.equal(partyCancelledText(ORDER, false), "11月14日下午5:30 Irvine（Joyce）那场取消了，你不用去。")
})

test("wording · times of day, a time still to be confirmed, a date on hold, missing pieces", () => {
  const at = (iso: string) => partyLabelZh({ ...ORDER, event_start: iso })
  assert.equal(at("2030-11-14T11:00:00+00:00"), "11月14日上午11:00 Irvine（Joyce）")
  assert.equal(at("2030-11-14T12:30:00+00:00"), "11月14日中午12:30 Irvine（Joyce）")
  assert.equal(at("2030-11-14T19:00:00+00:00"), "11月14日晚上7:00 Irvine（Joyce）")
  assert.equal(at("2030-11-15T00:00:00+00:00"), "11月15日凌晨12:00 Irvine（Joyce）")
  assert.equal(partyLabelZh({ ...ORDER, source_metadata: { event_time_tbd: true } }), "11月14日 Irvine（Joyce）")
  assert.equal(partyLabelZh({ ...ORDER, event_start: null }), "日期待定 Irvine（Joyce）")
  assert.equal(removedFromPartyText({ ...ORDER, customer_name: "+16265550100" }), "11月14日下午5:30 Irvine 那场改给别人了，你不用去，之前的备料单作废。")
  assert.equal(removedFromPartyText({ ...ORDER, event_address: null }), "11月14日下午5:30 Joyce 那场改给别人了，你不用去，之前的备料单作废。")
  // A label that ends in a digit or a Latin letter gets a space before 那场.
  assert.equal(removedFromPartyText({ ...ORDER, event_address: null, customer_name: null }), "11月14日下午5:30 那场改给别人了，你不用去，之前的备料单作废。")
  assert.equal(removedFromPartyText({ ...ORDER, event_start: null, event_address: null, customer_name: null }), "日期待定那场改给别人了，你不用去，之前的备料单作废。")
})

test("wording · says what changed and nothing about buying, money or why", () => {
  for (const text of [removedFromPartyText(ORDER), partyCancelledText(ORDER, true), partyCancelledText(ORDER, false)]) {
    assert.doesNotMatch(text, /买|采购|购|\$|钱|因为|[A-Za-z]{12,}/)
  }
})

test("reassigned · a chef who had the sheet is texted and his link revoked", async () => {
  const db = world([link("l1", BLU)])
  const { sent, send } = sender()
  const [r] = await notifyRemovedChefs(db as never, { order: ORDER, staffIds: [BLU], reason: "reassigned", now: BEFORE, send })
  assert.deepEqual(sent, [{ phone: "+16265550101", body: "11月14日下午5:30 Irvine（Joyce）那场改给别人了，你不用去，之前的备料单作废。" }])
  assert.equal(r.texted, true)
  assert.equal(r.sid, "SMtest")
  assert.equal(r.linksRevoked, 1)
  assert.equal(typeof db.tables.chef_sheet_links[0].revoked_at, "string")
  assert.deepEqual(db.writes.map((w) => `${w.table}:${w.op}`), ["chef_sheet_links:update"])
})

test("reassigned · a chef who was never sent a sheet hears nothing", async () => {
  const db = world([])
  const { sent, send } = sender()
  const [r] = await notifyRemovedChefs(db as never, { order: ORDER, staffIds: [GARY], reason: "reassigned", now: BEFORE, send })
  assert.equal(r.skipped, "no_sheet")
  assert.equal(r.text, null)
  assert.deepEqual(sent, [])
  assert.deepEqual(db.writes, [])
})

test("reassigned · a sheet text that bounced and was never opened is not a sheet he had; the dead link still goes", async () => {
  const db = world([link("l1", GARY, { sent_via: "failed" })])
  const { sent, send } = sender()
  const [r] = await notifyRemovedChefs(db as never, { order: ORDER, staffIds: [GARY], reason: "reassigned", now: BEFORE, send })
  assert.equal(r.skipped, "no_sheet")
  assert.equal(r.linksRevoked, 1)
  assert.deepEqual(sent, [])
  const opened = world([link("l1", GARY, { sent_via: "failed", first_opened_at: "2030-11-12T01:00:00Z" })])
  const second = sender()
  const [r2] = await notifyRemovedChefs(opened as never, { order: ORDER, staffIds: [GARY], reason: "reassigned", now: BEFORE, send: second.send })
  assert.equal(r2.texted, true, "he opened it, so he knows the party")
})

test("reassigned · names moved on a party that already started are bookkeeping: no text, link left alone", async () => {
  const db = world([link("l1", BLU)])
  const { sent, send } = sender()
  // 5:30 PM PT on Nov 14 2030 is 01:30 UTC on the 15th: one minute after that the party has started.
  const [r] = await notifyRemovedChefs(db as never, { order: ORDER, staffIds: [BLU], reason: "reassigned", now: Date.parse("2030-11-15T01:31:00Z"), send })
  assert.equal(r.skipped, "party_started")
  assert.deepEqual(sent, [])
  assert.deepEqual(db.writes, [])
  // ...and at 17:31 UTC on the 14th - what a naive read of the column would call "started" - it has not.
  const [early] = await notifyRemovedChefs(world([link("l1", BLU)]) as never, { order: ORDER, staffIds: [BLU], reason: "reassigned", now: Date.parse("2030-11-14T17:31:00Z"), send })
  assert.equal(early.texted, true)
})

test("no phone on file · the link is revoked and the caller is told to pass it on", async () => {
  const db = world([link("l1", NOPHONE, { sent_via: "manual" })])
  const { sent, send } = sender()
  const [r] = await notifyRemovedChefs(db as never, { order: ORDER, staffIds: [NOPHONE], reason: "reassigned", now: BEFORE, send })
  assert.equal(r.error, "staff_has_no_phone")
  assert.equal(r.texted, false)
  assert.equal(r.linksRevoked, 1)
  assert.deepEqual(sent, [])
  assert.equal(chefNoticeSummaryZh([r]), "易非 没通知到（没存手机号），自己说一声")
})

test("a text Twilio refuses comes back as an error, never a throw", async () => {
  const db = world([link("l1", BLU)])
  const failing = sender(() => ({ ok: false, error: "twilio_500" }))
  const [r] = await notifyRemovedChefs(db as never, { order: ORDER, staffIds: [BLU], reason: "reassigned", now: BEFORE, send: failing.send })
  assert.equal(r.texted, false)
  assert.equal(r.error, "twilio_500")
  const throwing = await notifyRemovedChefs(world([link("l1", BLU)]) as never, { order: ORDER, staffIds: [BLU], reason: "reassigned", now: BEFORE, send: async () => { throw new Error("network down") } })
  assert.equal(throwing[0].error, "network down")
})

test("dry run · the plan, word for word, and nothing written or sent", async () => {
  const db = world([link("l1", BLU), link("l2", GARY, { sent_via: "manual" })])
  const { sent, send } = sender()
  const plan = await notifyRemovedChefs(db as never, { order: ORDER, staffIds: [BLU, GARY], reason: "cancelled", now: BEFORE, dryRun: true, send })
  assert.deepEqual(plan.map((r) => [r.name, r.text, r.texted, r.linksRevoked]), [
    ["Blu", "11月14日下午5:30 Irvine（Joyce）那场取消了，你不用去，之前的备料单作废。", false, 1],
    ["Gary", "11月14日下午5:30 Irvine（Joyce）那场取消了，你不用去，之前的备料单作废。", false, 1],
  ])
  assert.deepEqual(sent, [])
  assert.deepEqual(db.writes, [])
  assert.equal(db.tables.chef_sheet_links.every((l) => l.revoked_at === null), true)
})

test("cancelled · every chef on the party is texted, with the sheet sentence only for the one who has a sheet", async () => {
  const db = world([link("l1", BLU)])
  const { sent, send } = sender()
  const out = await notifyRemovedChefs(db as never, { order: ORDER, staffIds: [BLU, GARY], reason: "cancelled", now: BEFORE, send })
  assert.deepEqual(sent, [
    { phone: "+16265550101", body: "11月14日下午5:30 Irvine（Joyce）那场取消了，你不用去，之前的备料单作废。" },
    { phone: "+16265550102", body: "11月14日下午5:30 Irvine（Joyce）那场取消了，你不用去。" },
  ])
  assert.equal(chefNoticeSummaryZh(out), "已短信通知 Blu、Gary 不用去了")
})

test("cancelled · still news while the party would be on, bookkeeping three hours after its start", async () => {
  const during = sender()
  const [a] = await notifyRemovedChefs(world([]) as never, { order: ORDER, staffIds: [BLU], reason: "cancelled", now: Date.parse("2030-11-15T02:30:00Z"), send: during.send })
  assert.equal(a.texted, true)
  const after = sender()
  const [b] = await notifyRemovedChefs(world([]) as never, { order: ORDER, staffIds: [BLU], reason: "cancelled", now: Date.parse("2030-11-15T04:31:00Z"), send: after.send })
  assert.equal(b.skipped, "party_over")
  assert.deepEqual(after.sent, [])
})

test("the trail · one order event per chef told, with the text and how the send went", async () => {
  const db = world([link("l1", BLU)])
  const { send } = sender()
  const results = await notifyRemovedChefs(db as never, { order: ORDER, staffIds: [BLU, GARY], reason: "reassigned", now: BEFORE, send })
  await logChefNotices(db as never, ORDER.id, "workbench:Darrien", "reassigned", results)
  const events = db.tables.order_events
  assert.equal(events.length, 1, "Gary never had a sheet: no line for him")
  assert.equal(events[0].action, "chef_removed_notified")
  assert.equal(events[0].actor, "workbench:Darrien")
  assert.deepEqual(events[0].metadata, {
    reason: "reassigned",
    staff_member_id: BLU,
    staff_name: "Blu",
    to: "+16265550101",
    sms: { sid: "SMtest" },
    links_revoked: 1,
    text: "11月14日下午5:30 Irvine（Joyce）那场改给别人了，你不用去，之前的备料单作废。",
  })
})
