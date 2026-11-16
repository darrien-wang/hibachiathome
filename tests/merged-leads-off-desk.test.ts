// Layer-2 self-test: a merged lead is never on the desk's lists (2026-11-16).
// 2026-11-15 22:08: 9658a648, a lead the 213 line made from a text, was merged
// into the same customer's Yelp lead (PATCH /api/admin/leads, action merge).
// Merging hides the row and moves its touchpoints, but leaves its status at
// 'new', so at 23:10 `desk next` still listed it as "[lead] 等了 63 分钟 ⚠️" and
// the watcher kept reminding until `desk ack` on the hidden row. The merged row
// is also the newer one on the customer's number (the oldest row is the one
// kept), so the next text from them would have opened the hidden row again.
//   - the inbox's new-lead list (desk next, the phone) leaves merged rows out
//   - a text from the number names the live lead, not the newer merged row
//   - a number only a merged row carries stands for the lead it went into
//   - a text of ours that never arrived points at the live lead too
//   - the scan's pool leaves merged rows out (it already did; kept that way)
// lead-watch's first-response list has the same filter; that route has no
// harness of its own.
// In-memory database; Twilio is two canned lists behind a replaced fetch.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { computeInbox, leadPerPhone, type InboxEvent } from "../lib/inbox"
import { scanLeads } from "../lib/lead-scan"
import type { TwilioMessage } from "../lib/sms-thread"
import { fakeSupabase, type Row } from "./fixtures/fake-supabase"

const OURS = "+12137707788"
// Not 555 numbers: the inbox drops those as our own test traffic. Exchange 000 is never assigned either.
const CUSTOMER = "+19090000177"
const CUSTOMER_CELL = "+19090000188"
const OTHER = "+19090000199"
const YELP_LEAD = "00000000-0000-4000-8000-0000000000e1"
const MERGED = "00000000-0000-4000-8000-0000000000e2"
const FRESH = "00000000-0000-4000-8000-0000000000e3"
// 23:10 Pacific on Fri Nov 15 2030, the moment of the 2026 report.
const NOW = Date.parse("2030-11-16T07:10:00Z")
const MIN = 60_000
const iso = (ms: number) => new Date(ms).toISOString()

const lead = (row: Row): Row => ({
  full_name: null,
  email: null,
  lead_source: null,
  city_or_zip: null,
  guest_count: null,
  latest_message: null,
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
// The lead that was kept: the customer's Yelp request, answered (21:12).
const yelpLead = lead({ id: YELP_LEAD, full_name: "Dana Yelp", phone: CUSTOMER, status: "qualified", lead_source: "yelp", created_at: "2030-11-16T05:12:07Z" })
// Their text made a lead of its own at 22:07:58; merged into the Yelp lead 44 seconds later.
const mergedText = lead({ id: MERGED, phone: CUSTOMER, status: "new", lead_source: "sms_inbound", latest_message: "Hi, is Saturday open?", created_at: "2030-11-16T06:07:58Z", merged_into: YELP_LEAD, merged_at: "2030-11-16T06:08:42Z" })
// Someone else, new and unanswered: this one is a new lead waiting.
const freshLead = lead({ id: FRESH, full_name: "Fresh Lead", phone: OTHER, status: "new", lead_source: "quote_unlock", created_at: "2030-11-16T06:50:00Z" })

const sent = (to: string, at: number, body: string, status = "delivered"): TwilioMessage => ({ sid: `SMo${at}`, direction: "outbound-api", body, from: OURS, to, status, date_sent: iso(at), date_created: iso(at) })
const received = (from: string, at: number, body: string): TwilioMessage => ({ sid: `SMi${at}`, direction: "inbound", body, from, to: OURS, status: "received", date_sent: iso(at), date_created: iso(at), num_media: "0" })

type World = { leads: Row[]; outbound?: TwilioMessage[]; inbound?: TwilioMessage[] }

async function inbox(w: World) {
  const db = fakeSupabase({ leads: w.leads.map((r) => ({ ...r })), lead_touchpoints: [] })
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
    const result = await computeInbox(db as never, NOW, { includeFresh: true, noCache: true })
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

const newLeadCards = (events: InboxEvent[]) => events.filter((e) => e.kind === "lead" || e.kind === "call").map((e) => e.leadId)
const show = (events: InboxEvent[]) => JSON.stringify(events.map((e) => [e.kind, e.leadId, e.title]))

test("merged · the merged row is off the new-lead list and out of the 新线索 count", async () => {
  const { counts, events } = await inbox({ leads: [yelpLead, mergedText, freshLead] })
  assert.deepEqual(newLeadCards(events), [FRESH], show(events))
  assert.equal(counts.newLeads, 1)
})

test("merged · the same row before the merge was a new lead waiting (the list itself still works)", async () => {
  const { counts, events } = await inbox({ leads: [yelpLead, { ...mergedText, merged_into: null, merged_at: null }, freshLead] })
  assert.deepEqual(newLeadCards(events).sort(), [MERGED, FRESH].sort(), show(events))
  assert.equal(counts.newLeads, 2)
  const card = events.find((e) => e.leadId === MERGED)!
  assert.equal(card.title, "新询盘 · (909) 000-0177")
  assert.equal(card.waitedMinutes, 62)
})

test("merged · a text from the customer's number names the live lead, not the newer merged row", async () => {
  const { events } = await inbox({ leads: [yelpLead, mergedText], inbound: [received(CUSTOMER, NOW - 5 * MIN, "Also, can we start at 6 pm?")] })
  const sms = events.filter((e) => e.kind === "sms")
  assert.equal(sms.length, 1, show(events))
  assert.equal(sms[0].leadId, YELP_LEAD)
  assert.equal(sms[0].url, `/admin?tab=leads&lead=${YELP_LEAD}`)
  assert.match(sms[0].title, /^Dana Yelp 等了 5 分钟$/)
  assert.deepEqual(newLeadCards(events), [], show(events))
})

test("merged · a number only a merged row carries stands for the lead it went into", async () => {
  const fromCell = lead({ ...mergedText, full_name: "Dana (cell)", phone: CUSTOMER_CELL })
  const { events } = await inbox({ leads: [yelpLead, fromCell], inbound: [received(CUSTOMER_CELL, NOW - 5 * MIN, "This is my cell, text me here")] })
  const sms = events.filter((e) => e.kind === "sms")
  assert.equal(sms.length, 1, show(events))
  assert.equal(sms[0].leadId, YELP_LEAD)
  assert.equal(sms[0].url, `/admin?tab=leads&lead=${YELP_LEAD}`)
  assert.match(sms[0].title, /^Dana \(cell\) 等了 5 分钟$/)
})

test("merged · a text of ours that never arrived points at the live lead", async () => {
  const { counts, events } = await inbox({ leads: [yelpLead, mergedText], outbound: [sent(CUSTOMER, NOW - 45 * MIN, "Real Hibachi: Saturday works, here is the link", "sent")] })
  const card = events.filter((e) => e.kind === "undelivered")
  assert.equal(card.length, 1, show(events))
  assert.equal(card[0].leadId, YELP_LEAD)
  assert.equal(card[0].url, `/admin?tab=leads&lead=${YELP_LEAD}`)
  assert.equal(counts.undelivered, 1)
})

test("merged · leadPerPhone: the live lead wins over a newer merged one; a lone merged row stands for its lead", () => {
  const phone = (r: { phone: string | null }) => r.phone
  const live = { id: "live", phone: "a", name: "kept", merged_into: null }
  const newerLive = { id: "newer", phone: "a", name: "newer live", merged_into: null }
  const merged = { id: "merged", phone: "a", name: "merged", merged_into: "live" }
  const lone = { id: "lone", phone: "b", name: "cell", merged_into: "live" }
  const none = { id: "none", phone: null, name: "no phone", merged_into: null }
  const picked = leadPerPhone([merged, lone, newerLive, live, none], phone)
  assert.deepEqual([...picked.keys()].sort(), ["a", "b"])
  // Newest first among live rows, as before.
  assert.equal(picked.get("a"), newerLive)
  assert.deepEqual(picked.get("b"), { id: "live", phone: "b", name: "cell", merged_into: "live" })
  assert.equal(leadPerPhone([merged, live], phone).get("a"), live)
  assert.equal(lone.id, "lone", "the row passed in is not changed")
})

test("merged · the scan's pool leaves the merged row out", async () => {
  const saved = { sid: process.env.TWILIO_ACCOUNT_SID, token: process.env.TWILIO_AUTH_TOKEN }
  // No Twilio: the thread is the timeline.
  delete process.env.TWILIO_ACCOUNT_SID
  delete process.env.TWILIO_AUTH_TOKEN
  try {
    const db = fakeSupabase({ leads: [yelpLead, mergedText, freshLead].map((r) => ({ ...r })), lead_touchpoints: [], orders: [] })
    const r = await scanLeads(db as never, NOW, { lint: false, write: false })
    assert.deepEqual(r.items.map((i) => i.leadId).sort(), [YELP_LEAD, FRESH].sort())
    assert.deepEqual(db.writes, [], "the scan only reads")
  } finally {
    if (saved.sid !== undefined) process.env.TWILIO_ACCOUNT_SID = saved.sid
    if (saved.token !== undefined) process.env.TWILIO_AUTH_TOKEN = saved.token
  }
})
