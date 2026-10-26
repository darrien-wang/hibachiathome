// Layer-2 self-test: a "thanks" past its 2-hour window is not a stop
// (lib/lead-scan.ts). 626-428-5292 said she was checking with the other hosts
// and would get back to us, then "I appreciate it!"; the scan filed her under
// H "最后一条是客气话，已过 2 小时，不再补" with no next action, ahead of her
// [callback], and nobody wrote for 25 days (2026-10-24, five more like her).
// The window only decides whether the one-line close is still owed; after it
// the lead reads as if we spoke last.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { scanLeads } from "../lib/lead-scan"
import { ourSmsNumber, type TwilioMessage } from "../lib/sms-thread"

// No Twilio unless a test brings its own: the thread is the timeline.
delete process.env.TWILIO_ACCOUNT_SID
delete process.env.TWILIO_AUTH_TOKEN

type Row = Record<string, unknown>

/** Just enough PostgREST for scanLeads: the filters it uses, on rows in memory. Nothing can be written. */
function fakeSupabase(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      let rows = [...(tables[table] ?? [])]
      const keep = (f: (r: Row) => boolean) => ((rows = rows.filter(f)), q)
      const q = {
        select: () => q,
        or: () => q,
        eq: (c: string, v: unknown) => keep((r) => r[c] === v),
        in: (c: string, vs: unknown[]) => keep((r) => vs.includes(r[c])),
        is: (c: string) => keep((r) => r[c] == null),
        not: (c: string, op: string, v: string | null) => keep((r) => (op === "is" ? r[c] != null : !String(v).slice(1, -1).split(",").includes(String(r[c])))),
        gt: (c: string, v: string) => keep((r) => Date.parse(String(r[c])) > Date.parse(v)),
        gte: (c: string, v: string) => keep((r) => Date.parse(String(r[c])) >= Date.parse(v)),
        lte: (c: string, v: string) => keep((r) => Date.parse(String(r[c])) <= Date.parse(v)),
        order: (c: string, o?: { ascending?: boolean }) => ((rows = rows.sort((a, b) => String(a[c]).localeCompare(String(b[c])) * (o?.ascending === false ? -1 : 1))), q),
        range: (from: number, to: number) => ((rows = rows.slice(from, to + 1)), q),
        then: (ok: (v: { data: Row[]; error: null }) => unknown, fail?: (e: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(ok, fail),
      }
      return q
    },
  } as never
}

const PHONE = "+16265550142"
type Tp = { at: string; type: string; payload: Row }
const sent = (at: string, body: string): Tp => ({ at, type: "sms_outbound", payload: { body } })
const got = (at: string, body: string): Tp => ({ at, type: "sms_inbound", payload: { Body: body, NumMedia: "0" } })
const note = (at: string, text: string): Tp => ({ at, type: "agent_note", payload: { note: text } })

function pool(thread: Tp[], lead: Row = {}) {
  const id = "00000000-0000-4000-8000-000000000001"
  return {
    leads: [{ id, created_at: thread[0].at, full_name: "Test Lead", phone: PHONE, email: null, status: "qualified", city_or_zip: "Palm Springs", guest_count: 11, hold_until: null, hold_set_at: null, acked_until: null, sms_blocked_at: null, ...lead }],
    lead_touchpoints: thread.map((t) => ({ lead_id: id, touchpoint_type: t.type, occurred_at: t.at, raw_payload_json: t.payload })),
    orders: [],
  }
}

async function scanAt(tables: Record<string, Row[]>, at: string) {
  const r = await scanLeads(fakeSupabase(tables), Date.parse(at), { lint: false })
  assert.equal(r.items.length, 1)
  return r.items[0]
}

// 318-278-0047 (10-16): we answered everything and sent the link, a "Thank you" came back.
const vacation = [
  sent("2026-10-16T20:19:00Z", "Real Hibachi: your Palm Springs hibachi price is $880.50 for 15 adults (Standard (any day))."),
  sent("2026-10-16T20:29:00Z", "Hi! Rowling from Real Hibachi 👋 Saw your quote — what's the celebration?"),
  got("2026-10-16T20:33:00Z", "Family Vacay - we only have 11 adults."),
  sent("2026-10-16T20:34:00Z", "A family vacation - love it! For 11 adults it's $671.90 with travel to Palm Springs. Which night are you thinking?"),
  got("2026-10-16T20:37:00Z", "Dec 28 - Jan 2"),
  sent("2026-10-16T20:38:00Z", "Any night that week works! Here's the link - just pick your night on it, card on file, nothing charged today."),
]
const thanked = [...vacation, got("2026-10-16T20:38:35Z", "Thank you")]

test("scan courtesy · inside 2 hours the thanks is owed the one-line close → A", async () => {
  const it = await scanAt(pool(thanked), "2026-10-16T21:38:35Z")
  assert.equal(it.bucket, "A")
  assert.equal(it.reason, "客气话，回一句收尾")
})

test("scan courtesy · past 2 hours, nothing on file → D once our last text is 20 hours old, under the cap", async () => {
  const early = await scanAt(pool(thanked), "2026-10-17T12:00:00Z")
  assert.equal(early.bucket, "H", "15 hours after our text: the usual spacing, not a stop")
  assert.equal(early.reason, "我们 2026-10-16T20:38 刚发过，第 2 天再看")
  assert.equal(early.nextActionAt, "2026-10-17T16:38:00.000Z")

  const due = await scanAt(pool(thanked), "2026-10-18T19:00:00Z")
  assert.equal(due.bucket, "D")
  assert.equal(due.reason, "沉默 46 小时，第 1 条到期（客人最后回的是客气话，那句不补）")
  assert.equal(due.nextActionAt, "2026-10-18T19:00:00.000Z")
  assert.equal(due.run, 0)
})

// 626-428-5292 (09-29): the [callback] note and our 2-day hold went in at 16:40 PT, her thanks at 16:42.
const hosts = [
  sent("2026-09-29T23:17:00Z", "Real Hibachi: your South Whittier hibachi price is $898.40 for 16 adults (Standard (any day))."),
  sent("2026-09-29T23:33:00Z", "Hi! Bling from Real Hibachi 👋 Saw your quote for 16 on Sat, Oct 31 - that date's open on our end. What's the celebration?"),
  got("2026-09-29T23:36:00Z", "Hello! Thank you for the info. I am corresponding with the other hosts at the moment. I will get back to you as soon as possible."),
  sent("2026-09-29T23:40:00Z", "Sounds good - I'll keep Oct 31 penciled in for your group in the meantime."),
  note("2026-09-29T23:40:20Z", "[callback] her words 09-29 16:36: 'I am corresponding with the other hosts at the moment.' - a shared Halloween party, 16, Sat 2026-10-31"),
  got("2026-09-29T23:42:00Z", "I appreciate it!"),
]
const hostsHold = { hold_set_at: "2026-09-29T23:40:37Z", hold_until: "2026-10-01T23:40:37Z", city_or_zip: "South Whittier", guest_count: 16 }

test("scan courtesy · past 2 hours with a [callback] and the hold run out → B, though the thanks came after the note", async () => {
  // 10-24, a week before the party: E would come next if the thanks voided the callback.
  const it = await scanAt(pool(hosts, hostsHold), "2026-10-24T19:00:00Z")
  assert.equal(it.bucket, "B")
  assert.match(it.reason, /^承诺到期：her words 09-29 16:36: 'I am corresponding with the other hosts/)
  assert.equal(it.nextActionAt, "2026-10-24T19:00:00.000Z")
  assert.equal(it.daysToEvent, 7)
})

// 760-442-8028 (09-28): "check with my people first", our reply and a 2-day hold, then "Awesome" 8 minutes later.
const people = [
  sent("2026-09-28T17:55:00Z", "Real Hibachi: your Palm Springs hibachi price is $641.00 for 10 adults (Standard (any day))."),
  sent("2026-09-28T17:56:00Z", "Hi, it's Bling from Real Hibachi. What kind of party are you planning?"),
  got("2026-09-28T18:02:00Z", "Ok. I was thinking for a Halloween party we got going on in October 24th"),
  sent("2026-09-28T18:05:00Z", "We currently have availability at both 4 PM and 7 PM on October 24th. Which time would work better for you?"),
  got("2026-09-28T18:10:00Z", "Ok I need to check with my people first to see how many are coming"),
  sent("2026-09-28T18:13:00Z", "Sounds good - take your time. Send me the headcount when you have it."),
  got("2026-09-28T18:21:00Z", "Awesome"),
]
const peopleHold = { hold_set_at: "2026-09-28T18:13:53Z", hold_until: "2026-09-30T18:13:53Z" }

test("scan courtesy · past 2 hours on an active hold → H until the hold, though the thanks came after it", async () => {
  const held = await scanAt(pool(people, peopleHold), "2026-09-29T19:00:00Z")
  assert.equal(held.bucket, "H")
  assert.equal(held.reason, "挂起到 2026-09-30")
  assert.equal(held.nextActionAt, "2026-09-30T18:13:53Z")

  // Ran out with only the thanks since: dormant, like any lead whose hold expired in silence.
  const after = await scanAt(pool(people, peopleHold), "2026-10-02T19:00:00Z")
  assert.equal(after.bucket, "H")
  assert.match(after.reason, /^休眠：挂起 2026-09-30 到期/)
  assert.equal(after.nextActionAt, null)
})

test("scan courtesy · the same when the thread comes from Twilio (the carrier stamps a second later)", async () => {
  const ours = ourSmsNumber()
  const stamp = (at: string) => new Date(Date.parse(at) + 1000).toISOString()
  const msg = (t: Tp, i: number): TwilioMessage => {
    const inbound = t.type === "sms_inbound"
    const body = String(inbound ? t.payload.Body : t.payload.body)
    return { sid: `SM${i}`, direction: inbound ? "inbound" : "outbound-api", body, from: inbound ? PHONE : ours, to: inbound ? ours : PHONE, status: inbound ? "received" : "delivered", date_sent: stamp(t.at), date_created: stamp(t.at), num_media: "0" }
  }
  const texts = hosts.filter((t) => t.type !== "agent_note").map(msg)
  const saved = globalThis.fetch
  process.env.TWILIO_ACCOUNT_SID = "ACtest"
  process.env.TWILIO_AUTH_TOKEN = "test"
  globalThis.fetch = (async (url: string | URL | Request) => {
    const u = String(url)
    if (!u.startsWith("https://api.twilio.com/")) throw new Error(`unexpected fetch ${u}`)
    const outbound = u.includes(`From=${encodeURIComponent(ours)}`)
    return new Response(JSON.stringify({ messages: texts.filter((m) => (m.direction === "inbound") !== outbound) }), { status: 200 })
  }) as typeof fetch
  try {
    const it = await scanAt(pool(hosts, hostsHold), "2026-10-24T19:00:00Z")
    assert.equal(it.bucket, "B")
    assert.equal(it.lastAt, stamp("2026-09-29T23:42:00Z"), "Twilio's copy of the thanks was read")
  } finally {
    globalThis.fetch = saved
    delete process.env.TWILIO_ACCOUNT_SID
    delete process.env.TWILIO_AUTH_TOKEN
  }
})

test("scan courtesy · a reaction is still never answered (the tapback branch is unchanged)", async () => {
  const it = await scanAt(pool([...vacation, got("2026-10-16T20:38:35Z", "Loved “Any night that week works!”")]), "2026-10-18T19:00:00Z")
  assert.equal(it.bucket, "H")
  assert.equal(it.reason, "最后一条是点赞，不用回")
  assert.equal(it.nextActionAt, null)
})
