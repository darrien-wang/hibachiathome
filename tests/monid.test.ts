// Layer-2 self-test: the Monid client (2026-10-21). A quick endpoint answers
// in one round trip, a slow one is polled, and every failure is a value the
// caller can log, never a throw.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { monidFound, monidList, monidRun } from "../lib/monid"

type Call = { url: string; init?: RequestInit }
function fakeFetch(script: Array<{ status: number; body: unknown }>, calls: Call[]) {
  let i = 0
  return (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    const step = script[Math.min(i, script.length - 1)]
    i += 1
    return new Response(JSON.stringify(step.body), { status: step.status, headers: { "content-type": "application/json" } })
  }) as typeof fetch
}
const noSleep = async () => {}

test("monid · a quick endpoint answers in one round trip, in the shape monid expects", async () => {
  const calls: Call[] = []
  const r = await monidRun(
    "anyapi",
    "/reddit.subreddit_posts",
    { body: { subreddit: "LosAngeles+orangecounty", sort: "new", limit: 5 } },
    { apiKey: "k", fetchImpl: fakeFetch([{ status: 200, body: { runId: "r1", status: "COMPLETED", output: { data: { posts: [{ id: "a" }] } }, cost: { value: 0.0008 } } }], calls), sleep: noSleep },
  )
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.cost, 0.0008)
  assert.equal(r.runId, "r1")
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, "https://api.monid.ai/v1/run")
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    provider: "anyapi",
    endpoint: "/reddit.subreddit_posts",
    input: { body: { subreddit: "LosAngeles+orangecounty", sort: "new", limit: 5 } },
  })
  assert.equal((calls[0].init?.headers as Record<string, string>).authorization, "Bearer k")
})

test("monid · a slow endpoint is polled until it settles", async () => {
  const calls: Call[] = []
  const r = await monidRun(
    "litescrape",
    "/google/reviews",
    { queryParams: { place_id: "ChIJx", num: 20 } },
    {
      apiKey: "k",
      fetchImpl: fakeFetch(
        [
          { status: 202, body: { runId: "r2", status: "READY" } },
          { status: 200, body: { runId: "r2", status: "RUNNING" } },
          { status: 200, body: { runId: "r2", status: "COMPLETED", output: { reviews: [{ rating: 5 }] }, cost: { value: 0.00015 } } },
        ],
        calls,
      ),
      sleep: noSleep,
      pollMs: 0,
    },
  )
  assert.equal(r.ok, true)
  assert.deepEqual(r.ok && r.output, { reviews: [{ rating: 5 }] })
  assert.equal(calls.length, 3)
  assert.equal(calls[1].url, "https://api.monid.ai/v1/runs/r2")
  assert.equal(calls[1].init?.method, undefined, "polling is a GET")
})

test("monid · blocked, failed, unpaid, timed out and keyless are errors, never throws", async () => {
  const blocked = await monidRun("x", "/y", {}, { apiKey: "k", fetchImpl: fakeFetch([{ status: 200, body: { runId: "r3", status: "BLOCKED", reason: "budget cap" } }], []), sleep: noSleep })
  assert.equal(blocked.ok, false)
  assert.match(!blocked.ok ? blocked.error : "", /BLOCKED \(budget cap\)/)

  const failed = await monidRun("x", "/y", {}, { apiKey: "k", fetchImpl: fakeFetch([{ status: 202, body: { runId: "r4", status: "READY" } }, { status: 200, body: { runId: "r4", status: "FAILED", reason: "upstream 500" } }], []), sleep: noSleep, pollMs: 0 })
  assert.equal(failed.ok, false)
  assert.match(!failed.ok ? failed.error : "", /FAILED \(upstream 500\)/)

  const unpaid = await monidRun("x", "/y", {}, { apiKey: "k", fetchImpl: fakeFetch([{ status: 402, body: { message: "insufficient balance" } }], []), sleep: noSleep })
  assert.equal(unpaid.ok, false)
  assert.match(!unpaid.ok ? unpaid.error : "", /402: insufficient balance/)

  let t = 0
  const slow = await monidRun("x", "/y", {}, { apiKey: "k", fetchImpl: fakeFetch([{ status: 202, body: { runId: "r5", status: "RUNNING" } }], []), sleep: noSleep, pollMs: 0, timeoutMs: 100, now: () => (t += 60) })
  assert.equal(slow.ok, false)
  assert.match(!slow.ok ? slow.error : "", /run r5 still RUNNING after 100 ms/)

  const keyless = await monidRun("x", "/y", {}, { apiKey: "", fetchImpl: fakeFetch([], []), sleep: noSleep })
  assert.equal(keyless.ok, false)
  assert.match(!keyless.ok ? keyless.error : "", /MONID_API_KEY not set/)

  const down = await monidRun("x", "/y", {}, { apiKey: "k", fetchImpl: (async () => { throw new Error("ECONNRESET") }) as unknown as typeof fetch, sleep: noSleep })
  assert.equal(down.ok, false)
  assert.match(!down.ok ? down.error : "", /network: ECONNRESET/)
})

test("monid · the rows inside each provider's shape", () => {
  assert.equal(monidList({ found: true, data: { nextCursor: "c", posts: [{ id: 1 }] } }, "posts").length, 1)
  assert.equal(monidList({ found: true, data: { items: [{ id: 1 }, { id: 2 }] } }, "items", "posts").length, 2)
  assert.equal(monidList([{ items: [{ a: 1 }], rating: { value: 5 } }], "items").length, 1)
  assert.equal(monidList({ reviews: [{ r: 1 }], place_info: { title: "x" } }, "reviews").length, 1)
  assert.deepEqual(monidList({ found: false, data: null, reason: "not_found" }, "ads"), [])
  assert.deepEqual(monidList(null, "ads"), [])
  assert.equal(monidFound({ found: false, data: null, reason: "not_found" }), false)
  assert.equal(monidFound({ data: { ads: [] } }), true)
})
