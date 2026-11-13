// Layer-2 self-test: telling a chef he is off a party (lib/chef-notify.ts,
// order-flow rebuild 2026-11-11). Reassigning in the workbench used to tell the
// removed chef nothing - 11-09 Blu got a sheet and was swapped out 13 minutes
// later - and a cancellation only reached him if someone remembered to text.
// No network, no database: the SMS sender is a recorder and the client is the
// in-memory fake, which also proves a dry run writes and sends nothing.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  chefNoticeSummaryZh,
  chefsRemovedByAssign,
  helpersRemovedByAssign,
  logChefNotices,
  notifyRemovedChefs,
  openedSinceSent,
  partyCancelledText,
  partyLabelZh,
  removedFromPartyText,
  sendSheetsToNewTeam,
  sheetHeld,
  sheetNotTold,
  sheetReachedChef,
  sheetSendSummaryZh,
  teamNeedingSheet,
  type PartyRef,
  type SheetSendInput,
  type SheetSendResult,
} from "../lib/chef-notify"
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

test("reassigned · the link changes with every send: the sheet that reached him may be a revoked row, the live one a bounce", async () => {
  // He got the sheet (l1). A change text then issued l2, revoked l1, and bounced. He still knows the party.
  const db = world([link("l1", BLU, { first_opened_at: "2030-11-11T01:00:00Z", revoked_at: "2030-11-12T01:00:00Z" }), link("l2", BLU, { sent_via: "failed" })])
  const { sent, send } = sender()
  const [r] = await notifyRemovedChefs(db as never, { order: ORDER, staffIds: [BLU], reason: "reassigned", now: BEFORE, send })
  assert.equal(r.hadSheet, true)
  assert.equal(r.texted, true)
  assert.deepEqual(sent.map((m) => m.body), ["11月14日下午5:30 Irvine（Joyce）那场改给别人了，你不用去，之前的备料单作废。"])
  // Only the live link is revoked; the old row keeps the time it was replaced.
  assert.equal(r.linksRevoked, 1)
  assert.deepEqual(db.tables.chef_sheet_links.map((l) => [l.id, l.revoked_at]), [["l1", "2030-11-12T01:00:00Z"], ["l2", new Date(BEFORE).toISOString()]])
  // Sent twice, both arrived (l1 replaced by l2): one text, one link to revoke.
  const twice = world([link("l1", BLU, { revoked_at: "2030-11-12T01:00:00Z" }), link("l2", BLU)])
  const again = sender()
  const [r2] = await notifyRemovedChefs(twice as never, { order: ORDER, staffIds: [BLU], reason: "reassigned", now: BEFORE, send: again.send })
  assert.deepEqual([r2.texted, r2.linksRevoked, again.sent.length], [true, 1, 1])
})

test("reassigned · taken off before and told then, put back without a sheet: there is nothing to tell him twice", async () => {
  const db = world([link("l1", BLU, { first_opened_at: "2030-11-11T01:00:00Z", revoked_at: "2030-11-12T01:00:00Z" })])
  const { sent, send } = sender()
  const [r] = await notifyRemovedChefs(db as never, { order: ORDER, staffIds: [BLU], reason: "reassigned", now: BEFORE, send })
  assert.equal(r.skipped, "no_sheet")
  assert.deepEqual(sent, [])
  assert.deepEqual(db.writes, [])
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

test("who is off · a new team removes the cooks it leaves out, not one who stays on as a helper", () => {
  const cook = (id: string) => ({ staff_member_id: id, assignment_role: "lead_chef" })
  const helper = (id: string) => ({ staff_member_id: id, assignment_role: "assistant_chef" })
  // Blu -> Gary: Blu is off.
  assert.deepEqual(chefsRemovedByAssign([cook(BLU)], [GARY]), [BLU])
  // Blu + Gary -> Gary: only Blu. Same team again: nobody.
  assert.deepEqual(chefsRemovedByAssign([cook(BLU), cook(GARY)], [GARY]), [BLU])
  assert.deepEqual(chefsRemovedByAssign([cook(BLU), cook(GARY)], [GARY, BLU]), [])
  // Cleared team: everyone who cooked.
  assert.deepEqual(chefsRemovedByAssign([cook(BLU), cook(GARY)], []), [BLU, GARY])
  // A helper promoted to cook is not removed; a cook who is also still a helper is still going.
  assert.deepEqual(chefsRemovedByAssign([cook(BLU), helper(GARY)], [GARY]), [BLU])
  assert.deepEqual(chefsRemovedByAssign([cook(BLU), helper(BLU)], [GARY]), [])
  // The helper list: a dropped helper is off, unless he cooks on this party.
  assert.deepEqual(helpersRemovedByAssign([cook(BLU), helper(GARY), helper(NOPHONE)], [NOPHONE]), [GARY])
  assert.deepEqual(helpersRemovedByAssign([cook(BLU), helper(BLU)], []), [])
  assert.deepEqual(helpersRemovedByAssign([cook(BLU), helper(GARY)], [GARY]), [])
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

// ---- which sheet a chef holds, and who still needs one -------------------------------
// Since 2026-11-13 a chef keeps ONE link per party: a re-send or a change text brings it up
// to date in place and texts the same URL (sent_at moves on, first_opened_at stays his first
// open ever). From 2026-11-11 to 11-13 every send minted a new link and revoked the one
// before, so parties from then carry a history of rows. Both kinds are read the same way.

test("the sheet in his hands · the live link decides (rows from 11-11 to 11-13: a new link per send)", () => {
  assert.equal(sheetReachedChef({ sent_via: "twilio", first_opened_at: null }), true)
  assert.equal(sheetReachedChef({ sent_via: "manual", first_opened_at: null }), true)
  assert.equal(sheetReachedChef({ sent_via: "failed", first_opened_at: null }), false)
  assert.equal(sheetReachedChef({ sent_via: "failed", first_opened_at: "2030-11-12T01:00:00Z" }), true, "he opened it, however it got to him")
  assert.equal(sheetReachedChef({ sent_via: null, first_opened_at: null }), false)

  assert.equal(sheetHeld([], BLU), "none")
  assert.equal(sheetHeld([link("l1", GARY)], BLU), "none", "somebody else's")
  assert.equal(sheetHeld([link("l1", BLU)], BLU), "sent")
  assert.equal(sheetHeld([link("l1", BLU, { first_opened_at: "2030-11-12T01:00:00Z" })], BLU), "opened")
  assert.equal(sheetHeld([link("l1", BLU, { sent_via: "failed" })], BLU), "undelivered")
  // Re-sent: the first row is revoked, the second - a new token - is the one he holds.
  assert.equal(sheetHeld([link("l1", BLU, { first_opened_at: "2030-11-11T01:00:00Z", revoked_at: "2030-11-12T01:00:00Z" }), link("l2", BLU)], BLU), "sent")
  // A change text that bounced then: the sheet he had opened is revoked, the new one never arrived.
  assert.equal(sheetHeld([link("l1", BLU, { first_opened_at: "2030-11-11T01:00:00Z", revoked_at: "2030-11-12T01:00:00Z" }), link("l2", BLU, { sent_via: "failed" })], BLU), "undelivered")
  assert.equal(sheetHeld([link("l1", BLU, { revoked_at: "2030-11-12T01:00:00Z" })], BLU), "none", "taken off: nothing live")
  assert.equal(sheetHeld([link("l1", BLU, { stale: false })], BLU), "sent")
})

test("the sheet in his hands · one link updated in place (2026-11-13): opened means since it last went to him", () => {
  const sentMon = "2030-11-11T18:00:00Z"
  const openedMon = "2030-11-11T19:00:00Z"
  const resentWed = "2030-11-13T18:00:00Z"
  const held = link("l1", BLU, { sent_at: sentMon, first_opened_at: openedMon, last_opened_at: openedMon })
  assert.equal(sheetHeld([held], BLU), "opened")
  // Texted again on the same link (a re-send, or a change text that went out): his Monday open does not count for it.
  const again = { ...held, sent_at: resentWed }
  assert.equal(sheetHeld([again], BLU), "sent", "first_opened_at alone would have said opened")
  assert.equal(openedSinceSent(again), false)
  // He opens it after that text: last_opened_at moves, first_opened_at does not.
  assert.equal(sheetHeld([{ ...again, last_opened_at: "2030-11-13T18:20:00Z" }], BLU), "opened")
  assert.equal(openedSinceSent({ ...again, last_opened_at: "2030-11-13T18:20:00Z" }), true)
  // No sent_at on the row: any open counts. No open at all: not opened.
  assert.equal(openedSinceSent({ sent_at: null, first_opened_at: openedMon, last_opened_at: null }), true)
  assert.equal(openedSinceSent({ sent_at: resentWed, first_opened_at: null, last_opened_at: null }), false)
  // A row minted per send (11-11 to 11-13) reads the same: opened after its one send.
  assert.equal(openedSinceSent({ sent_at: sentMon, first_opened_at: openedMon }), true)
})

test("the sheet in his hands · stale = the order changed and he has not been told; the link still opens", () => {
  const opened = link("l1", BLU, { sent_at: "2030-11-11T18:00:00Z", first_opened_at: "2030-11-11T19:00:00Z", last_opened_at: "2030-11-11T19:00:00Z", stale: true })
  // Not void any more: what he holds is opened / sent as before, flagged as not told yet.
  assert.equal(sheetHeld([opened], BLU), "opened")
  assert.equal(sheetNotTold([opened], BLU), true)
  assert.equal(sheetHeld([link("l1", BLU, { stale: true })], BLU), "sent")
  assert.equal(sheetNotTold([link("l1", BLU, { stale: true })], BLU), true)
  // Told (the change text went out and brought the link up to date): not stale.
  assert.equal(sheetNotTold([{ ...opened, stale: false }], BLU), false)
  // A stale link that never reached him, a revoked one, somebody else's: nothing he was not told about.
  assert.equal(sheetNotTold([link("l1", BLU, { sent_via: "failed", stale: true })], BLU), false)
  assert.equal(sheetNotTold([link("l1", BLU, { stale: true, revoked_at: "2030-11-12T01:00:00Z" })], BLU), false)
  assert.equal(sheetNotTold([link("l1", GARY, { stale: true })], BLU), false)
  // Two live links left from before 11-13, the newer one up to date: he holds a told version.
  assert.equal(sheetNotTold([link("l1", BLU, { stale: true }), link("l2", BLU)], BLU), false)
})

test("who still needs a sheet · once a party's sheets are out, a chef put on it has none and no change text will bring him one", () => {
  // Nothing has gone out for this party yet: assigning early prompts for nobody.
  assert.deepEqual(teamNeedingSheet([BLU, GARY], []), [])
  assert.deepEqual(teamNeedingSheet([GARY], [link("l1", BLU, { sent_via: "failed" })]), [], "a text that bounced is not a sheet that went out")
  // Blu had the sheet and was replaced (his link is revoked by now): Gary is the one without.
  const bluOff = link("l1", BLU, { first_opened_at: "2030-11-11T01:00:00Z", revoked_at: "2030-11-12T01:00:00Z" })
  assert.deepEqual(teamNeedingSheet([GARY], [bluOff]), [GARY])
  // A second chef added next to one who has it.
  assert.deepEqual(teamNeedingSheet([BLU, GARY], [link("l1", BLU)]), [GARY])
  assert.deepEqual(teamNeedingSheet([BLU, GARY, GARY], [link("l1", BLU)]), [GARY], "once each")
  // Gary was sent it and the text bounced: still without.
  assert.deepEqual(teamNeedingSheet([GARY], [bluOff, link("l2", GARY, { sent_via: "failed" })]), [GARY])
  // Sent, re-sent (a new token each time), opened or not: he has one.
  assert.deepEqual(teamNeedingSheet([GARY], [bluOff, link("l2", GARY)]), [])
  assert.deepEqual(teamNeedingSheet([GARY], [bluOff, link("l2", GARY, { revoked_at: "2030-11-12T02:00:00Z" }), link("l3", GARY)]), [])
  // His link is stale: it still opens, with the change on top, and the change text tells him - not a person's job.
  assert.deepEqual(teamNeedingSheet([GARY], [link("l2", GARY, { stale: true })]), [])
  // His only link was revoked (taken off earlier, now back on): he needs one again.
  assert.deepEqual(teamNeedingSheet([GARY], [link("l1", BLU), link("l2", GARY, { revoked_at: "2030-11-12T02:00:00Z" })]), [GARY])
})

// ---- the chef put on a party gets its sheet at once (owner 2026-11-12, D-1112-01) ---------
// 「给师傅更新发也是直接发，不要拖延」. The send itself is the invoice app's; here it is a recorder.

function teamWorld(links: Array<Record<string, unknown>>, order: Record<string, unknown> = {}) {
  const db = world(links)
  db.tables.orders = [{ id: ORDER.id, order_no: ORDER.order_no, event_start: ORDER.event_start, order_status: "active", ...order }]
  db.tables.order_events = []
  return db
}
function invoiceApp(answer: (x: SheetSendInput) => SheetSendResult | Promise<SheetSendResult> = () => ({ ok: true, url: "https://invoice.example/chef/tok", resent: false, sms: { delivered: true } })) {
  const calls: SheetSendInput[] = []
  return { calls, send: async (x: SheetSendInput) => (calls.push(x), answer(x)) }
}
// Blu had the sheet and was taken off (his link revoked): the party's sheet has gone out.
const bluHad = link("l1", BLU, { first_opened_at: "2030-11-12T01:00:00Z", revoked_at: "2030-11-12T19:00:00Z" })

test("new team · the chef put on a party whose sheet has gone out is sent his own, at once, as the workbench", async () => {
  const db = teamWorld([bluHad])
  const app = invoiceApp()
  const out = await sendSheetsToNewTeam(db as never, { orderId: ORDER.id, team: [GARY], sentBy: "workbench:reassign", send: app.send, now: BEFORE })
  assert.deepEqual(app.calls, [{ orderNo: ORDER.order_no, staffMemberId: GARY, sendSms: true, sentBy: "workbench:reassign" }])
  assert.deepEqual(out, [{ staffId: GARY, name: "Gary", sent: true, delivered: true }])
  assert.equal(sheetSendSummaryZh(out), "备料单已发给 Gary")
  assert.deepEqual(db.writes, [], "the invoice app writes the link and its own trail")
  // At 2 AM the same: no hold for the night.
  const night = invoiceApp()
  await sendSheetsToNewTeam(teamWorld([bluHad]) as never, { orderId: ORDER.id, team: [GARY], sentBy: "desk", send: night.send, now: Date.parse("2030-11-13T10:00:00Z") })
  assert.deepEqual(night.calls.map((c) => c.sentBy), ["desk"])
})

test("new team · nothing goes out before the party's first sheet, or to a chef who already holds a live one", async () => {
  const none = invoiceApp()
  assert.deepEqual(await sendSheetsToNewTeam(teamWorld([]) as never, { orderId: ORDER.id, team: [GARY], sentBy: "workbench:reassign", send: none.send, now: BEFORE }), [])
  // A sheet text that bounced is not a sheet that went out.
  assert.deepEqual(await sendSheetsToNewTeam(teamWorld([link("l1", BLU, { sent_via: "failed" })]) as never, { orderId: ORDER.id, team: [GARY], sentBy: "workbench:reassign", send: none.send, now: BEFORE }), [])
  assert.equal(none.calls.length, 0)
  // Blu stays on and holds his; Gary is added next to him.
  const both = invoiceApp()
  const out = await sendSheetsToNewTeam(teamWorld([link("l1", BLU)]) as never, { orderId: ORDER.id, team: [BLU, GARY], sentBy: "workbench:reassign", send: both.send, now: BEFORE })
  assert.deepEqual(both.calls.map((c) => c.staffMemberId), [GARY])
  assert.deepEqual(out.map((r) => r.name), ["Gary"])
})

test("new team · a text that did not get to him: reported, and his link (marked failed) is how the inbox finds him", async () => {
  const db = teamWorld([bluHad])
  const app = invoiceApp(() => ({ ok: true, url: "https://invoice.example/chef/tok", sms: { delivered: false, error: "staff_has_no_phone" } }))
  const out = await sendSheetsToNewTeam(db as never, { orderId: ORDER.id, team: [GARY], sentBy: "workbench:reassign", send: app.send, now: BEFORE })
  assert.deepEqual(out, [{ staffId: GARY, name: "Gary", sent: true, delivered: false, error: "staff_has_no_phone" }])
  assert.equal(sheetSendSummaryZh(out), "Gary 的备料单短信没发出去（没存手机号），已进收件箱")
  assert.deepEqual(db.writes, [])
})

test("new team · a send the invoice app refuses, or one that throws: written to the order for the inbox, never thrown", async () => {
  const db = teamWorld([bluHad])
  const refused = invoiceApp(() => ({ ok: false, error: "备料单没发：菜单还空着。改好发票再发，或确认后 force 发。", code: "order_lint" }))
  const out = await sendSheetsToNewTeam(db as never, { orderId: ORDER.id, team: [GARY], sentBy: "workbench:reassign", send: refused.send, now: BEFORE })
  assert.deepEqual(out, [{ staffId: GARY, name: "Gary", sent: false, delivered: false, error: "备料单没发：菜单还空着。改好发票再发，或确认后 force 发。", code: "order_lint" }])
  assert.deepEqual(db.writes.map((w) => [w.table, w.op]), [["order_events", "insert"]])
  assert.deepEqual(db.tables.order_events.map((e) => [e.action, e.actor, (e.metadata as Record<string, unknown>).staff_member_id, (e.metadata as Record<string, unknown>).code]), [["chef_sheet_send_failed", "workbench:reassign", GARY, "order_lint"]])
  assert.equal(sheetSendSummaryZh(out), "Gary 的备料单没发出去（备料单没发：菜单还空着。改好发票再发，或确认后 force 发。），已进收件箱")
  const down = teamWorld([bluHad])
  const thrown = await sendSheetsToNewTeam(down as never, { orderId: ORDER.id, team: [GARY], sentBy: "desk", send: async () => { throw new Error("fetch failed") }, now: BEFORE })
  assert.deepEqual(thrown.map((r) => [r.sent, r.error]), [[false, "fetch failed"]])
  assert.equal(down.tables.order_events.length, 1)
})

test("new team · dry run says who would get it and sends nothing; a cancelled party or one under way sends nothing", async () => {
  const app = invoiceApp()
  const dry = teamWorld([bluHad])
  const plan = await sendSheetsToNewTeam(dry as never, { orderId: ORDER.id, team: [GARY], sentBy: "workbench:reassign", send: app.send, dryRun: true, now: BEFORE })
  assert.deepEqual(plan, [{ staffId: GARY, name: "Gary", sent: false, delivered: false, dryRun: true }])
  assert.equal(sheetSendSummaryZh(plan), "会自动给 Gary 发备料单")
  assert.deepEqual([app.calls.length, dry.writes.length], [0, 0])
  assert.deepEqual(await sendSheetsToNewTeam(teamWorld([bluHad], { order_status: "cancelled" }) as never, { orderId: ORDER.id, team: [GARY], sentBy: "workbench:reassign", send: app.send, now: BEFORE }), [])
  // 5:30 PM Pacific on the 14th is 01:30Z on the 15th.
  assert.deepEqual(await sendSheetsToNewTeam(teamWorld([bluHad]) as never, { orderId: ORDER.id, team: [GARY], sentBy: "workbench:reassign", send: app.send, now: Date.parse("2030-11-15T01:31:00Z") }), [])
  assert.equal(app.calls.length, 0)
  assert.deepEqual(await sendSheetsToNewTeam(teamWorld([bluHad]) as never, { orderId: ORDER.id, team: [], sentBy: "workbench:reassign", send: app.send, now: BEFORE }), [])
})
