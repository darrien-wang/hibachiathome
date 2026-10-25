// The invoice app's order lint as this side reads it (D-1017-02): the lead
// scan's 已付未齐 gaps and the lead watch's 72h / 48h summaries. No network:
// fetch is replaced for each test.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { blockingLine, fetchOrderLint, fetchOrderLints, gapsWithLint, type OrderLint } from "../lib/order-lint-client"

const ID = "8e3d4a2d-06cd-4f25-99ce-9144acf86a7e"
const lint = (over: Partial<OrderLint> = {}): OrderLint => ({ orderId: ID, orderNo: "RH-20260919-0223", blocking: [], warnings: [], ...over })
const owed = { code: "entitlement_missing", message: "Owed by rule", messageZh: "按规则该有、发票上没有：FREE appetizer (20+ guests): Gyoza" }

function withFetch(answer: (url: string, init?: RequestInit) => Response | Promise<Response>, run: () => Promise<void>) {
  const real = globalThis.fetch
  const token = process.env.INVOICE_UPDATE_ADMIN_TOKEN
  process.env.INVOICE_UPDATE_ADMIN_TOKEN = "test-token"
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => answer(String(input), init)) as typeof fetch
  return run().finally(() => {
    globalThis.fetch = real
    if (token === undefined) delete process.env.INVOICE_UPDATE_ADMIN_TOKEN
    else process.env.INVOICE_UPDATE_ADMIN_TOKEN = token
  })
}

test("gaps: the scan's own first, then blocking (!!) and warnings, 菜单空 once", () => {
  const gaps = gapsWithLint(["菜单空"], lint({ blocking: [owed, { code: "menu_missing", message: "No menu", messageZh: "菜单空" }], warnings: [{ code: "travel_unmeasured", message: "t", messageZh: "有地址但路费没算" }] }))
  assert.deepEqual(gaps, ["菜单空", `!! ${owed.messageZh}`, "有地址但路费没算"])
  assert.deepEqual(gapsWithLint(["时间待定"], null), ["时间待定"])
})

test("the summary line says what blocks, nothing when nothing does", () => {
  assert.equal(blockingLine(lint({ blocking: [owed] })), `订单缺项：${owed.messageZh}`)
  assert.equal(blockingLine(lint({ warnings: [owed] })), "")
  assert.equal(blockingLine(null), "")
})

test("fetchOrderLints asks the invoice app once, with the shared token, and keys the answer by order", () =>
  withFetch(
    (url, init) => {
      assert.match(url, /^https:\/\/invoice\.realhibachi\.com\/api\/orders\/lint\?ids=8e3d4a2d/)
      assert.equal((init?.headers as Record<string, string>)["x-admin-token"], "test-token")
      return new Response(JSON.stringify({ ok: true, orders: [{ orderId: ID, orderNo: "RH-20260919-0223", blocking: [owed], warnings: [] }] }), {
        headers: { "content-type": "application/json" },
      })
    },
    async () => {
      const got = await fetchOrderLints([ID, ID, "not-an-id"])
      assert.deepEqual(got?.get(ID)?.blocking.map((x) => x.code), ["entitlement_missing"])
    },
  ))

test("an invoice app that does not answer is null, never a clean order", () =>
  withFetch(
    () => new Response("upstream down", { status: 502 }),
    async () => {
      assert.equal(await fetchOrderLints([ID]), null)
      assert.equal(await fetchOrderLint("RH-20260919-0223"), null)
    },
  ))

test("no ids, no call", () =>
  withFetch(
    () => {
      throw new Error("no call expected")
    },
    async () => {
      assert.deepEqual(await fetchOrderLints([]), new Map())
    },
  ))
