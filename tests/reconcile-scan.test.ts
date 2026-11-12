// Layer-2 self-test: party page vs invoice in the lead scan's bucket G
// (lib/reconcile-client.ts + lib/lead-scan.ts, order-flow rebuild 2026-11-11),
// and the customer's notes as the order drawer reads them (lib/customer-notes.ts).
// On 11-11 eleven upcoming orders had a menu on the party page and none on the
// invoice. The invoice app compares the two (card B); this side lists what it
// reports - and lists nothing, quietly, until that endpoint exists.
// No network: fetch is replaced for each test.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { fetchReconcile, normalizeReconcile } from "../lib/reconcile-client"
import { scanLeads } from "../lib/lead-scan"
import { customerNotesOf, noteSourceLabel } from "../lib/customer-notes"
import { fakeSupabase } from "./fixtures/fake-supabase"

// No Twilio in the scan: the thread is the timeline.
delete process.env.TWILIO_ACCOUNT_SID
delete process.env.TWILIO_AUTH_TOKEN

function withFetch(answer: (url: string, init?: RequestInit) => Response | Promise<Response>, run: () => Promise<void>, token: string | null = "test-token") {
  const real = globalThis.fetch
  const saved = process.env.INVOICE_UPDATE_ADMIN_TOKEN
  if (token === null) delete process.env.INVOICE_UPDATE_ADMIN_TOKEN
  else process.env.INVOICE_UPDATE_ADMIN_TOKEN = token
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => answer(String(input), init)) as typeof fetch
  return run().finally(() => {
    globalThis.fetch = real
    if (saved === undefined) delete process.env.INVOICE_UPDATE_ADMIN_TOKEN
    else process.env.INVOICE_UPDATE_ADMIN_TOKEN = saved
  })
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

const GILLIAN = { orderNo: "RH-20301110-0001", eventStart: "2030-11-26T17:00:00+00:00", diffs: ["派对页 12 位已选菜，发票菜单是空的", "8 位加餐具"] }
const DARAH = { orderNo: "RH-20301111-0002", eventStart: "2030-11-22T18:00:00+00:00", diffs: ["Makiko 加龙虾尾"] }

test("reconcile · the contract's bare list, cleaned", () => {
  assert.deepEqual(normalizeReconcile([GILLIAN, DARAH]), [GILLIAN, DARAH])
  // Rows with no order number or no difference are not rows; blanks in diffs go.
  assert.deepEqual(normalizeReconcile([{ orderNo: "RH-1", diffs: [] }, { diffs: ["x"] }, { orderNo: "RH-20301111-0002", eventStart: "", diffs: [" Makiko 加龙虾尾 ", "", null] }, "junk", null]), [
    { orderNo: "RH-20301111-0002", eventStart: null, diffs: ["Makiko 加龙虾尾"] },
  ])
})

test("reconcile · an { ok, orders } envelope and diff objects are read too; a refusal is not an empty list", () => {
  assert.deepEqual(normalizeReconcile({ ok: true, orders: [{ order_no: "RH-20301110-0001", event_start: GILLIAN.eventStart, diffs: [{ messageZh: "8 位加餐具" }, { message: "Guest count 12 vs 10" }] }] }), [
    { orderNo: "RH-20301110-0001", eventStart: GILLIAN.eventStart, diffs: ["8 位加餐具", "Guest count 12 vs 10"] },
  ])
  assert.equal(normalizeReconcile({ ok: false, error: "unauthorized" }), null)
  assert.equal(normalizeReconcile("<html>not found</html>"), null)
  assert.equal(normalizeReconcile(null), null)
  assert.deepEqual(normalizeReconcile([]), [])
})

test("reconcile · asks the invoice app once, with the shared token and the day window", () =>
  withFetch(
    (url, init) => {
      assert.equal(url, "https://invoice.realhibachi.com/api/self-service/reconcile?days=14")
      assert.equal((init?.headers as Record<string, string>)["x-admin-token"], "test-token")
      assert.equal(init?.method ?? "GET", "GET")
      return json([GILLIAN])
    },
    async () => {
      assert.deepEqual(await fetchReconcile(14), [GILLIAN])
    },
  ))

test("reconcile · not deployed, down, slow or no token: null, never a throw, never a guess", async () => {
  await withFetch(() => new Response("Not Found", { status: 404 }), async () => assert.equal(await fetchReconcile(), null))
  await withFetch(() => new Response("upstream down", { status: 502 }), async () => assert.equal(await fetchReconcile(), null))
  await withFetch(() => { throw new Error("socket hang up") }, async () => assert.equal(await fetchReconcile(), null))
  await withFetch(() => new Response("<html>login</html>", { status: 200 }), async () => assert.equal(await fetchReconcile(), null))
  let asked = 0
  await withFetch(() => (asked++, json([GILLIAN])), async () => assert.equal(await fetchReconcile(), null), null)
  assert.equal(asked, 0, "without the token nothing is asked")
})

// ---- the scan ------------------------------------------------------------------

const NOW = Date.parse("2030-11-13T20:00:00Z")
const LEAD = "00000000-0000-4000-8000-0000000000c1"
function tables() {
  return {
    leads: [],
    lead_touchpoints: [],
    orders: [
      // Complete on the row itself (address, menu, time): no gap of its own.
      {
        id: "00000000-0000-4000-8000-0000000000a1",
        order_no: GILLIAN.orderNo,
        customer_name: "Gillian Test",
        customer_phone: "(626) 000-0111",
        event_start: GILLIAN.eventStart,
        event_address: "12 Test Way, Irvine, CA 92602",
        invoice_data: { guests: [{ name: "G1", proteins: ["chicken", "steak"] }] },
        source_metadata: { lead_id: LEAD },
        deposit_status: "paid_verified",
        order_status: "active",
        created_at: "2030-11-10T00:00:00Z",
      },
    ],
  }
}

test("scan G · one line per order the invoice app reports, with its differences, soonest party first", () =>
  withFetch(
    () => json([GILLIAN, DARAH]),
    async () => {
      const r = await scanLeads(fakeSupabase(tables()) as never, NOW, { lint: false, reconcile: true })
      assert.deepEqual(r.orders, [], "the order has no gap of its own")
      assert.deepEqual(r.reconcile, [
        // Not among the scan's own orders: listed with what the invoice app gave.
        { orderNo: DARAH.orderNo, orderId: null, name: null, phone: null, leadId: null, eventStart: DARAH.eventStart, daysToEvent: 9, diffs: ["Makiko 加龙虾尾"] },
        { orderNo: GILLIAN.orderNo, orderId: "00000000-0000-4000-8000-0000000000a1", name: "Gillian Test", phone: "+16260000111", leadId: LEAD, eventStart: GILLIAN.eventStart, daysToEvent: 13, diffs: GILLIAN.diffs },
      ])
      assert.equal(r.summary.G, 2)
    },
  ))

test("scan G · the endpoint is not there yet: no lines, the rest of the scan as before", () =>
  withFetch(
    () => new Response("Not Found", { status: 404 }),
    async () => {
      const r = await scanLeads(fakeSupabase(tables()) as never, NOW, { lint: false, reconcile: true })
      assert.deepEqual(r.reconcile, [])
      assert.equal(r.summary.G, 0)
    },
  ))

test("scan G · an offline scan (lint: false) does not ask the invoice app at all", () => {
  let asked = 0
  return withFetch(
    () => (asked++, json([GILLIAN])),
    async () => {
      const r = await scanLeads(fakeSupabase(tables()) as never, NOW, { lint: false })
      assert.deepEqual(r.reconcile, [])
      assert.equal(asked, 0)
    },
  )
})

// ---- the drawer's notes ----------------------------------------------------------

test("customer notes · the order's list, oldest first; no field, nothing", () => {
  const inv = {
    customerNotes: [
      { at: "2030-11-10T16:24:00.000Z", text: "Surprise birthday, entrance thru the side gate ", source: "party_page" },
      { at: "", text: "Call when you arrive and I'll open the gate", source: "party_page" },
      { at: "2030-11-11T01:00:00Z", text: "   ", source: "party_page" },
      { text: "It's Dov's birthday" },
      "left as a bare string",
      null,
      42,
    ],
  }
  assert.deepEqual(customerNotesOf(inv), [
    { at: "2030-11-10T16:24:00.000Z", text: "Surprise birthday, entrance thru the side gate", source: "party_page" },
    { at: null, text: "Call when you arrive and I'll open the gate", source: "party_page" },
    { at: null, text: "It's Dov's birthday", source: "" },
    { at: null, text: "left as a bare string", source: "" },
  ])
  for (const none of [null, undefined, {}, { customerNotes: null }, { customerNotes: "x" }, { customerNotes: [] }, "invoice"]) assert.deepEqual(customerNotesOf(none), [])
  assert.equal(noteSourceLabel("party_page"), "派对页")
  assert.equal(noteSourceLabel("zola"), "zola")
})
