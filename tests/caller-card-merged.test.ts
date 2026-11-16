// Layer-2 self-test: the ring screen knows a caller whose number only a merged row carries (2026-11-16).
// When two of a customer's leads are merged, the kept lead keeps its own number and the other number
// stays on the row merged away. The caller card looked for a live lead on the calling number, so a
// call from that other number rang as 新号码 · 无记录 - even from a customer with a booked party (in
// production on 11-16: one such number, both its rows merged into a won lead). Now the number stands
// for the lead it went into (lib/merged-leads.ts): its name, timeline and channel, and the party
// booked under the kept lead's own number.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { callerCardFor, loadCallerFacts } from "../lib/caller-card"
import { fakeSupabase, type Row } from "./fixtures/fake-supabase"

// Not 555 numbers (lib/caller-card.ts reads them like any other). Exchange 000 is never assigned.
const KEPT_NUMBER = "+19090000177"
const OTHER_PHONE = "+19090000188"
const STRANGER = "+19090000166"
const KEPT = "00000000-0000-4000-8000-0000000000c1"
const MERGED_A = "00000000-0000-4000-8000-0000000000c2"
const MERGED_B = "00000000-0000-4000-8000-0000000000c3"
// 12:00 Pacific on Sat Nov 16 2030; the party is the Friday after.
const NOW = Date.parse("2030-11-16T20:00:00Z")

const lead = (row: Row): Row => ({
  full_name: null,
  guest_count: null,
  adult_count: null,
  child_count: null,
  little_count: null,
  merged_into: null,
  ...row,
  normalized_phone: typeof row.phone === "string" ? row.phone.slice(-10) : null,
})

function world(extra: { leads?: Row[] } = {}) {
  return fakeSupabase({
    leads: [
      lead({ id: KEPT, full_name: "Dana Yelp", phone: KEPT_NUMBER, guest_count: 20, created_at: "2030-11-01T05:12:07Z" }),
      // Both rows carrying the other phone were merged into the kept lead (the shape of 763c4888 and a847657f).
      lead({ id: MERGED_A, full_name: "+19090000188", phone: OTHER_PHONE, created_at: "2030-11-02T06:07:58Z", merged_into: KEPT }),
      lead({ id: MERGED_B, phone: OTHER_PHONE, created_at: "2030-11-05T06:07:58Z", merged_into: KEPT }),
      ...(extra.leads ?? []),
    ],
    // The merge moved the other phone's text onto the kept lead.
    lead_touchpoints: [
      { id: "t1", lead_id: KEPT, touchpoint_type: "sms_inbound", occurred_at: "2030-11-15T22:40:00Z", raw_payload_json: { From: OTHER_PHONE, Body: "Can we start at 6 pm instead?" } },
    ],
    lead_attribution: [{ id: KEPT, channel: "yelp" }],
    // The party is booked under the kept lead's own number.
    orders: [
      {
        id: "o1",
        customer_name: "Dana Yelp",
        customer_phone: KEPT_NUMBER,
        source_metadata: { lead_id: KEPT },
        event_start: "2030-11-22T18:00:00Z",
        order_status: "confirmed",
        deposit_status: "paid_verified",
        quoted_total_cents: 122500,
        guest_adult_count: 18,
        guest_child_count: 2,
        created_at: "2030-11-10T00:00:00Z",
      },
    ],
  })
}

const BOOKED = {
  name: "Dana Yelp",
  heads: 20,
  date: "2030-11-22",
  time: "18:00",
  dateTbd: false,
  price: 1225,
  locked: true,
  order: true,
  returning: false,
  lastText: { body: "Can we start at 6 pm instead?", at: "2030-11-15T22:40:00Z" },
  channel: "yelp",
}

test("caller card · a number only merged rows carry: the kept lead and its booked party", async () => {
  const db = world()
  assert.deepEqual(await loadCallerFacts(db as never, OTHER_PHONE, NOW), BOOKED)
  assert.deepEqual(db.writes, [], "the ring screen only reads")
})

test("caller card · the kept lead's own number reads as before", async () => {
  assert.deepEqual(await loadCallerFacts(world() as never, KEPT_NUMBER, NOW), BOOKED)
})

test("caller card · a live lead on the number beats a newer row merged into another lead", async () => {
  const db = world({
    leads: [
      lead({ id: "00000000-0000-4000-8000-0000000000c4", full_name: "Sam Live", phone: STRANGER, created_at: "2030-11-03T00:00:00Z" }),
      lead({ id: "00000000-0000-4000-8000-0000000000c5", phone: STRANGER, created_at: "2030-11-09T00:00:00Z", merged_into: KEPT }),
    ],
  })
  const facts = await loadCallerFacts(db as never, STRANGER, NOW)
  assert.equal(facts.name, "Sam Live")
  assert.equal(facts.order, false)
  assert.equal(facts.lastText, null)
})

test("caller card · a number nobody carries still rings as new; a broken merge reads its own row", async () => {
  const none = await loadCallerFacts(world() as never, STRANGER, NOW)
  assert.deepEqual([none.name, none.order, none.lastText, none.channel], ["", false, null, null])
  const broken = world({ leads: [lead({ id: "00000000-0000-4000-8000-0000000000c6", full_name: "Lee Broken", phone: STRANGER, created_at: "2030-11-09T00:00:00Z", merged_into: "00000000-0000-4000-8000-000000000999" })] })
  const facts = await loadCallerFacts(broken as never, STRANGER, NOW)
  assert.deepEqual([facts.name, facts.order], ["Lee Broken", false])
})

test("caller card · the card for the other phone rings with the party on it", async () => {
  const card = await callerCardFor(world() as never, OTHER_PHONE, 1500, NOW)
  assert.deepEqual(card, {
    name: "Dana Yelp",
    line: "20人 · 11月22日 周五 18:00 · 总价 $1,225 · 已锁单\n昨天短信：Can we start at 6 pm instead? · yelp",
  })
})
