// Layer-2 self-test: new activity follows a merged lead to the lead it went into (2026-11-16).
// Merging hides a row and moves its timeline onto the kept lead, but the row keeps its number and
// address. Everything that files by number or address picked "the newest lead on it", and after a
// merge that is often the hidden row: on 2026-09-10 a customer's text went onto 763c4888 two days
// after it was merged - the only row carrying that number - and never reached the lead it went into.
//   - a text, call or form from a number only a merged row carries lands on the kept lead
//   - a live lead on the number beats a merged row seen more recently
//   - an address only a merged row carries does the same
//   - the shared picks (lib/merged-leads.ts): live first, a merge of a merge followed, a broken chain
//     never hands out an id that may not exist
//   - "不用回" / a hold on the kept lead also quiets the numbers merged into it: since 2026-11-16 the
//     desk names the kept lead on a text from such a number, so that is the lead acked
// The lead-watch, missed-call, failed-delivery, call-note, payment-failure and send routes call
// leadOnNumber / survivorOf / currentLeadId; those routes have no harness of their own.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { computeInbox } from "../lib/inbox"
import { loadQuiet } from "../lib/lead-hold"
import { upsertLeadFromContact } from "../lib/leads"
import { currentLeadId, leadOnNumber, pickContactRow, survivorId, survivorOf, withMergedInto } from "../lib/merged-leads"
import type { TwilioMessage } from "../lib/sms-thread"
import { fakeSupabase, type Row } from "./fixtures/fake-supabase"

const OURS = "+12137707788"
// Not 555 numbers: the inbox drops those as our own test traffic. Exchange 000 is never assigned either.
const CUSTOMER = "+19090000177"
const CUSTOMER_CELL = "+19090000188"
const OTHER = "+19090000199"
const STRANGER = "+19090000166"
const KEPT = "00000000-0000-4000-8000-0000000000f1"
const MERGED_SAME = "00000000-0000-4000-8000-0000000000f2"
const MERGED_CELL = "00000000-0000-4000-8000-0000000000f3"
const OTHER_LEAD = "00000000-0000-4000-8000-0000000000f4"
const MIN = 60_000
const DAY = 24 * 60 * MIN
const iso = (ms: number) => new Date(ms).toISOString()

const lead = (row: Row): Row => ({
  full_name: null,
  email: null,
  status: "qualified",
  lead_type: "booking_inquiry",
  lead_source: null,
  lead_channel: null,
  latest_message: null,
  touchpoint_count: 1,
  sms_blocked_at: null,
  sms_blocked_reason: null,
  acked_until: null,
  hold_until: null,
  hold_set_at: null,
  merged_into: null,
  merged_at: null,
  ...row,
  normalized_phone: typeof row.phone === "string" ? row.phone.slice(-10) : null,
})

// The dedupe window is measured from the real clock, so the upsert world is built around it.
function upsertWorld(now: number): Row[] {
  return [
    // The lead that was kept: the customer's Yelp request.
    lead({ id: KEPT, full_name: "Dana Yelp", phone: CUSTOMER, email: "dana@example.test", created_at: iso(now - 10 * DAY), last_seen_at: iso(now - 3 * DAY), latest_message: "Yelp request" }),
    // Their first text made a lead of its own, merged into the Yelp lead; seen after the kept lead (the
    // shape of 9658a648 and 3e9e58e9: the merged row is the newer one on the number).
    lead({ id: MERGED_SAME, phone: CUSTOMER, status: "new", created_at: iso(now - 2 * DAY), last_seen_at: iso(now - 2 * DAY), merged_into: KEPT, merged_at: iso(now - 2 * DAY + 44_000) }),
    // A second phone of theirs, carried only by a merged row (the shape of 763c4888), with an address the
    // kept lead does not have.
    lead({ id: MERGED_CELL, phone: CUSTOMER_CELL, email: "dana.cell@example.test", status: "disqualified", created_at: iso(now - 9 * DAY), last_seen_at: iso(now - 9 * DAY), merged_into: KEPT, merged_at: iso(now - 8 * DAY), latest_message: "old cell text" }),
    // Someone else entirely.
    lead({ id: OTHER_LEAD, full_name: "Other Person", phone: OTHER, created_at: iso(now - 4 * DAY), last_seen_at: iso(now - 4 * DAY) }),
  ]
}

async function upsertText(from: string, body: string, extra: Record<string, unknown> = {}) {
  const db = fakeSupabase({ leads: upsertWorld(Date.now()), lead_touchpoints: [] })
  const result = await upsertLeadFromContact(db as never, {
    name: from,
    phone: from,
    message: body,
    leadSource: "sms_inbound",
    leadChannel: "sms",
    touchpointType: "sms_inbound",
    touchpointSource: "twilio",
    externalTouchpointId: `SM${from.slice(-4)}`,
    rawPayload: { From: from, Body: body },
    ...extra,
  })
  const touchpoints = db.writes.filter((w) => w.table === "lead_touchpoints" && w.op === "insert").flatMap((w) => w.rows)
  const leadWrites = db.writes.filter((w) => w.table === "leads")
  const row = (id: string) => db.tables.leads.find((r) => r.id === id)!
  return { result, touchpoints, leadWrites, row }
}

test("merged filing · a text from a number only a merged row carries lands on the lead it went into", async () => {
  const { result, touchpoints, leadWrites, row } = await upsertText(CUSTOMER_CELL, "This is my cell, is Saturday still open?")
  assert.deepEqual(result, { leadId: KEPT, deduped: true, dedupeReason: "phone_window" })
  assert.deepEqual(touchpoints.map((t) => [t.lead_id, t.touchpoint_type]), [[KEPT, "sms_inbound"]])
  assert.deepEqual(leadWrites.map((w) => [w.op, w.rows.map((r) => r.id)]), [["update", [KEPT]]])
  assert.equal(row(KEPT).latest_message, "This is my cell, is Saturday still open?")
  assert.equal(row(KEPT).touchpoint_count, 2)
  // The kept lead keeps its own number; the hidden row is not touched.
  assert.equal(row(KEPT).phone, CUSTOMER)
  assert.equal(row(MERGED_CELL).latest_message, "old cell text")
})

test("merged filing · a live lead on the number beats the merged row seen after it", async () => {
  const { result, touchpoints, row } = await upsertText(CUSTOMER, "Also, can we start at 6 pm?")
  assert.equal(result.leadId, KEPT)
  assert.deepEqual(touchpoints.map((t) => t.lead_id), [KEPT])
  assert.equal(row(MERGED_SAME).latest_message, null)
})

test("merged filing · an address only a merged row carries lands on the lead it went into", async () => {
  const { result, touchpoints } = await upsertText(STRANGER, "Sent from my work phone", { email: "Dana.Cell@example.test" })
  assert.deepEqual(result, { leadId: KEPT, deduped: true, dedupeReason: "email_window" })
  assert.deepEqual(touchpoints.map((t) => t.lead_id), [KEPT])
})

test("merged filing · without merged rows nothing changed: same lead, or a new one", async () => {
  const other = await upsertText(OTHER, "Is the 14th open?")
  assert.deepEqual(other.result, { leadId: OTHER_LEAD, deduped: true, dedupeReason: "phone_window" })
  const stranger = await upsertText(STRANGER, "Hi, how much for 20?")
  assert.equal(stranger.result.dedupeReason, "new")
  assert.notEqual(stranger.result.leadId, KEPT)
  assert.deepEqual(stranger.leadWrites.map((w) => w.op), ["insert"])
})

// ---- the shared picks ---------------------------------------------------------

const picks = () =>
  fakeSupabase({
    leads: [
      lead({ id: KEPT, full_name: "Dana Yelp", phone: CUSTOMER, created_at: "2030-11-06T05:12:07Z", last_seen_at: "2030-11-13T05:12:07Z" }),
      lead({ id: MERGED_SAME, phone: CUSTOMER, created_at: "2030-11-14T06:07:58Z", last_seen_at: "2030-11-14T06:07:58Z", merged_into: KEPT }),
      lead({ id: MERGED_CELL, phone: CUSTOMER_CELL, created_at: "2030-11-07T06:07:58Z", sms_blocked_at: "2030-11-08T00:00:00Z", merged_into: KEPT }),
      // A merge of a merge: f5 went into f6, which later went into the kept lead.
      lead({ id: "f5", phone: "+19090000155", created_at: "2030-11-01T00:00:00Z", merged_into: "f6" }),
      lead({ id: "f6", phone: "+19090000156", created_at: "2030-11-02T00:00:00Z", merged_into: KEPT }),
      // Merged into a lead that is not there any more, and two rows merged into each other.
      lead({ id: "f7", phone: "+19090000157", created_at: "2030-11-03T00:00:00Z", merged_into: "gone" }),
      lead({ id: "f8", phone: "+19090000158", created_at: "2030-11-04T00:00:00Z", merged_into: "f9" }),
      lead({ id: "f9", phone: "+19090000159", created_at: "2030-11-05T00:00:00Z", merged_into: "f8" }),
      // Two live leads on one number, created and seen in opposite orders.
      lead({ id: "a1", phone: OTHER, created_at: "2030-11-10T00:00:00Z", last_seen_at: "2030-11-15T00:00:00Z" }),
      lead({ id: "a2", phone: OTHER, created_at: "2030-11-12T00:00:00Z", last_seen_at: "2030-11-12T00:00:00Z" }),
    ],
  })

test("merged filing · pickContactRow: the first live row, else the newest merged one", () => {
  const live = { id: "live", merged_into: null }
  const merged = { id: "merged", merged_into: "live" }
  assert.equal(pickContactRow([merged, live]), live)
  assert.equal(pickContactRow([merged]), merged)
  assert.equal(pickContactRow([]), null)
  assert.equal(pickContactRow(null), null)
})

test("merged filing · survivorOf reads the lead a merged row went into, following a merge of a merge", async () => {
  const db = picks()
  const rows = db.tables.leads
  const kept = await survivorOf(db as never, rows.filter((r) => r.id === MERGED_CELL) as never, "id, full_name")
  assert.equal((kept as Row).id, KEPT)
  assert.equal((kept as Row).full_name, "Dana Yelp")
  assert.equal(await survivorId(db as never, { id: "f5", merged_into: "f6" }), KEPT)
  assert.equal(await survivorId(db as never, { id: KEPT, merged_into: null }), KEPT)
  // A broken chain stops on the deepest row there is - never on an id that may not exist.
  assert.equal(await survivorId(db as never, { id: "f7", merged_into: "gone" }), "f7")
  // A loop ends.
  assert.ok(["f8", "f9"].includes(await survivorId(db as never, { id: "f8", merged_into: "f9" })))
  assert.deepEqual(db.writes, [])
})

test("merged filing · currentLeadId: a stored merged id stands for its lead; others come back as they are", async () => {
  const db = picks()
  assert.equal(await currentLeadId(db as never, MERGED_SAME), KEPT)
  assert.equal(await currentLeadId(db as never, KEPT), KEPT)
  assert.equal(await currentLeadId(db as never, "00000000-0000-4000-8000-000000000999"), "00000000-0000-4000-8000-000000000999")
})

test("merged filing · leadOnNumber: the number's own row for its block state, the kept lead for filing", async () => {
  const db = picks()
  const same = await leadOnNumber<{ id: string; sms_blocked_at: string | null }>(db as never, CUSTOMER.slice(-10), "id, sms_blocked_at")
  assert.deepEqual([same?.row.id, same?.leadId], [KEPT, KEPT])
  const cell = await leadOnNumber<{ id: string; sms_blocked_at: string | null }>(db as never, CUSTOMER_CELL.slice(-10), "id, sms_blocked_at")
  assert.deepEqual([cell?.row.id, cell?.row.sms_blocked_at, cell?.leadId], [MERGED_CELL, "2030-11-08T00:00:00Z", KEPT])
  assert.equal((await leadOnNumber(db as never, OTHER.slice(-10), "id"))?.leadId, "a2")
  assert.equal((await leadOnNumber(db as never, OTHER.slice(-10), "id", { orderBy: "last_seen_at" }))?.leadId, "a1")
  assert.equal(await leadOnNumber(db as never, STRANGER.slice(-10), "id"), null)
  assert.equal(await leadOnNumber(db as never, "", "id"), null)
  const broken = fakeSupabase({}, { missing: ["leads"] })
  assert.equal(await leadOnNumber(broken as never, CUSTOMER.slice(-10), "id"), null)
  assert.deepEqual(db.writes, [])
})

test("merged filing · withMergedInto adds the column once", () => {
  assert.equal(withMergedInto("id, sms_blocked_at"), "id, sms_blocked_at, merged_into")
  assert.equal(withMergedInto("id, merged_into"), "id, merged_into")
  assert.equal(withMergedInto("*"), "*")
})

// ---- 不用回 / hold on the kept lead ------------------------------------------------

const NOW = Date.parse("2030-11-16T19:00:00Z")
const quietWorld = (kept: Row) => [
  lead({ id: KEPT, phone: CUSTOMER, created_at: "2030-11-06T05:12:07Z", ...kept }),
  lead({ id: MERGED_CELL, phone: CUSTOMER_CELL, created_at: "2030-11-07T06:07:58Z", merged_into: KEPT }),
  lead({ id: "f5", phone: "+19090000155", created_at: "2030-11-01T00:00:00Z", merged_into: "f6" }),
  lead({ id: "f6", phone: "+19090000156", created_at: "2030-11-02T00:00:00Z", merged_into: KEPT }),
  lead({ id: OTHER_LEAD, phone: OTHER, created_at: "2030-11-04T00:00:00Z" }),
]

test("merged filing · 不用回 on the kept lead quiets the numbers merged into it", async () => {
  const quiet = await loadQuiet(fakeSupabase({ leads: quietWorld({ acked_until: iso(NOW - 10 * MIN) }) }) as never, NOW)
  for (const n of [CUSTOMER, CUSTOMER_CELL, "+19090000155", "+19090000156"]) {
    assert.equal(quiet.quiet(n, NOW - 30 * MIN), true, `${n} before the ack`)
    assert.equal(quiet.quiet(n, NOW - 5 * MIN), false, `${n} after the ack`)
  }
  assert.equal(quiet.quiet(OTHER, NOW - 30 * MIN), false)
})

test("merged filing · a hold on the kept lead holds the numbers merged into it", async () => {
  const quiet = await loadQuiet(fakeSupabase({ leads: quietWorld({ hold_until: iso(NOW + 7 * DAY), hold_set_at: iso(NOW - 60 * MIN) }) }) as never, NOW)
  assert.equal(quiet.quiet(CUSTOMER_CELL, NOW - 90 * MIN), true)
  // They spoke after the hold: it is our turn again.
  assert.equal(quiet.quiet(CUSTOMER_CELL, NOW - 30 * MIN), false)
  assert.equal(quiet.quiet(OTHER, NOW - 90 * MIN), false)
})

test("merged filing · a merged row's own 不用回 still quiets only its own number", async () => {
  const leads = quietWorld({})
  leads.find((r) => r.id === MERGED_CELL)!.acked_until = iso(NOW - 10 * MIN)
  const quiet = await loadQuiet(fakeSupabase({ leads }) as never, NOW)
  assert.equal(quiet.quiet(CUSTOMER_CELL, NOW - 30 * MIN), true)
  assert.equal(quiet.quiet(CUSTOMER, NOW - 30 * MIN), false)
})

test("merged filing · desk: a text from the merged number leaves once the kept lead is marked 不用回", async () => {
  const received = (from: string, at: number, body: string): TwilioMessage => ({ sid: `SMi${at}`, direction: "inbound", body, from, to: OURS, status: "received", date_sent: iso(at), date_created: iso(at), num_media: "0" })
  const inbound = [received(CUSTOMER_CELL, NOW - 30 * MIN, "This is my cell, can we start at 6 pm?")]
  const run = async (kept: Row) => {
    const db = fakeSupabase({ leads: quietWorld(kept), lead_touchpoints: [] })
    const saved = { fetch: globalThis.fetch, sid: process.env.TWILIO_ACCOUNT_SID, token: process.env.TWILIO_AUTH_TOKEN, caller: process.env.TWILIO_CALLER_ID }
    process.env.TWILIO_ACCOUNT_SID = "ACtest"
    process.env.TWILIO_AUTH_TOKEN = "test"
    process.env.TWILIO_CALLER_ID = OURS
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input)
      if (!url.startsWith("https://api.twilio.com/")) throw new Error(`inbox test: unexpected request ${url}`)
      const list = url.includes("Messages.json?From=") ? [] : inbound
      return new Response(JSON.stringify({ messages: list }), { headers: { "content-type": "application/json" } })
    }) as typeof fetch
    try {
      const { events } = await computeInbox(db as never, NOW, { includeFresh: true, noCache: true })
      assert.deepEqual(db.writes, [], "the inbox only reads")
      return events.filter((e) => e.kind === "sms").map((e) => e.leadId)
    } finally {
      globalThis.fetch = saved.fetch
      for (const [k, v] of [["TWILIO_ACCOUNT_SID", saved.sid], ["TWILIO_AUTH_TOKEN", saved.token], ["TWILIO_CALLER_ID", saved.caller]] as const) {
        if (v === undefined) delete process.env[k]
        else process.env[k] = v
      }
    }
  }
  // The card names the kept lead (2026-11-16); `desk ack <that id>` is what the owner runs.
  assert.deepEqual(await run({}), [KEPT])
  assert.deepEqual(await run({ acked_until: iso(NOW - 10 * MIN) }), [])
  // An ack from before the text does not swallow it.
  assert.deepEqual(await run({ acked_until: iso(NOW - 60 * MIN) }), [KEPT])
})
