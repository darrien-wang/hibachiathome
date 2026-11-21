// 订单另加（自定义项，老板 2026-11-21：「那就订单这里加个自定义项，以后可能还有很多新的需求，到时候就从
// 这个地方走」）：菜单上没有的东西按单记在 invoice_data.customItems。第一个是 Ashley（RH-20261117-3312）一位
// 客人要的白米饭，送的。这边：镜像（lib/custom-items.ts，和发票仓库 lib/pricing.ts 同一套清理和行 id）、
// 备货清单（lib/prep-bom.ts）、工作台订单弹窗存的那条路（app/api/admin/orders/custom-items）。
//   npm test
import assert from "node:assert/strict"
import { test } from "node:test"

import { aggregatePrep, orderPrep, setupCountsOf } from "../lib/prep-bom"
import {
  CUSTOM_ITEMS_MAX,
  customItemRowId,
  customItemsOf,
  customQtyText,
  customUnitZh,
  parseCustomItemsInput,
  sameCustomItems,
  sanitizeCustomItems,
  type CustomItemLite,
} from "../lib/custom-items"

const RICE: CustomItemLite = { name: "Plain rice", nameZh: "白米饭", qty: 2, unit: "serving", price: 0, note: "生米每份约 3 oz" }
const ICE: CustomItemLite = { name: "Bag of ice", qty: 2, unit: "bag", price: 5 }
const inv = (over: Record<string, unknown> = {}) => ({
  mode: "quick",
  adultCount: 12,
  childCount: 0,
  quickCountItems: [
    { itemId: "steak", category: "protein", qty: 12 },
    { itemId: "chicken", category: "protein", qty: 12 },
  ],
  ...over,
})
const prepOf = (over: Record<string, unknown> = {}) => orderPrep(inv(over) as never, "2026-11-17T18:00:00Z", 12, 0)

test("mirror · the same cleaning as the invoice: a name, a quantity above 0, a price of 0 or more; the same name twice is the first", () => {
  assert.deepEqual(sanitizeCustomItems([RICE]), [RICE])
  assert.deepEqual(sanitizeCustomItems([{ name: " Plain  rice ", qty: 2, price: 0, nameZh: "", note: " " }]), [{ name: "Plain rice", qty: 2, unit: "each", price: 0 }])
  for (const bad of [{ qty: 2, price: 0 }, { name: "Rice", qty: 0, price: 0 }, { name: "Rice", qty: 2 }, { name: "Rice", qty: 2, price: -1 }, { name: "Rice", qty: "2", price: 0 }]) {
    assert.equal(sanitizeCustomItems([bad]), undefined, JSON.stringify(bad))
  }
  assert.deepEqual(sanitizeCustomItems([RICE, { ...RICE, name: "PLAIN RICE", qty: 9 }])?.map((x) => x.qty), [2])
  assert.equal(sanitizeCustomItems(Array.from({ length: 30 }, (_, i) => ({ name: `x${i}`, qty: 1, price: 0 })))?.length, CUSTOM_ITEMS_MAX)
  assert.deepEqual(customItemsOf(null), [])
})

test("mirror · row ids are the invoice's (lib/pricing.ts customItemRowId gives these), whatever the case or spacing", () => {
  assert.equal(customItemRowId("Plain rice"), "custom_xftnzk")
  assert.equal(customItemRowId("白米饭"), "custom_1iic5ac")
  assert.equal(customItemRowId("Bag of ice"), "custom_pehkp")
  assert.equal(customItemRowId("  PLAIN   rice"), "custom_xftnzk")
  assert.equal(customUnitZh("serving"), "份")
  assert.equal(customUnitZh("quart"), "quart")
  assert.deepEqual([customQtyText(2, "serving"), customQtyText(1, "bag"), customQtyText(3, "box"), customQtyText(2, "oz"), customQtyText(3, "each")], ["2 servings", "1 bag", "3 boxes", "2 oz", "3"])
})

test("prep list · a line each in their own block, the Chinese name first and the note as the hint; nothing else moves", () => {
  const plain = prepOf()
  const prep = prepOf({ customItems: [RICE, ICE] })
  assert.deepEqual(prep.items.filter((i) => i.group === "custom"), [
    { id: "custom_xftnzk", label: "白米饭 Plain rice", qty: 2, unit: "份", alt: "生米每份约 3 oz", group: "custom" },
    { id: "custom_pehkp", label: "Bag of ice", qty: 2, unit: "袋", group: "custom" },
  ])
  assert.deepEqual(prep.items.filter((i) => i.group !== "custom"), plain.items)
  assert.deepEqual(prep.proteinServings, plain.proteinServings)
})

test("prep list · the day's totals add the same item across orders and keep every note; never a pound conversion over the note", () => {
  const a = prepOf({ customItems: [RICE] }).items
  const b = prepOf({ customItems: [{ ...RICE, qty: 3, note: "一份装一盒" }] }).items
  const day = aggregatePrep([...a, ...b]).filter((i) => i.group === "custom")
  assert.deepEqual(day, [{ id: "custom_xftnzk", label: "白米饭 Plain rice", qty: 5, unit: "份", alt: "生米每份约 3 oz；一份装一盒", group: "custom" }])
  const oz = aggregatePrep(prepOf({ customItems: [{ name: "Sushi rice", qty: 40, unit: "oz", price: 0, note: "煮好的" }] }).items).find((i) => i.group === "custom")
  assert.equal(oz?.alt, "煮好的")
  // The block sits after the pantry and before the van.
  const groups = aggregatePrep(prepOf({ customItems: [RICE] }).items).map((i) => i.group)
  assert.ok(groups.indexOf("custom") > groups.lastIndexOf("pantry"))
})

test("chef pay · setupCountsOf (the table money and the load list's rentals) does not count them", () => {
  const plain = setupCountsOf(inv() as never)
  assert.deepEqual(setupCountsOf(inv({ customItems: [RICE, ICE, { name: "Folding chairs", qty: 30, unit: "each", price: 5 }] }) as never), plain)
})

test("the dialog's list is taken whole or refused whole: a bad item is named, never dropped (a dropped one is not brought, not billed)", () => {
  assert.deepEqual(parseCustomItemsInput([RICE, ICE]), { items: [RICE, ICE], errors: [] })
  assert.deepEqual(parseCustomItemsInput([]), { items: [], errors: [] })
  const bad = parseCustomItemsInput([
    { ...RICE, price: Number.NaN },
    { name: "", qty: 1, price: 0 },
    { name: "Bag of ice", qty: 0, unit: "bag", price: 5 },
    { name: "bag of ICE", qty: 1, price: 5 },
    { name: "x".repeat(61), qty: 1, price: 0 },
    { name: "Rice", nameZh: "白\uFFFD饭", qty: 1, price: 0 },
  ])
  assert.deepEqual(bad.items, [])
  assert.deepEqual(bad.errors, [
    "第 1 项：单价是美元数，0 = 送的（最多 5000）",
    "第 2 项：要有英文名（账单上客人看的）",
    "第 3 项：数量要大于 0（最多 999）",
    "第 4 项：「bag of ICE」重复了",
    "第 5 项：英文名最多 60 个字",
    "第 6 项：中文名里有乱码（编码坏了），重新打一遍",
  ])
  assert.deepEqual(parseCustomItemsInput("Plain rice").errors, ["items 要是一个列表"])
  assert.ok(sameCustomItems([RICE], [{ ...RICE }]))
  assert.ok(!sameCustomItems([RICE], [{ ...RICE, qty: 3 }]))
  assert.ok(sameCustomItems(undefined, []))
})

// ---- the route: the order by id from the invoice app, the list on it, saved through save-invoice ----
type Call = { url: string; body: Record<string, unknown>; token: string | null }

async function withRoute<T>(answers: (call: Call, n: number) => { status: number; body: unknown }, run: (post: (key: string | null, body: unknown) => Promise<[number, Record<string, unknown>]>, calls: Call[]) => Promise<T>) {
  const { NextRequest } = await import("next/server")
  const { POST } = await import("../app/api/admin/orders/custom-items/route")
  const names = ["ADMIN_DASH_KEY", "AGENT_DASH_KEYS", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "INVOICE_UPDATE_ADMIN_TOKEN"] as const
  const saved = Object.fromEntries(names.map((n) => [n, process.env[n]]))
  process.env.ADMIN_DASH_KEY = "owner-test-key"
  process.env.AGENT_DASH_KEYS = "anna:agent-test-key"
  process.env.INVOICE_UPDATE_ADMIN_TOKEN = "invoice-test-token"
  delete process.env.SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  const calls: Call[] = []
  const realFetch = globalThis.fetch
  const quiet = console.error
  console.error = () => undefined // lib/supabase.ts says the env is missing: no event row here
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), body: JSON.parse(String(init?.body ?? "{}")), token: new Headers(init?.headers).get("x-admin-token") }
    calls.push(call)
    const a = answers(call, calls.length)
    return new Response(JSON.stringify(a.body), { status: a.status, headers: { "content-type": "application/json" } })
  }) as typeof fetch
  const post = async (key: string | null, body: unknown): Promise<[number, Record<string, unknown>]> => {
    const res = await POST(new NextRequest("http://localhost/api/admin/orders/custom-items", { method: "POST", headers: { "content-type": "application/json", ...(key ? { "x-admin-key": key } : {}) }, body: JSON.stringify(body) }))
    return [res.status, (await res.json()) as Record<string, unknown>]
  }
  try {
    return await run(post, calls)
  } finally {
    globalThis.fetch = realFetch
    console.error = quiet
    for (const n of names) {
      if (saved[n] === undefined) delete process.env[n]
      else process.env[n] = saved[n]
    }
  }
}

const ORDER_ID = "00000000-0000-4000-8000-000000003312"
const PREFILL = { ...inv(), contactInfo: { clientName: "Ashley" }, partyExtras: [] }
const LOOKUP = { ok: true, found: true, order: { orderNo: "RH-20261117-3312", updatedAt: "2026-11-21T18:00:00.000Z", version: "v1" }, prefill: PREFILL }

test("route · owner only, and a list with a bad item is refused before anything is read", async () => {
  await withRoute(() => ({ status: 500, body: {} }), async (post, calls) => {
    assert.deepEqual((await post(null, { orderId: ORDER_ID, items: [RICE] }))[0], 401)
    assert.deepEqual(await post("agent-test-key", { orderId: ORDER_ID, items: [RICE] }), [403, { ok: false, error: "只有老板能改订单另加的东西（会改账单）" }])
    const [status, body] = await post("owner-test-key", { orderId: ORDER_ID, items: [{ ...RICE, qty: 0 }] })
    assert.equal(status, 400)
    assert.equal(body.error, "第 1 项：数量要大于 0（最多 999）")
    assert.equal(calls.length, 0)
  })
})

test("route · reads the order by id with the token, saves the invoice it got with the list on it, then reads it back", async () => {
  let stored: Record<string, unknown> = PREFILL
  await withRoute(
    (call) => {
      if (call.url.endsWith("/api/self-service/orders/lookup")) return { status: 200, body: { ...LOOKUP, prefill: stored } }
      stored = call.body.invoiceData as Record<string, unknown>
      return { status: 200, body: { ok: true, orderNo: "RH-20261117-3312", lint: { blocking: [], warnings: [] } } }
    },
    async (post, calls) => {
      const [status, body] = await post("owner-test-key", { orderId: ORDER_ID, items: [RICE] })
      assert.equal(status, 200, JSON.stringify(body))
      assert.deepEqual([body.ok, body.kept, body.items], [true, true, [RICE]])
      assert.deepEqual(calls.map((c) => [c.url, c.token]), [
        ["https://invoice.realhibachi.com/api/self-service/orders/lookup", "invoice-test-token"],
        ["https://invoice.realhibachi.com/api/self-service/orders/save-invoice", "invoice-test-token"],
        ["https://invoice.realhibachi.com/api/self-service/orders/lookup", "invoice-test-token"],
      ])
      assert.deepEqual(calls[0].body, { orderId: ORDER_ID })
      assert.deepEqual(calls[1].body, { orderId: ORDER_ID, invoiceData: { ...PREFILL, customItems: [RICE] }, baseUpdatedAt: "2026-11-21T18:00:00.000Z", baseVersion: "v1" })
      // The same list again is nothing to save.
      const again = await post("owner-test-key", { orderId: ORDER_ID, items: [RICE] })
      assert.deepEqual([again[0], again[1].unchanged], [200, true])
      assert.equal(calls.length, 4)
      // An empty list takes them all off: the key leaves the invoice.
      const off = await post("owner-test-key", { orderId: ORDER_ID, items: [] })
      assert.equal(off[0], 200)
      assert.ok(!("customItems" in (calls[5].body.invoiceData as Record<string, unknown>)))
    },
  )
})

test("route · changed under us: save-invoice's 409 saves nothing and says to reopen; an invoice app that dropped them says so", async () => {
  await withRoute(
    (call) => (call.url.endsWith("/lookup") ? { status: 200, body: LOOKUP } : { status: 409, body: { ok: false, conflict: true } }),
    async (post) => {
      const [status, body] = await post("owner-test-key", { orderId: ORDER_ID, items: [RICE] })
      assert.equal(status, 409)
      assert.equal(body.conflict, true)
      assert.match(String(body.error), /什么都没存/)
    },
  )
  await withRoute(
    (call) => (call.url.endsWith("/lookup") ? { status: 200, body: LOOKUP } : { status: 200, body: { ok: true, orderNo: "RH-20261117-3312" } }),
    async (post) => {
      const [status, body] = await post("owner-test-key", { orderId: ORDER_ID, items: [RICE] })
      assert.equal(status, 200)
      assert.equal(body.kept, false)
      assert.match(String(body.warning), /发票应用没留下/)
    },
  )
})
