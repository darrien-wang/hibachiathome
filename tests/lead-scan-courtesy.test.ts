// Layer-2 self-test: a "thanks" past its 2-hour window is not a stop
// (lib/lead-scan.ts). 626-428-5292 said she was checking with the other hosts
// and would get back to us, then "I appreciate it!"; the scan filed her under
// H "最后一条是客气话，已过 2 小时，不再补" with no next action, ahead of her
// [callback], and nobody wrote for 25 days (2026-10-24, five more like her).
// The window only decides whether the one-line close is still owed; after it
// the lead reads as if we spoke last. A reaction ("Liked …") is never
// answered and was the same stop: 805-455-1668 liked our "take your time"
// with a [callback] on file and sat four weeks (2026-10-25).
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
const got = (at: string, body: string, media = 0): Tp => ({ at, type: "sms_inbound", payload: { Body: body, NumMedia: String(media) } })
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
  // The desk acks a thanks it will not answer (leads §1.6); the ack is not a stop.
  const acked = { acked_until: "2026-10-17T01:00:00Z" }
  const early = await scanAt(pool(thanked, acked), "2026-10-17T12:00:00Z")
  assert.equal(early.bucket, "H", "15 hours after our text: the usual spacing, not a stop")
  assert.equal(early.reason, "我们 2026-10-16T20:38 刚发过，第 2 天再看")
  assert.equal(early.nextActionAt, "2026-10-17T16:38:00.000Z")

  const due = await scanAt(pool(thanked, acked), "2026-10-18T19:00:00Z")
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

/** The carrier stamps a text a second after the timeline logs it. */
const stamp = (at: string) => new Date(Date.parse(at) + 1000).toISOString()

/** Runs fn with Twilio's two message lists answering from `thread`. */
async function withTwilio<T>(thread: Tp[], fn: () => Promise<T>): Promise<T> {
  const ours = ourSmsNumber()
  const texts = thread
    .filter((t) => t.type !== "agent_note")
    .map((t, i): TwilioMessage => {
      const inbound = t.type === "sms_inbound"
      const body = String(inbound ? t.payload.Body : t.payload.body)
      return { sid: `SM${i}`, direction: inbound ? "inbound" : "outbound-api", body, from: inbound ? PHONE : ours, to: inbound ? ours : PHONE, status: inbound ? "received" : "delivered", date_sent: stamp(t.at), date_created: stamp(t.at), num_media: String(t.payload.NumMedia ?? "0") }
    })
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
    return await fn()
  } finally {
    globalThis.fetch = saved
    delete process.env.TWILIO_ACCOUNT_SID
    delete process.env.TWILIO_AUTH_TOKEN
  }
}

test("scan courtesy · the same when the thread comes from Twilio (the carrier stamps a second later)", async () => {
  const it = await withTwilio(hosts, () => scanAt(pool(hosts, hostsHold), "2026-10-24T19:00:00Z"))
  assert.equal(it.bucket, "B")
  assert.equal(it.lastAt, stamp("2026-09-29T23:42:00Z"), "Twilio's copy of the thanks was read")
})

test("scan courtesy · our text from the phone app before the thanks is not part of the run", async () => {
  // The link went out from the phone app: Twilio has it, the timeline does not.
  const timeline = thanked.filter((t) => t.at !== "2026-10-16T20:38:00Z")
  const it = await withTwilio(thanked, () => scanAt(pool(timeline), "2026-10-18T19:00:00Z"))
  assert.equal(it.bucket, "D")
  assert.equal(it.run, 0)
  assert.match(it.reason, /^沉默 46 小时，第 1 条到期/)
})

test("scan reaction · never answered, then the usual spacing; it does not restart the count", async () => {
  // Liked instead of thanked, and acked by the desk two minutes later.
  const liked = pool([...vacation, got("2026-10-16T20:38:35Z", "Loved “Any night that week works!”")], { acked_until: "2026-10-16T20:40:00Z" })
  const soon = await scanAt(liked, "2026-10-16T21:00:00Z")
  assert.equal(soon.bucket, "H", "not A: a reaction gets no reply")
  assert.equal(soon.reason, "我们 2026-10-16T20:38 刚发过，第 2 天再看")
  assert.equal(soon.nextActionAt, "2026-10-17T16:38:00.000Z")

  const due = await scanAt(liked, "2026-10-18T19:00:00Z")
  assert.equal(due.bucket, "D")
  assert.equal(due.reason, "沉默 46 小时，第 2 条到期（客人最后只点了个赞，那个不回）", "our link after \"Dec 28 - Jan 2\" still counts")
  assert.equal(due.run, 1)
  assert.ok(due.flags.includes("tapback_last"))
})

// 805-455-1668 (09-28): "Let me talk to my husband", our "take your time" with a [callback] and a hold, then a like.
const husband = [
  sent("2026-09-28T23:30:00Z", "Real Hibachi: your Oxnard hibachi price is $599.00 for 10 adults (Standard (any day))."),
  got("2026-09-28T23:38:00Z", "So the $599 covers up to 10 people?"),
  sent("2026-09-28T23:40:00Z", "Yes - up to 10 guests for $599, and each extra adult is $59.90."),
  got("2026-09-28T23:41:00Z", "Ahhhh. Ok I see. Let me talk to my husband."),
  sent("2026-09-28T23:44:00Z", "Of course - take your time. I'll be here when you're ready."),
  note("2026-09-28T23:44:30Z", "[callback] 16:41 'Ahhhh. Ok I see. Let me talk to my husband.' - the ball is hers"),
  got("2026-09-28T23:45:00Z", "Liked “Of course - take your time. I'll be here when you're ready.”"),
]
const husbandHold = { hold_set_at: "2026-09-28T23:44:40Z", hold_until: "2026-10-05T23:44:40Z" }

test("scan reaction · after a [callback]: H while the hold runs, then B, though the like came after both", async () => {
  const held = await scanAt(pool(husband, husbandHold), "2026-10-01T19:00:00Z")
  assert.equal(held.bucket, "H")
  assert.equal(held.reason, "挂起到 2026-10-05（客人自设节奏）")
  assert.equal(held.nextActionAt, "2026-10-05T23:44:40Z")

  const due = await scanAt(pool(husband, husbandHold), "2026-10-25T19:00:00Z")
  assert.equal(due.bucket, "B")
  assert.match(due.reason, /^承诺到期：16:41 'Ahhhh\. Ok I see\. Let me talk to my husband\.'/)
})

test("scan reaction · a customer who likes every text is still capped at 3", async () => {
  const liker = [
    got("2026-10-01T18:00:00Z", "We're thinking about a birthday dinner for 12, maybe in November"),
    sent("2026-10-01T18:02:00Z", "Love it! For 12 it's $718.80 any night. Which weekend are you thinking?"),
    got("2026-10-01T18:03:00Z", "Liked “Love it! For 12 it's $718.80 any night. Which weekend are you thinking?”"),
    sent("2026-10-02T18:10:00Z", "Figured November is filling up for you - want me to check a Saturday?"),
    got("2026-10-02T18:30:00Z", "Liked “Figured November is filling up for you - want me to check a Saturday?”"),
    sent("2026-10-03T18:15:00Z", "Happy to hold a night whenever you're ready."),
    got("2026-10-03T18:20:00Z", "Loved “Happy to hold a night whenever you're ready.”"),
  ]
  const it = await scanAt(pool(liker), "2026-10-04T19:00:00Z")
  assert.equal(it.bucket, "H")
  assert.equal(it.run, 3)
  assert.equal(it.reason, "已连发 3 条无回复，满 3 条封顶——还没挂起，挂 14 天")
  assert.ok(it.flags.includes("needs_hold"))
})

test("scan reaction · photos then a like, older than Twilio's record: the photos are owed an answer → A", async () => {
  // 909-268-7235's thread (10-05), read from the timeline alone.
  const photos = [
    sent("2026-10-05T17:46:00Z", "We do - they're normally $10 a guest."),
    sent("2026-10-05T17:47:15Z", "Send me a photo if you're not sure."),
    got("2026-10-05T18:10:10Z", "", 2),
    got("2026-10-05T18:11:22Z", "", 1),
    got("2026-10-05T18:11:51Z", "Loved “We do - they're normally $10 a guest.”"),
  ]
  const it = await scanAt(pool(photos), "2026-10-05T19:00:00Z")
  assert.equal(it.bucket, "A")
  assert.equal(it.reason, "客人最后说话，欠回复")
})
