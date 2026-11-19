// 外包 (owner 2026-11-18, lib/outsourced.ts): a party a partner company runs for us. The mark lives on
// orders.dispatch_plan.outsourced; nothing that reads the plan may see it, nothing that rewrites the plan
// may drop it; the day map and the share pie leave the party out; the partner's invoice link
// (/p/invoice/<token>, lib/partner-invoice.ts) never expires and always opens the order as it stands.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"

import { normalizeDispatchPlan } from "../lib/dispatch-plan"
import { planForOrder } from "../lib/dispatch-plan-order"
import { UNASSIGNED_KEY, weekShare } from "../lib/chef-share"
import {
  dayMapTitle,
  isInvoiceToken,
  isOutsourced,
  keepOutsourcedMark,
  outsourcedMark,
  partnerInvoiceUrl,
  splitOutsourced,
  withOutsourcedMark,
  type OutsourcedMark,
} from "../lib/outsourced"
import { INVOICE_API, mintInvoiceView, newInvoiceToken, partnerInvoiceRedirect, PARTNER_INVOICE_REUSE_MS, payOf, type PartnerOrder } from "../lib/partner-invoice"

const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz012-_9"
const MARK: OutsourcedMark = { at: "2026-11-18T20:00:00.000Z", by: "workbench:owner", invoice_token: TOKEN }
const OWNER_PLAN = { chefs: 2, grills: 2, source: "owner", stations_note: "two U shapes", heads: 11, set_by: "workbench:owner", set_at: "2026-11-07T20:00:00Z" }

test("mark · read off dispatch_plan: object, true, or nothing", () => {
  assert.equal(outsourcedMark(null), null)
  assert.equal(outsourcedMark({ chefs: 2, grills: 2, source: "owner" }), null)
  assert.equal(outsourcedMark({ outsourced: false }), null)
  assert.equal(outsourcedMark({ outsourced: "yes" }), null)
  assert.equal(outsourcedMark([{ outsourced: MARK }]), null)
  assert.deepEqual(outsourcedMark({ outsourced: true }), { at: null, by: null, invoice_token: null })
  assert.deepEqual(outsourcedMark({ ...OWNER_PLAN, outsourced: { ...MARK, note: " Partner Co " } }), { ...MARK, note: "Partner Co" })
  // a token that is not one of ours does not become a link
  assert.equal(outsourcedMark({ outsourced: { ...MARK, invoice_token: "short" } })?.invoice_token, null)
  assert.equal(isOutsourced({ dispatch_plan: { outsourced: MARK } }), true)
  assert.equal(isOutsourced({ dispatch_plan: OWNER_PLAN }), false)
  assert.equal(isOutsourced(null), false)
})

test("mark · on and off keeps the rest of the plan exactly as stored", () => {
  const on = withOutsourcedMark(OWNER_PLAN, MARK)
  assert.deepEqual(on, { ...OWNER_PLAN, outsourced: MARK })
  assert.deepEqual(withOutsourcedMark(on, null), OWNER_PLAN)
  // no plan before: the mark alone, and taking it off gives the empty column back (null), not {}
  const alone = withOutsourcedMark(null, MARK)
  assert.deepEqual(alone, { outsourced: MARK })
  assert.equal(withOutsourcedMark(alone, null), null)
  // marking again replaces the mark, never stacks or drops the plan
  assert.deepEqual(withOutsourcedMark(on, { ...MARK, note: "Partner Co" }), { ...OWNER_PLAN, outsourced: { ...MARK, note: "Partner Co" } })
})

test("mark · invisible to the plan readers (chef sheet, rule, lint read normalizeDispatchPlan)", () => {
  assert.equal(normalizeDispatchPlan({ outsourced: MARK }), null)
  assert.deepEqual(normalizeDispatchPlan({ ...OWNER_PLAN, outsourced: MARK }), normalizeDispatchPlan(OWNER_PLAN))
  const order = { guest_adult_count: 30, guest_child_count: 0, invoice_data: null, event_start: "2026-11-21T17:00:00+00:00" }
  assert.deepEqual(planForOrder({ ...order, dispatch_plan: { outsourced: MARK } }), planForOrder({ ...order, dispatch_plan: null }))
  assert.equal(planForOrder({ ...order, dispatch_plan: { outsourced: MARK } }).chefs, 2)
})

test("mark · a writer that rebuilds the plan carries it over (set_dispatch_plan, promise capture, backfill)", () => {
  const promisePlan = { chefs: 2, grills: 2, source: "promise" as const, heads: 11 }
  const stored = { ...OWNER_PLAN, outsourced: { ...MARK, extra: "kept as stored" } }
  assert.deepEqual(keepOutsourcedMark(stored, promisePlan), { ...promisePlan, outsourced: { ...MARK, extra: "kept as stored" } })
  assert.deepEqual(keepOutsourcedMark(OWNER_PLAN, promisePlan), promisePlan)
  assert.deepEqual(keepOutsourcedMark(null, promisePlan), promisePlan)
  assert.equal(isOutsourced({ dispatch_plan: keepOutsourcedMark({ outsourced: true }, promisePlan) }), true)
})

test("day map · direct and outsourced, each in start order; the title only changes when something is outsourced", () => {
  const rows = [
    { id: "a", dispatch_plan: null },
    { id: "b", dispatch_plan: { outsourced: MARK } },
    { id: "c", dispatch_plan: OWNER_PLAN },
    { id: "d", dispatch_plan: { ...OWNER_PLAN, outsourced: true } },
  ]
  const { direct, outsourced } = splitOutsourced(rows)
  assert.deepEqual(direct.map((r) => r.id), ["a", "c"])
  assert.deepEqual(outsourced.map((r) => r.id), ["b", "d"])
  assert.equal(dayMapTitle("2026-11-21", 8, 0, 7), "2026-11-21 · 8 场 · 7 个师傅")
  assert.equal(dayMapTitle("2026-11-21", 7, 1, 7), "2026-11-21 · 7 场直营 · 1 场外包 · 7 个师傅")
  assert.equal(dayMapTitle("2026-11-21", 8, 0, null), "2026-11-21")
  assert.equal(dayMapTitle("2026-11-21", 0, 1, null), "2026-11-21 · 0 场直营 · 1 场外包")
})

test("share pie · an outsourced party is not 未派 and not in the week's heads", () => {
  const order = (id: string, adults: number, dispatch_plan: unknown) => ({
    id,
    customer_name: id,
    event_start: "2026-11-21T17:00:00+00:00",
    event_address: null,
    guest_adult_count: adults,
    guest_child_count: 0,
    order_status: "confirmed",
    dispatch_plan,
  })
  const r = weekShare([], [order("ours", 20, null), order("partner", 11, { outsourced: MARK })], "2026-11-16", "2026-11-22")
  assert.deepEqual(r.slices.map((s) => [s.key, s.heads]), [[UNASSIGNED_KEY, 20]])
  assert.equal(r.totalHeads, 20)
  assert.equal(r.partyCount, 1)
})

test("partner link · the token is 32 unguessable base64url characters and the link is ours", () => {
  const a = newInvoiceToken()
  const b = newInvoiceToken()
  assert.ok(isInvoiceToken(a) && isInvoiceToken(b))
  assert.notEqual(a, b)
  assert.equal(partnerInvoiceUrl(TOKEN), `https://www.realhibachi.com/p/invoice/${TOKEN}`)
  assert.equal(partnerInvoiceUrl("nope"), null)
  assert.equal(partnerInvoiceUrl(null), null)
  assert.equal(payOf("cash"), "cash")
  assert.equal(payOf("card"), "card")
  assert.equal(payOf("bitcoin"), null)
})

// ---- the invoice tool, faked: POST /api/invoice answers a fresh 30-minute pdfUrl per call
function fakeInvoiceTool(answer: (n: number, body: unknown) => { status: number; json: unknown } = (n) => ({ status: 200, json: { ok: true, pdfUrl: `https://invoice.realhibachi.com/api/invoice/pdf?token=tok${n}` } })) {
  const calls: Array<{ url: string; body: unknown; method: string | undefined }> = []
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? "null")), method: init?.method })
    const a = answer(calls.length, calls[calls.length - 1].body)
    return new Response(JSON.stringify(a.json), { status: a.status, headers: { "content-type": "application/json" } })
  }) as typeof fetch
  return { calls, fetchImpl }
}

const INVOICE = { contactInfo: { clientName: "Partner Party" }, adultCount: 11, childCount: 0, mode: "quick", paymentMethod: "cash" }
const partnerOrder = (over: Partial<PartnerOrder> = {}): PartnerOrder => ({
  id: "o-9978",
  order_no: "RH-20261107-9978",
  order_status: "confirmed",
  invoice_data: INVOICE,
  dispatch_plan: { ...OWNER_PLAN, outsourced: MARK },
  ...over,
})

test("mint · the workbench's 看现在的发票 and the partner link mint the same customer view", async () => {
  const tool = fakeInvoiceTool()
  const r = await mintInvoiceView({ order_no: "RH-20261107-9978", invoice_data: INVOICE }, { fetchImpl: tool.fetchImpl })
  assert.deepEqual(r, { ok: true, url: "https://invoice.realhibachi.com/api/invoice/pdf?token=tok1&order_no=RH-20261107-9978&view=confirmed" })
  assert.equal(tool.calls[0].url, INVOICE_API)
  assert.equal(tool.calls[0].method, "POST")
  assert.deepEqual(tool.calls[0].body, INVOICE)
  const cash = await mintInvoiceView({ order_no: "RH-20261107-9978", invoice_data: INVOICE }, { fetchImpl: tool.fetchImpl, pay: "cash" })
  assert.ok(cash.ok && cash.url.endsWith("&view=confirmed&pay=cash"))
  assert.deepEqual(await mintInvoiceView({ order_no: "RH-1", invoice_data: null }, { fetchImpl: tool.fetchImpl }), { ok: false, status: 404, error: "这单还没有发票数据，先用专业表单开一张" })
  const refused = fakeInvoiceTool(() => ({ status: 400, json: { ok: false, errors: ["adultCount must be a non-negative number."] } }))
  assert.deepEqual(await mintInvoiceView({ order_no: "RH-1", invoice_data: INVOICE }, { fetchImpl: refused.fetchImpl }), { ok: false, status: 502, error: "adultCount must be a non-negative number." })
})

test("partner link · token lookup and redirect: a fresh invoice of the order as it stands, reused for a while", async () => {
  const tool = fakeInvoiceTool()
  let order = partnerOrder()
  const lookups: string[] = []
  const deps = (now: number, cache: Map<string, { url: string; at: number }>) => ({
    findOrders: async (t: string) => {
      lookups.push(t)
      return [order]
    },
    pay: "cash" as const,
    fetchImpl: tool.fetchImpl,
    cache,
    now,
  })
  const cache = new Map<string, { url: string; at: number }>()
  const t0 = Date.parse("2026-11-19T10:00:00Z")
  const first = await partnerInvoiceRedirect(TOKEN, deps(t0, cache))
  assert.deepEqual(first, { status: 302, location: "https://invoice.realhibachi.com/api/invoice/pdf?token=tok1&order_no=RH-20261107-9978&view=confirmed&pay=cash" })
  assert.deepEqual(lookups, [TOKEN])
  // opened again a minute later (a chat app's link preview, the partner clicking twice): the same invoice, no new mint
  assert.deepEqual(await partnerInvoiceRedirect(TOKEN, deps(t0 + 60_000, cache)), first)
  assert.equal(tool.calls.length, 1)
  // the order changes: the next open mints the new version at once
  order = partnerOrder({ invoice_data: { ...INVOICE, adultCount: 14 } })
  const changed = await partnerInvoiceRedirect(TOKEN, deps(t0 + 120_000, cache))
  assert.equal(tool.calls.length, 2)
  assert.deepEqual(tool.calls[1].body, { ...INVOICE, adultCount: 14 })
  assert.equal(changed.status === 302 && changed.location.includes("token=tok2"), true)
  // past the reuse window (the invoice tool's own token dies at 30 minutes): minted again
  await partnerInvoiceRedirect(TOKEN, deps(t0 + 120_000 + PARTNER_INVOICE_REUSE_MS, cache))
  assert.equal(tool.calls.length, 3)
})

test("partner link · 404 for a bad or unknown token, an order back to direct, cancelled, or with no invoice", async () => {
  const tool = fakeInvoiceTool()
  const run = (token: string, rows: PartnerOrder[]) => partnerInvoiceRedirect(token, { findOrders: async () => rows, fetchImpl: tool.fetchImpl, cache: new Map() })
  let looked = false
  const findNothing = async (): Promise<PartnerOrder[]> => {
    looked = true
    return []
  }
  assert.deepEqual(await partnerInvoiceRedirect("../../etc", { findOrders: findNothing, fetchImpl: tool.fetchImpl, cache: new Map() }), { status: 404, body: "Not found" })
  assert.equal(looked, false, "a malformed token never reaches the database")
  assert.equal((await run(TOKEN, [])).status, 404)
  // 改回直营: the mark and its token are gone
  assert.equal((await run(TOKEN, [partnerOrder({ dispatch_plan: OWNER_PLAN })])).status, 404)
  // a loose database filter cannot open another order's invoice: the mark must carry this very token
  assert.equal((await run(TOKEN, [partnerOrder({ dispatch_plan: { outsourced: { ...MARK, invoice_token: newInvoiceToken() } } })])).status, 404)
  assert.equal((await run(TOKEN, [partnerOrder({ order_status: "cancelled" })])).status, 404)
  assert.equal((await run(TOKEN, [partnerOrder(), partnerOrder({ id: "o-dup" })])).status, 404)
  assert.deepEqual(await run(TOKEN, [partnerOrder({ invoice_data: null })]), { status: 404, body: "This invoice is not ready yet." })
  assert.equal(tool.calls.length, 0)
})

test("partner link · 502 says nothing of the internals when the invoice tool or the database fails", async () => {
  const refused = fakeInvoiceTool(() => ({ status: 400, json: { ok: false, errors: ["guests[0].proteins contains unknown protein ID 'x'."] } }))
  const errors = console.error
  console.error = () => {}
  try {
    const r = await partnerInvoiceRedirect(TOKEN, { findOrders: async () => [partnerOrder()], fetchImpl: refused.fetchImpl, cache: new Map() })
    assert.equal(r.status, 502)
    assert.ok(r.status === 502 && !r.body.includes("protein"))
    const down = await partnerInvoiceRedirect(TOKEN, { findOrders: async () => Promise.reject(new Error("connection refused")), fetchImpl: refused.fetchImpl, cache: new Map() })
    assert.equal(down.status, 502)
    assert.ok(down.status === 502 && !down.body.includes("connection"))
  } finally {
    console.error = errors
  }
})
