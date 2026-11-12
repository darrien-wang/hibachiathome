// Layer-2 self-test: the Meta Conversions API sweep reads the browser of every
// click, and a read the database refuses is not an empty answer
// (app/api/integrations/meta-capi/route.ts, lib/in-chunks.ts).
//
// The sweep asked for all its click ids in one `in` filter of up to 200. A
// click id is about 192 characters. With 128 of them in the 60-day list the
// URL was 25,004 characters and was answered; on 2026-10-26 20:26 UTC the
// 129th made it 25,202 and the database API answered 400 "Bad Request" (plain
// text, in a few milliseconds: turned away before the query was read), and
// has on every sweep since. The route dropped the error and took it for "no
// browser on file". Until 2026-11-12 about 1,600 sweeps were refused and 35
// events (21 Contact, 7 Purchase, 7 Schedule) went to Meta as
// system_generated, with no user agent, IP or _fbp, although every one of
// those clicks had them stored. They are on file as sent, so they were never
// sent again.
//
// And nobody was told for those 17 days: pg_cron does not read what the sweep
// answers. So a cron sweep that answers anything but ok:true is counted in
// workbench_settings (meta_capi.health), the 4th in a row mails ops, and so
// does the first sweep that works again (lib/meta-capi-health.ts; the lines
// and the mails themselves are in tests/meta-capi-health.test.ts). The second
// half of this file runs the route for that: what counts, what does not (a
// dry run, a run by hand), and what goes on file when Meta refuses a batch or
// the file cannot be written.
//
// Real supabase-js (2.89.0, the version in production) against an in-process
// API that refuses a long URL the way production does. fetch is replaced for
// the whole file: nothing here can reach Supabase, Meta or the mail provider.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { createClient } from "@supabase/supabase-js"
import { CRON_PURPOSE_META_CAPI, cronKeyFor } from "../lib/cron-key"
import { IN_LIST_MAX_CHARS, inChunks, inListCost } from "../lib/in-chunks"
import { META_CAPI_HEALTH_KEY } from "../lib/meta-capi-health"
import type { SweepHealth } from "../lib/sweep-health"

type Row = Record<string, unknown>

// Same length as production's host, so URL lengths here read like the API logs.
const API = "https://stub0stub0stub0stub0.supabase.co"
// Production, 2026-10-26: 25,004 characters was the last URL answered, 25,202 the first refused.
const API_URL_LIMIT = 25_100
const CRON_BASE = "test-cron-base"
const OWNER_KEY = "test-owner-key"
const OPS = "ops@realhibachi.test"

process.env.SUPABASE_URL = API
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role"
process.env.LEAD_WATCH_CRON_KEY = CRON_BASE
process.env.ADMIN_DASH_KEY = OWNER_KEY
process.env.META_CAPI_TOKEN = "test-capi-token"
process.env.NEXT_PUBLIC_META_PIXEL_ID = "1234567890"
// Ops mail goes to the stand-in below: a key so that it is sent at all, and
// none of the switches that would keep it in the log or send it another way.
process.env.RESEND_API_KEY = "test-mail-key"
process.env.EMAIL_TO = OPS
process.env.EMAIL_FROM = "Real Hibachi <notify@realhibachi.test>"
process.env.ALLOW_DEV_EMAIL_SEND = "true"
for (const name of ["CLOUDFLARE_EMAIL_ACCOUNT_ID", "CLOUDFLARE_EMAIL_API_TOKEN", "SUPPRESS_EXTERNAL_NOTIFICATIONS", "VERCEL_ENV", "VERCEL_GIT_COMMIT_REF"]) delete process.env[name]

type World = {
  tables: Record<string, Row[]>
  /** Tables whose reads the API turns away, whatever their length. */
  down: Set<string>
  /** Tables the database lets nobody write. */
  noWrite: Set<string>
  /** What Meta does with a batch: takes it, refuses it (an expired token), or never answers. */
  meta: "takes" | "refuses" | "silent"
  /** Every read: the table, the URL's length, the values of its `in` filter. */
  reads: Array<{ table: string; length: number; values: string[] }>
  refused: string[]
  /** Events Meta took. */
  toMeta: Row[]
  /** Mails the mail provider took. */
  mails: Array<{ to: string[]; subject: string; text: string }>
  /** The mail provider turns every mail away. */
  mailDown: boolean
  /** What the function log would show: every console.error during a sweep. */
  log: string[]
}

let world: World | null = null

/** The filters the sweep uses, the way PostgREST reads them from the query string. */
function matches(row: Row, column: string, filter: string): boolean {
  const v = row[column]
  if (filter === "is.null") return v == null
  if (filter === "not.is.null") return v != null
  if (filter.startsWith("eq.")) return String(v) === filter.slice(3)
  if (filter.startsWith("gte.")) return Date.parse(String(v)) >= Date.parse(filter.slice(4))
  if (filter.startsWith("in.(")) return filter.slice(4, -1).split(",").includes(String(v))
  throw new Error(`a filter this stub does not know: ${column}=${filter}`)
}

const badRequest = () => new Response("Bad Request", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } })
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } })
/** An error PostgREST explains: JSON with the database's code. */
const dbError = (status: number, code: string, message: string) => json({ code, details: null, hint: null, message }, status)

/** What Meta answers once the token has run out. */
const EXPIRED = { message: "Error validating access token: Session has expired on Thursday, 12-Nov-26 10:00:00 PST.", type: "OAuthException", code: 190, error_subcode: 463, fbtrace_id: "test" }
const EXPIRED_LINE = "Meta HTTP 400: Error validating access token: Session has expired on Thursday, 12-Nov-26 10:00:00 PST. (code 190/463)"

/** meta_capi_events in production: one row per real event (meta_capi_events_real_uniq, test runs excepted). */
const eventKey = (r: Row) => (r.test_event_code == null ? `${r.event_name}|${r.event_id}` : null)

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const href = input instanceof Request ? input.url : String(input)
  const method = (init?.method ?? "GET").toUpperCase()
  const w = world
  if (!w) throw new Error(`fetch outside a sweep: ${href.slice(0, 80)}`)
  if (href.startsWith("https://graph.facebook.com/")) {
    if (w.meta === "silent") throw new TypeError("fetch failed", { cause: Object.assign(new Error("connect ETIMEDOUT 203.0.113.9:443"), { code: "ETIMEDOUT" }) })
    if (w.meta === "refuses") return json({ error: EXPIRED }, 400)
    const sent = (JSON.parse(String(init?.body)) as { data: Row[] }).data
    w.toMeta.push(...sent)
    return json({ events_received: sent.length, messages: [], fbtrace_id: "test" })
  }
  if (href === "https://api.resend.com/emails") {
    if (w.mailDown) return json({ message: "API key is invalid" }, 403)
    const mail = JSON.parse(String(init?.body)) as { to: string[]; subject: string; text: string }
    w.mails.push({ to: mail.to, subject: mail.subject, text: mail.text })
    return json({ id: "test-mail" })
  }
  if (!href.startsWith(`${API}/rest/v1/`)) throw new Error(`unexpected fetch ${href.slice(0, 80)}`)
  const url = new URL(href)
  const table = url.pathname.slice("/rest/v1/".length)
  if (method === "POST") {
    if (w.noWrite.has(table)) return dbError(403, "42501", `permission denied for table ${table}`)
    const body = JSON.parse(String(init?.body)) as Row | Row[]
    const rows = Array.isArray(body) ? body : [body]
    // An upsert replaces the row with the same key; an insert only adds.
    const key = url.searchParams.get("on_conflict")
    const kept = (w.tables[table] ?? []).filter((old) => !key || !rows.some((r) => r[key] === old[key]))
    if (table === "meta_capi_events") {
      const onFile = new Set(kept.map(eventKey))
      if (rows.some((r) => eventKey(r) && onFile.has(eventKey(r)))) return dbError(409, "23505", 'duplicate key value violates unique constraint "meta_capi_events_real_uniq"')
    }
    w.tables[table] = [...kept, ...rows]
    return new Response(null, { status: 201 })
  }
  if (method !== "GET") throw new Error(`unexpected ${method} ${table}`)
  const list = [...url.searchParams.values()].find((f) => f.startsWith("in.("))
  w.reads.push({ table, length: href.length, values: list ? list.slice(4, -1).split(",") : [] })
  if (href.length > API_URL_LIMIT || w.down.has(table)) {
    w.refused.push(`${table}: a URL of ${href.length} characters`)
    return badRequest()
  }
  let rows = [...(w.tables[table] ?? [])]
  for (const [column, filter] of url.searchParams) {
    if (column === "select" || column === "limit") continue
    if (column === "order") rows.sort((a, b) => String(a[filter.split(".")[0]]).localeCompare(String(b[filter.split(".")[0]])))
    else rows = rows.filter((r) => matches(r, column, filter))
  }
  return json(rows.slice(0, Number(url.searchParams.get("limit") ?? rows.length)))
}) as typeof fetch

const NOW = Date.now()
const ago = (days: number) => new Date(NOW - days * 86400_000).toISOString()
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
/** As long as Meta's: 159 to 201 characters in the leads table, 192 on average. */
const clickId = (n: number) => `IwTESTclick${String(n).padStart(4, "0")}`.padEnd(192, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-")
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 400.0"
const IP = "203.0.113.7"
const FBP = "fb.1.1760000000000.1234567890"
const REPLIED = uuid(1)
const BOOKED = uuid(2)
const ORDER = uuid(9001)
const BOOKING = uuid(8001)

type WorldOptions = {
  down?: string[]
  noWrite?: string[]
  meta?: World["meta"]
  sent?: Row[]
  mailDown?: boolean
  /** The health record already in workbench_settings. */
  health?: SweepHealth
  /** This many leads, all two days old, wrote back yesterday: more events than one batch of 50 carries. */
  replies?: number
}

/**
 * The 60-day list as it stood on 2026-11-12: 174 Meta leads, the browser of
 * every click on file. One wrote back two days ago, one locked a date yesterday.
 */
function makeWorld(over: WorldOptions = {}): World {
  const leads = Array.from({ length: 174 }, (_, i) => ({
    id: uuid(i + 1),
    created_at: ago(over.replies ? 2 : 3 + (i % 50)),
    first_seen_at: ago(over.replies ? 2 : 3 + (i % 50)),
    email: `lead${i + 1}@example.com`,
    phone: `626555${1000 + i}`,
    fbclid: clickId(i + 1),
    utm_source: "facebook",
    status: "new",
    normalized_phone: null,
    merged_into: null,
  }))
  return {
    tables: {
      leads,
      meta_click_context: leads.map((l) => ({ fbclid: l.fbclid, fbp: FBP, user_agent: UA, ip: IP })),
      lead_touchpoints: over.replies
        ? leads.slice(0, over.replies).map((l) => ({ lead_id: l.id, touchpoint_type: "sms_inbound", occurred_at: ago(1), raw_payload_json: { Body: "Yes, Saturday works" } }))
        : [{ lead_id: REPLIED, touchpoint_type: "sms_inbound", occurred_at: ago(2), raw_payload_json: { Body: "Is Nov 21 open for 14 people?" } }],
      orders: [{ id: ORDER, created_at: ago(1), quoted_total_cents: 98_000, customer_email: "lead2@example.com", customer_phone: "6265551001", source_ref: BOOKING, source_metadata: { lead_id: BOOKED }, deposit_status: "paid_verified" }],
      bookings: [{ id: BOOKING, payment_intent_id: "pi_test_123", stripe_session_id: null }],
      meta_capi_events: over.sent ?? [],
      workbench_settings: over.health ? [{ key: META_CAPI_HEALTH_KEY, value: over.health, updated_at: over.health.last_attempt_at, updated_by: "meta-capi cron" }] : [],
    },
    down: new Set(over.down ?? []),
    noWrite: new Set(over.noWrite ?? []),
    meta: over.meta ?? "takes",
    reads: [],
    refused: [],
    toMeta: [],
    mails: [],
    mailDown: over.mailDown ?? false,
    log: [],
  }
}

type Answer = { ok: boolean; dry?: boolean; sent?: number; withBrowserContext?: number; error?: string; errors?: unknown[]; events?: unknown[] }

/**
 * One call of the route. As pg_cron makes it unless told otherwise: `hand` is
 * the owner's key without ?consumer=cron, `dry` adds ?dry=1, `testCode` adds
 * ?test_event_code=.
 */
async function sweep(w: World, how: { hand?: boolean; dry?: boolean; testCode?: string } = {}): Promise<{ status: number; body: Answer }> {
  const { NextRequest } = await import("next/server")
  const { POST } = await import("../app/api/integrations/meta-capi/route")
  const query = [how.hand ? "" : "consumer=cron", how.dry ? "dry=1" : "", how.testCode ? `test_event_code=${how.testCode}` : ""].filter(Boolean).join("&")
  const print = console.error
  console.error = (...args: unknown[]) => void w.log.push(args.map(String).join(" "))
  world = w
  try {
    const res = await POST(
      new NextRequest(`http://localhost/api/integrations/meta-capi?${query}`, {
        method: "POST",
        headers: { "x-admin-key": how.hand ? OWNER_KEY : (cronKeyFor(CRON_PURPOSE_META_CAPI, CRON_BASE) as string) },
      }),
    )
    return { status: res.status, body: (await res.json()) as Answer }
  } finally {
    world = null
    console.error = print
  }
}

/** The sweep's health record as stored, if it is there. */
const health = (w: World) => w.tables.workbench_settings.find((r) => r.key === META_CAPI_HEALTH_KEY)?.value as SweepHealth | undefined

const names = (events: Row[]) => events.map((e) => `${e.event_name} ${e.event_id}`).sort()
const THREE = [`Contact reply-${REPLIED}`, "Purchase pi_test_123", `Schedule lock-${ORDER}`]

test("meta-capi sweep · 174 Meta leads: no read is refused, and every event carries the browser of its click", async () => {
  const w = makeWorld()
  const { status, body } = await sweep(w)
  assert.deepEqual(w.refused, [], "the database API turned a read away")
  assert.equal(status, 200, JSON.stringify(body))
  assert.deepEqual({ ok: body.ok, sent: body.sent, withBrowserContext: body.withBrowserContext }, { ok: true, sent: 3, withBrowserContext: 3 })
  assert.deepEqual(names(w.toMeta), THREE)
  for (const e of w.toMeta) {
    const u = e.user_data as Row
    assert.equal(e.action_source, "website", `${e.event_name} went out as ${e.action_source}`)
    assert.equal(e.event_source_url, "https://www.realhibachi.com/")
    assert.equal(u.client_user_agent, UA)
    assert.equal(u.client_ip_address, IP)
    assert.equal(u.fbp, FBP)
    assert.match(String(u.fbc), /^fb\.1\.\d+\.IwTESTclick/)
  }

  // The lookup: every click id asked for exactly once, in URLs a quarter of what the API accepts.
  const lookups = w.reads.filter((r) => r.table === "meta_click_context")
  assert.deepEqual(lookups.flatMap((r) => r.values).sort(), w.tables.leads.map((l) => String(l.fbclid)).sort())
  assert.ok(lookups.length > 1, "one request cannot carry 174 click ids")
  const longest = Math.max(...w.reads.map((r) => r.length))
  assert.ok(longest < API_URL_LIMIT / 3, `the longest URL was ${longest} characters`)

  // On file as sent, so the next sweep sends nothing.
  assert.deepEqual(names(w.tables.meta_capi_events.filter((r) => r.ok === true)), THREE)
  const again = await sweep(w)
  assert.deepEqual({ ok: again.body.ok, sent: again.body.sent }, { ok: true, sent: 0 })
  assert.equal(w.toMeta.length, 3)
})

test("meta-capi sweep · what is on file as sent is not sent twice", async () => {
  const w = makeWorld({ sent: [{ event_name: "Contact", event_id: `reply-${REPLIED}`, ok: true, test_event_code: null }] })
  const { body } = await sweep(w)
  assert.deepEqual({ ok: body.ok, sent: body.sent }, { ok: true, sent: 2 })
  assert.deepEqual(names(w.toMeta), THREE.slice(1))
})

// A read that fails must not look like "nothing found". Without the click's
// browser the event goes out system_generated; without the booking's payment
// id Purchase gets an id the pixel's own Purchase does not share; without the
// sent list everything in the 7-day window goes out again. Each of those is
// then on file as sent. The next sweep, 15 minutes later, finds the same
// events: Meta takes them for 7 days.
for (const table of ["leads", "meta_click_context", "lead_touchpoints", "orders", "bookings", "meta_capi_events"]) {
  test(`meta-capi sweep · a refused read of ${table} stops the sweep: nothing sent, nothing put on file, the answer says which read`, async () => {
    const w = makeWorld({ down: [table] })
    const { status, body } = await sweep(w)
    assert.deepEqual(names(w.toMeta), [], "events went to Meta after a failed read")
    assert.equal(status, 500, JSON.stringify(body))
    assert.equal(body.ok, false)
    assert.match(String(body.error), new RegExp(`^${table}: Bad Request`))
    assert.deepEqual(w.tables.meta_capi_events, [])
  })
}

// ---- Who is told when it keeps failing ---------------------------------------------
// pg_cron does not read any of the answers above. So each cron sweep leaves
// its outcome in workbench_settings, and ops is mailed at the fourth failure
// in a row (an hour of sweeps), every 12 hours after that, and once when a
// sweep works again.

test("meta-capi sweep · a cron sweep that works starts the record: the first one makes the row, and nobody is mailed", async () => {
  const w = makeWorld()
  assert.equal(health(w), undefined)
  await sweep(w)
  await sweep(w)
  assert.equal(w.tables.workbench_settings.length, 1, "one row, written over by every sweep")
  assert.equal(w.tables.workbench_settings[0].updated_by, "meta-capi cron")
  const h = health(w) as SweepHealth
  assert.deepEqual({ fail_streak: h.fail_streak, last_error: h.last_error, alerted_at: h.alerted_at }, { fail_streak: 0, last_error: null, alerted_at: null })
  assert.equal(h.last_ok_at, h.last_attempt_at)
  assert.ok(Date.parse(String(h.last_ok_at)) >= NOW)
  assert.deepEqual(w.mails, [])
  assert.deepEqual(w.log, [], "a sweep that works has nothing for the function log")
})

test("meta-capi sweep · a read refused on every cron sweep: each one counted, one mail at the fourth, one more when it works again", async () => {
  const w = makeWorld({ down: ["meta_click_context"] })
  for (let n = 1; n <= 3; n++) {
    await sweep(w)
    assert.equal(health(w)?.fail_streak, n)
  }
  assert.equal(w.mails.length, 0, "three failed sweeps are not yet news")
  await sweep(w)
  assert.equal(w.mails.length, 1)
  assert.deepEqual(w.mails[0].to, [OPS])
  assert.equal(w.mails[0].subject, "⚠️ Meta 回传（回话 / 锁单）出错 · 连续失败 4 次")
  assert.match(w.mails[0].text, /最后一次错误：meta_click_context: Bad Request/)
  assert.match(w.mails[0].text, /\/rest\/v1\/meta_click_context/)
  await sweep(w)
  assert.equal(w.mails.length, 1, "the next reminder is 12 hours away")
  const failing = health(w) as SweepHealth
  assert.deepEqual(
    { fail_streak: failing.fail_streak, last_error: failing.last_error, last_ok_at: failing.last_ok_at },
    { fail_streak: 5, last_error: "meta_click_context: Bad Request", last_ok_at: null },
  )
  assert.ok(failing.alerted_at)
  assert.deepEqual(names(w.toMeta), [], "events went to Meta while the read was refused")
  // The record keeps the last error only; the function log has every failed sweep.
  assert.deepEqual(w.log, Array(5).fill("[meta-capi] sweep failed: meta_click_context: Bad Request"))

  // The database answers again: the three events of the outage go out, and ops hears that too.
  w.down.clear()
  const back = await sweep(w)
  assert.deepEqual({ ok: back.body.ok, sent: back.body.sent }, { ok: true, sent: 3 })
  assert.equal(w.mails.length, 2)
  assert.equal(w.mails[1].subject, "✅ Meta 回传（回话 / 锁单）恢复了")
  assert.match(w.mails[1].text, /之前连续失败 5 次/)
  assert.match(w.mails[1].text, /这一轮发出 3 条事件/)
  assert.deepEqual({ fail_streak: health(w)?.fail_streak, last_error: health(w)?.last_error }, { fail_streak: 0, last_error: null })
  await sweep(w)
  assert.equal(w.mails.length, 2)
})

test("meta-capi sweep · a dry run, a run by hand and a test-event run are not the schedule: not counted, not mailed, and they clear nothing", async () => {
  const stored: SweepHealth = { fail_streak: 3, last_attempt_at: ago(0.01), last_ok_at: ago(0.04), last_error: "leads: Bad Request", alerted_at: null }
  const w = makeWorld({ down: ["leads"], health: stored })
  const before = JSON.stringify(w.tables.workbench_settings)
  // Each of these fails. From the schedule it would be the fourth in a row, and a mail.
  for (const how of [{ dry: true }, { hand: true }, { hand: true, dry: true }, { testCode: "TEST123" }]) {
    const { status, body } = await sweep(w, how)
    assert.deepEqual({ status, error: body.error }, { status: 500, error: "leads: Bad Request" }, JSON.stringify(how))
  }
  // Each of these works. From the schedule it would end the streak.
  w.down.clear()
  const dry = await sweep(w, { dry: true })
  assert.deepEqual({ ok: dry.body.ok, dry: dry.body.dry, due: dry.body.events?.length }, { ok: true, dry: true, due: 3 })
  assert.deepEqual(names(w.toMeta), [], "a dry run sent events")
  const hand = await sweep(w, { hand: true })
  assert.deepEqual({ ok: hand.body.ok, sent: hand.body.sent }, { ok: true, sent: 3 })

  assert.equal(JSON.stringify(w.tables.workbench_settings), before)
  assert.deepEqual(w.reads.filter((r) => r.table === "workbench_settings"), [], "the record was read")
  assert.deepEqual(w.mails, [])
  // The schedule's own next sweep is the one that counts.
  await sweep(w)
  assert.equal(health(w)?.fail_streak, 0)
})

test("meta-capi sweep · a batch Meta refuses: the sweep fails in Meta's words, nothing goes on file, and once Meta takes it the batch is on file and stays sent", async () => {
  const w = makeWorld({ meta: "refuses" })
  const refused = await sweep(w)
  assert.equal(refused.status, 200)
  assert.deepEqual({ ok: refused.body.ok, sent: refused.body.sent, error: refused.body.error }, { ok: false, sent: 0, error: EXPIRED_LINE })
  assert.deepEqual(refused.body.errors, [{ error: EXPIRED }])
  // One row per real event: a row for the refusal would keep the success below off the file.
  assert.deepEqual(w.tables.meta_capi_events, [])
  assert.deepEqual({ fail_streak: health(w)?.fail_streak, last_error: health(w)?.last_error }, { fail_streak: 1, last_error: EXPIRED_LINE })

  w.meta = "takes"
  const taken = await sweep(w)
  assert.deepEqual({ ok: taken.body.ok, sent: taken.body.sent, error: taken.body.error }, { ok: true, sent: 3, error: undefined })
  assert.deepEqual(names(w.tables.meta_capi_events), THREE)
  assert.equal(health(w)?.fail_streak, 0)
  const after = await sweep(w)
  assert.deepEqual({ ok: after.body.ok, sent: after.body.sent }, { ok: true, sent: 0 })
  assert.equal(w.toMeta.length, 3, "the batch went to Meta a second time")
})

test("meta-capi sweep · Meta does not answer: a failed sweep, not a crash, and nothing on file", async () => {
  const w = makeWorld({ meta: "silent" })
  const { status, body } = await sweep(w)
  const line = "Meta: no answer (fetch failed: ETIMEDOUT)"
  assert.equal(status, 200)
  assert.deepEqual({ ok: body.ok, sent: body.sent, error: body.error }, { ok: false, sent: 0, error: line })
  assert.deepEqual(w.tables.meta_capi_events, [])
  assert.deepEqual({ fail_streak: health(w)?.fail_streak, last_error: health(w)?.last_error }, { fail_streak: 1, last_error: line })
})

test("meta-capi sweep · sent, and the file cannot be written: the sweep fails and says the batch goes out again", async () => {
  const w = makeWorld({ noWrite: ["meta_capi_events"] })
  const { status, body } = await sweep(w)
  const line = "meta_capi_events insert: permission denied for table meta_capi_events (3 sent to Meta and not on file: the next sweep sends them again)"
  assert.equal(status, 200)
  assert.deepEqual({ ok: body.ok, sent: body.sent, error: body.error }, { ok: false, sent: 3, error: line })
  assert.equal(w.toMeta.length, 3)
  assert.deepEqual({ fail_streak: health(w)?.fail_streak, last_error: health(w)?.last_error }, { fail_streak: 1, last_error: line })
  // And it does go out again: that is why this is a failed sweep and not a detail.
  await sweep(w)
  assert.equal(w.toMeta.length, 6)
  assert.equal(health(w)?.fail_streak, 2)
})

test("meta-capi sweep · more events than one batch: nothing more is sent after a batch that cannot be put on file, while a refused batch does not hold up the next", async () => {
  const unwritable = makeWorld({ replies: 60, noWrite: ["meta_capi_events"] })
  const stopped = await sweep(unwritable)
  assert.deepEqual({ ok: stopped.body.ok, sent: stopped.body.sent }, { ok: false, sent: 50 })
  assert.match(String(stopped.body.error), /^meta_capi_events insert: .* \(50 sent to Meta and not on file/)
  assert.equal(unwritable.toMeta.length, 50, "the second batch (12 events) was sent with nowhere to put it")

  const expired = makeWorld({ replies: 60, meta: "refuses" })
  const refused = await sweep(expired)
  assert.equal(refused.body.errors?.length, 2, "both batches were offered to Meta")
  assert.equal(refused.body.error, EXPIRED_LINE, "the same refusal is said once")

  const fine = makeWorld({ replies: 60 })
  const all = await sweep(fine)
  assert.deepEqual({ ok: all.body.ok, sent: all.body.sent, onFile: fine.tables.meta_capi_events.length }, { ok: true, sent: 62, onFile: 62 })
})

test("meta-capi sweep · no token: a failed sweep like any other, and a dry run does not need one", async () => {
  const w = makeWorld()
  const token = process.env.META_CAPI_TOKEN
  delete process.env.META_CAPI_TOKEN
  try {
    const { status, body } = await sweep(w)
    assert.equal(status, 200)
    assert.deepEqual(body, { ok: false, error: "META_CAPI_TOKEN not set" })
    assert.deepEqual({ fail_streak: health(w)?.fail_streak, last_error: health(w)?.last_error }, { fail_streak: 1, last_error: "META_CAPI_TOKEN not set" })
    assert.equal((await sweep(w, { dry: true })).body.ok, true)
    assert.deepEqual(names(w.toMeta), [])
  } finally {
    process.env.META_CAPI_TOKEN = token
  }
})

test("meta-capi sweep · the bookkeeping never changes the answer: a record that cannot be read is left alone, one that cannot be saved still mails", async () => {
  const stored: SweepHealth = { fail_streak: 3, last_attempt_at: ago(0.01), last_ok_at: ago(0.04), last_error: "leads: Bad Request", alerted_at: null }

  const FAILED = "[meta-capi] sweep failed: leads: Bad Request"

  // Not read. This failure is the fourth; "1" written over the 3 would put the mail off by an hour.
  const unread = makeWorld({ down: ["leads", "workbench_settings"], health: stored })
  const a = await sweep(unread)
  assert.deepEqual({ status: a.status, error: a.body.error }, { status: 500, error: "leads: Bad Request" })
  assert.deepEqual(health(unread), stored)
  assert.deepEqual(unread.mails, [])
  assert.deepEqual(unread.log, [FAILED, "[meta-capi] health record not read, sweep not counted Bad Request"])

  // Read but not saved: the fourth failure is still the fourth, and ops is told.
  const unsaved = makeWorld({ down: ["leads"], noWrite: ["workbench_settings"], health: stored })
  const b = await sweep(unsaved)
  assert.deepEqual({ status: b.status, error: b.body.error }, { status: 500, error: "leads: Bad Request" })
  assert.deepEqual(health(unsaved), stored)
  assert.equal(unsaved.mails.length, 1)
  assert.deepEqual(unsaved.log, [FAILED, "[meta-capi] health record not saved permission denied for table workbench_settings"])

  // The mail provider turns the mail away: counted all the same, and the function log says the mail did not go.
  const unmailed = makeWorld({ down: ["leads"], health: stored, mailDown: true })
  const c = await sweep(unmailed)
  assert.deepEqual({ status: c.status, error: c.body.error }, { status: 500, error: "leads: Bad Request" })
  assert.equal(health(unmailed)?.fail_streak, 4)
  assert.deepEqual(unmailed.log, [FAILED, "[meta-capi] health mail not sent ⚠️ Meta 回传（回话 / 锁单）出错 · 连续失败 4 次 resend_http_403: API key is invalid"])

  // And a sweep that works answers the same with the record out of reach.
  const fine = makeWorld({ down: ["workbench_settings"] })
  const d = await sweep(fine)
  assert.deepEqual({ status: d.status, ok: d.body.ok, sent: d.body.sent }, { status: 200, ok: true, sent: 3 })
})

test("meta-capi sweep · no database configured: the sweep says so, and there is nowhere to count it", async () => {
  const w = makeWorld()
  const url = process.env.SUPABASE_URL
  delete process.env.SUPABASE_URL
  try {
    const { status, body } = await sweep(w)
    assert.equal(status, 500)
    assert.deepEqual(body, { ok: false, error: "supabase not configured" })
    assert.deepEqual([w.reads, w.mails, w.toMeta], [[], [], []])
    assert.ok(w.log.includes("[meta-capi] sweep failed: supabase not configured"), w.log.join(" / "))
  } finally {
    process.env.SUPABASE_URL = url
  }
})

// ---- lib/in-chunks.ts ------------------------------------------------------------

/** What supabase-js itself puts in the URL for one `in` list: the characters between the brackets. */
const builder = createClient(API, "test-service-role", { auth: { persistSession: false, autoRefreshToken: false } })
const urlList = (values: Array<string | number>) => {
  const query = builder.from("t").select("c").in("c", values) as unknown as { url: URL }
  return query.url.search.length - "?select=c&c=in.%28%29".length
}

test("in-chunks · a long list is cut by its length in the URL: nothing lost, nothing twice, order kept", () => {
  const ids = Array.from({ length: 174 }, (_, i) => clickId(i + 1))
  const parts = inChunks(ids)
  assert.deepEqual(parts.flat(), ids)
  assert.equal(parts.length, 6, "174 click ids of 192 characters: 30 to a request")
  for (const p of parts) assert.ok(urlList(p) <= IN_LIST_MAX_CHARS, `${urlList(p)} characters`)
  // Short values still travel together: 153 uuids to a request, 200 in two.
  const uuids = Array.from({ length: 200 }, (_, i) => uuid(i + 1))
  assert.deepEqual(inChunks(uuids).map((p) => p.length), [153, 47])
  assert.deepEqual(inChunks([1, 2, 3]), [[1, 2, 3]])
})

test("in-chunks · the cost is what the URL carries: the comma is three characters, so is everything that gets escaped", () => {
  assert.equal(inListCost("abc"), 3 + 3)
  assert.equal(inListCost("a b"), 3 + 3, "a space travels as +")
  assert.equal(inListCost("a/b"), 5 + 3)
  assert.equal(inListCost("a,b"), 5 + 6 + 3, "supabase-js quotes a value with a comma or a bracket")
  assert.equal(inListCost("é"), 6 + 3)
  assert.equal(inListCost(12345), 5 + 3)
  for (const values of [["abc", "a/b"], ["a,b", "x(y)", "é"], [uuid(1), clickId(1), "pi_test_123"]]) {
    assert.equal(values.reduce((n, v) => n + inListCost(v), 0), urlList(values) + 3, values.join(" "))
  }
})

test("in-chunks · a value longer than the budget goes alone, and an empty list asks nothing", () => {
  const long = "x".repeat(IN_LIST_MAX_CHARS + 50)
  assert.deepEqual(inChunks(["a", long, "b", "c"]), [["a"], [long], ["b", "c"]])
  assert.deepEqual(inChunks([]), [])
  assert.deepEqual(inChunks(["a", "b", "c"], 12), [["a", "b", "c"]])
  assert.deepEqual(inChunks(["a", "b", "c"], 11), [["a", "b"], ["c"]])
})
