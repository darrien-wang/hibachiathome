// A held lead's email in the inbox (lib/inbox.ts, 2026-11-13). Holding a lead
// means the ball is in the customer's court: mail from before the hold stays
// quiet. Mail that comes after it is the customer back, and is listed at once -
// the same watermark the texts use (lib/lead-hold.ts). Penny's question about
// tables came 11 minutes after her lead was held for 60 days and sat silent
// until the 15-minute audit, because the mail check read only hold_until.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { computeInbox, type InboxEvent } from "../lib/inbox"
import { fakeSupabase, type Row } from "./fixtures/fake-supabase"

const OURS = "+12137707788"
const LEAD = "00000000-0000-4000-8000-0000000000c1"
// Not a 555 number (the inbox drops those as test traffic); exchange 000 is never assigned.
const PHONE = "+18470000142"
// Noon Pacific on Wed Nov 13 2030.
const NOW = Date.parse("2030-11-13T20:00:00Z")
const MIN = 60_000
const iso = (ms: number) => new Date(ms).toISOString()

function lead(opts: { phone: boolean; holdSetAt: number | null }): Row {
  return {
    id: LEAD,
    full_name: "Penny Test",
    phone: opts.phone ? PHONE : null,
    normalized_phone: opts.phone ? PHONE.slice(-10) : null,
    email: "penny@example.com",
    status: "qualified",
    acked_until: null,
    hold_until: opts.holdSetAt == null ? null : iso(NOW + 59 * 24 * 60 * MIN),
    hold_set_at: opts.holdSetAt == null ? null : iso(opts.holdSetAt),
    created_at: iso(NOW - 3 * 60 * MIN),
  }
}

const mail = (type: "email_inbound" | "email_outbound", at: number, subject: string): Row => ({
  id: `tp-${type}-${at}`,
  lead_id: LEAD,
  touchpoint_type: type,
  occurred_at: iso(at),
  created_at: iso(at),
  raw_payload_json: { subject, snippet: subject },
})

async function inbox(tables: Record<string, Row[]>) {
  const db = fakeSupabase(tables)
  const saved = { fetch: globalThis.fetch, sid: process.env.TWILIO_ACCOUNT_SID, token: process.env.TWILIO_AUTH_TOKEN, caller: process.env.TWILIO_CALLER_ID }
  process.env.TWILIO_ACCOUNT_SID = "ACtest"
  process.env.TWILIO_AUTH_TOKEN = "test"
  process.env.TWILIO_CALLER_ID = OURS
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input)
    if (!url.startsWith("https://api.twilio.com/")) throw new Error(`inbox test: unexpected request ${url}`)
    return new Response(JSON.stringify({ messages: [] }), { headers: { "content-type": "application/json" } })
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

const mailFor = (events: InboxEvent[]) => events.filter((e) => e.kind === "email" && e.leadId === LEAD)

// We answered at -40 minutes; the customer writes at -15 or -20.
for (const phone of [true, false]) {
  const who = phone ? "a lead with a phone" : "an email-only lead"

  test(`${who}: mail written after the hold was set is listed - the customer is back`, async () => {
    const { events } = await inbox({
      leads: [lead({ phone, holdSetAt: NOW - 30 * MIN })],
      lead_touchpoints: [mail("email_outbound", NOW - 40 * MIN, "Re: Your hibachi quote"), mail("email_inbound", NOW - 15 * MIN, "Re: Your hibachi quote")],
    })
    assert.equal(mailFor(events).length, 1, JSON.stringify(events.map((e) => [e.kind, e.title])))
  })

  test(`${who}: mail from before the hold stays quiet while the hold lasts`, async () => {
    const { events } = await inbox({
      leads: [lead({ phone, holdSetAt: NOW - 10 * MIN })],
      lead_touchpoints: [mail("email_outbound", NOW - 40 * MIN, "Re: Your hibachi quote"), mail("email_inbound", NOW - 20 * MIN, "Re: Your hibachi quote")],
    })
    assert.equal(mailFor(events).length, 0, JSON.stringify(events.map((e) => [e.kind, e.title])))
  })
}

test("no hold at all: the mail is listed", async () => {
  const { events } = await inbox({
    leads: [lead({ phone: true, holdSetAt: null })],
    lead_touchpoints: [mail("email_outbound", NOW - 40 * MIN, "Re: Your hibachi quote"), mail("email_inbound", NOW - 15 * MIN, "Re: Your hibachi quote")],
  })
  assert.equal(mailFor(events).length, 1)
})
