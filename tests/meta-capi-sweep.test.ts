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
// Real supabase-js (2.89.0, the version in production) against an in-process
// API that refuses a long URL the way production does. fetch is replaced for
// the whole file: nothing here can reach Supabase or Meta.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { createClient } from "@supabase/supabase-js"
import { CRON_PURPOSE_META_CAPI, cronKeyFor } from "../lib/cron-key"
import { IN_LIST_MAX_CHARS, inChunks, inListCost } from "../lib/in-chunks"

type Row = Record<string, unknown>

// Same length as production's host, so URL lengths here read like the API logs.
const API = "https://stub0stub0stub0stub0.supabase.co"
// Production, 2026-10-26: 25,004 characters was the last URL answered, 25,202 the first refused.
const API_URL_LIMIT = 25_100
const CRON_BASE = "test-cron-base"

process.env.SUPABASE_URL = API
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role"
process.env.LEAD_WATCH_CRON_KEY = CRON_BASE
process.env.META_CAPI_TOKEN = "test-capi-token"
process.env.NEXT_PUBLIC_META_PIXEL_ID = "1234567890"

type World = {
  tables: Record<string, Row[]>
  /** Tables whose reads the API turns away, whatever their length. */
  down: Set<string>
  /** Every read: the table, the URL's length, the values of its `in` filter. */
  reads: Array<{ table: string; length: number; values: string[] }>
  refused: string[]
  /** Events posted to Meta's endpoint. */
  toMeta: Row[]
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
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json; charset=utf-8" } })

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const href = input instanceof Request ? input.url : String(input)
  const method = (init?.method ?? "GET").toUpperCase()
  const w = world
  if (!w) throw new Error(`fetch outside a sweep: ${href.slice(0, 80)}`)
  if (href.startsWith("https://graph.facebook.com/")) {
    const sent = (JSON.parse(String(init?.body)) as { data: Row[] }).data
    w.toMeta.push(...sent)
    return json({ events_received: sent.length, messages: [], fbtrace_id: "test" })
  }
  if (!href.startsWith(`${API}/rest/v1/`)) throw new Error(`unexpected fetch ${href.slice(0, 80)}`)
  const url = new URL(href)
  const table = url.pathname.slice("/rest/v1/".length)
  if (method === "POST") {
    w.tables[table] = [...(w.tables[table] ?? []), ...(JSON.parse(String(init?.body)) as Row[])]
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

/**
 * The 60-day list as it stood on 2026-11-12: 174 Meta leads, the browser of
 * every click on file. One wrote back two days ago, one locked a date yesterday.
 */
function makeWorld(over: { down?: string[]; sent?: Row[] } = {}): World {
  const leads = Array.from({ length: 174 }, (_, i) => ({
    id: uuid(i + 1),
    created_at: ago(3 + (i % 50)),
    first_seen_at: ago(3 + (i % 50)),
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
      lead_touchpoints: [{ lead_id: REPLIED, touchpoint_type: "sms_inbound", occurred_at: ago(2), raw_payload_json: { Body: "Is Nov 21 open for 14 people?" } }],
      orders: [{ id: ORDER, created_at: ago(1), quoted_total_cents: 98_000, customer_email: "lead2@example.com", customer_phone: "6265551001", source_ref: BOOKING, source_metadata: { lead_id: BOOKED }, deposit_status: "paid_verified" }],
      bookings: [{ id: BOOKING, payment_intent_id: "pi_test_123", stripe_session_id: null }],
      meta_capi_events: over.sent ?? [],
    },
    down: new Set(over.down ?? []),
    reads: [],
    refused: [],
    toMeta: [],
  }
}

type Answer = { ok: boolean; sent?: number; withBrowserContext?: number; error?: string; errors?: unknown[] }

async function sweep(w: World): Promise<{ status: number; body: Answer }> {
  const { NextRequest } = await import("next/server")
  const { POST } = await import("../app/api/integrations/meta-capi/route")
  world = w
  try {
    const res = await POST(
      new NextRequest("http://localhost/api/integrations/meta-capi?consumer=cron", {
        method: "POST",
        headers: { "x-admin-key": cronKeyFor(CRON_PURPOSE_META_CAPI, CRON_BASE) as string },
      }),
    )
    return { status: res.status, body: (await res.json()) as Answer }
  } finally {
    world = null
  }
}

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
