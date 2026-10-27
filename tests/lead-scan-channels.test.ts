// Layer-2 self-test: Yelp / Facebook / Instagram leads are answered in their
// channel (lib/lead-scan.ts). Since the owner put every channel's leads in the
// workbench (2026-10-26), Yelp and Messenger conversations are leads with no
// number and no e-mail. The scan filed Brenda Q. and Kyle B. (Yelp) under H
// "没留电话也没留邮箱，联系不上", and Jasmine L. (Yelp, her number on the lead)
// under A "客人发了邮件，欠回复（用邮件回）" after we had answered her in Yelp.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { scanLeads } from "../lib/lead-scan"

// No Twilio: the thread is the timeline.
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

type Tp = { at: string; type: string; payload: Row }
const yelpMail = (at: string, subject: string): Tp => ({ at, type: "email_inbound", payload: { subject, via: "gmail_script", yelp: { kind: "request" } } })
const note = (at: string, text: string): Tp => ({ at, type: "agent_note", payload: { note: text } })

function pool(thread: Tp[], lead: Row) {
  const id = "00000000-0000-4000-8000-000000000002"
  return {
    leads: [{ id, created_at: thread[0].at, full_name: "Test Lead", phone: null, email: null, status: "qualified", city_or_zip: null, guest_count: null, hold_until: null, hold_set_at: null, acked_until: null, sms_blocked_at: null, ...lead }],
    lead_touchpoints: thread.map((t) => ({ lead_id: id, touchpoint_type: t.type, occurred_at: t.at, raw_payload_json: t.payload })),
    orders: [],
  }
}

async function scanAt(tables: Record<string, Row[]>, at: string) {
  const r = await scanLeads(fakeSupabase(tables), Date.parse(at), { lint: false })
  assert.equal(r.items.length, 1)
  return r.items[0]
}

const YELP = { full_name: "Brenda Q. (Yelp)", lead_source: "yelp", lead_channel: "yelp" }

test("scan channels · a Yelp conversation entered by hand → H, answered in Yelp, no next action", async () => {
  const it = await scanAt(pool([note("2026-10-27T01:43:00Z", "[Yelp] quoted $1,138 in Yelp, waiting on her pick")], YELP), "2026-10-27T17:00:00Z")
  assert.equal(it.bucket, "H")
  assert.equal(it.reason, "Yelp 对话，我们最后说话：在 Yelp 里等他回（巡查盯着，跟进人工定）")
  assert.equal(it.nextActionAt, null)
})

test("scan channels · a Yelp message the mail filed is the customer speaking until acked", async () => {
  const thread = [yelpMail("2026-10-27T01:16:00Z", "New Lead: Reply to Jasmine's catering request")]
  const open = await scanAt(pool(thread, YELP), "2026-10-27T01:30:00Z")
  assert.equal(open.bucket, "A")
  assert.equal(open.reason, "客人在 Yelp 发了消息，去 Yelp 回，回完 desk ack")

  const acked = await scanAt(pool(thread, { ...YELP, acked_until: "2026-10-27T01:44:00Z" }), "2026-10-27T17:00:00Z")
  assert.equal(acked.bucket, "H")
  assert.equal(acked.nextActionAt, null)
})

test("scan channels · a Yelp lead with her number: the Yelp mail is not an e-mail to answer by e-mail", async () => {
  const thread = [yelpMail("2026-10-27T01:16:00Z", "New Lead: Reply to Jasmine's catering request")]
  const it = await scanAt(pool(thread, { ...YELP, phone: "+15105550188", acked_until: "2026-10-27T01:44:00Z" }), "2026-10-27T17:00:00Z")
  assert.equal(it.bucket, "H")
  assert.equal(it.reason, "Yelp 对话，我们最后说话：在 Yelp 里等他回（巡查盯着，跟进人工定）")
})

test("scan channels · a Messenger conversation entered by hand → H in Facebook", async () => {
  const fb = { full_name: "Martir Pamela (Facebook)", lead_source: "manual_facebook", lead_channel: "facebook" }
  const it = await scanAt(pool([note("2026-10-27T01:50:00Z", "[FB] 30 adults, Palmdale, Sun 11/22 3 PM - quoted $1,742")], fb), "2026-10-27T17:00:00Z")
  assert.equal(it.bucket, "H")
  assert.equal(it.reason, "Facebook 对话，我们最后说话：在 Facebook 里等他回（巡查盯着，跟进人工定）")
})

test("scan channels · a site lead that left nothing is still unreachable", async () => {
  const it = await scanAt(pool([note("2026-10-27T01:50:00Z", "tapped Text us")], { lead_source: "city_palm_springs", lead_channel: "website_text_us" }), "2026-10-27T17:00:00Z")
  assert.equal(it.bucket, "H")
  assert.equal(it.reason, "没留电话也没留邮箱，联系不上（点了发短信但没发出来）")
})

// Messages copied in with `desk channel` (lib/channel-messages.ts): who spoke last in the channel.
const chIn = (at: string, body: string): Tp => ({ at, type: "channel_inbound", payload: { channel: "facebook", body } })
const chOut = (at: string, body: string): Tp => ({ at, type: "channel_outbound", payload: { channel: "facebook", body } })
const FB = { full_name: "Martir Pamela (Facebook)", lead_source: "manual_facebook", lead_channel: "facebook" }

test("scan channels · the customer's Messenger message copied in is owed an answer; ours after it ends that", async () => {
  const asked = [chIn("2026-10-14T03:31:00Z", "I have 30 adult guest, Palmdale ca. November 22, Sunday @ 3PM")]
  const open = await scanAt(pool(asked, FB), "2026-10-14T04:00:00Z")
  assert.equal(open.bucket, "A")
  assert.equal(open.reason, "客人在 Facebook 发了消息，去 Facebook 回，回完 desk ack")

  const answered = [...asked, chOut("2026-10-21T19:20:00Z", "Hi Martir! Sunday, Nov 22 at 3 PM works for your 30 in Palmdale: it's $1,742 total with travel.")]
  const after = await scanAt(pool(answered, FB), "2026-10-27T17:00:00Z")
  assert.equal(after.bucket, "H")
  assert.equal(after.reason, "Facebook 对话，我们最后说话：在 Facebook 里等他回（巡查盯着，跟进人工定）")
})

test("scan channels · an Instagram lead who moved to texts: the texts decide", async () => {
  const ig = { full_name: "Tiffany", lead_source: "manual_instagram", lead_channel: "instagram", phone: "+19495550134" }
  const thread = [
    { at: "2026-10-26T17:01:00Z", type: "channel_inbound", payload: { channel: "instagram", body: "Hey there do u have availability this week for a family dinner party" } },
    { at: "2026-10-26T19:02:00Z", type: "sms_outbound", payload: { body: "Hi Tiffany! It's Rowling from Real Hibachi - here's our pricing." } },
    { at: "2026-10-26T19:03:00Z", type: "channel_outbound", payload: { channel: "instagram", body: "Just texted you our pricing from (213) 770-7788" } },
    { at: "2026-10-26T19:30:00Z", type: "sms_inbound", payload: { Body: "Saturday works, how much for 12?", NumMedia: "0" } },
  ]
  const it = await scanAt(pool(thread, ig), "2026-10-26T19:40:00Z")
  assert.equal(it.bucket, "A")
  assert.equal(it.reason, "客人最后说话，欠回复")
})
