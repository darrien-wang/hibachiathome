import { createHash, randomBytes } from "node:crypto"
import { isInvoiceToken, outsourcedMark } from "@/lib/outsourced"

// 给合作方的 invoice（老板 2026-11-18「合作方需要invoice 不需要那个备料单」）。服务器端用。
//
// 发票工具只有 /api/invoice/pdf?token=…，token 要先把发票数据 POST 到 /api/invoice 才拿得到，
// 而且 30 分钟就失效——老板发给合作方的那条第二天就打不开了。所以这边给每个外包单一个
// 长期有效的链接 www.realhibachi.com/p/invoice/<token>（app/p/invoice/[token]/route.ts）：
// 每次打开，按订单现在的 invoice_data 现铸一份，302 跳过去。链接本身到派对后两周才停（PARTNER_LINK_DAYS_AFTER_PARTY），打开看到的
// 永远是订单现在的样子。铸法和工作台"看现在的发票"（app/api/admin/invoice-preview）是同一个：
// 客户视角 view=confirmed，带单号。
//
// 发票工具每铸一次在 invoice_tokens 里写一行（30 分钟后自己清掉）。同一份数据十几分钟内
// 再打开（发链接时聊天软件抓预览、合作方来回点）用同一条，不再写。

export const INVOICE_API = "https://invoice.realhibachi.com/api/invoice"

/** A fresh partner token: 24 random bytes, 32 base64url characters (lib/outsourced.ts isInvoiceToken). */
export function newInvoiceToken(): string {
  return randomBytes(24).toString("base64url")
}

export type InvoicePay = "cash" | "venmo" | "card"
/** ?pay= on the invoice page picks the bill: cash, Venmo/Zelle or card (invoice lib/invoice-html.ts invoicePayByOf). */
export const payOf = (v: string | null | undefined): InvoicePay | null => (v === "cash" || v === "venmo" || v === "card" ? v : null)

export type MintResult = { ok: true; url: string } | { ok: false; status: number; error: string }

/**
 * The invoice as it stands, freshly minted by the invoice tool: the customer's view (view=confirmed)
 * with the order number on it, and the bill to open on when pay is given. Never throws.
 */
export async function mintInvoiceView(
  order: { order_no: string | null; invoice_data: unknown },
  opts: { pay?: InvoicePay | null; fetchImpl?: typeof fetch } = {},
): Promise<MintResult> {
  if (!order.invoice_data) return { ok: false, status: 404, error: "这单还没有发票数据，先用专业表单开一张" }
  const doFetch = opts.fetchImpl ?? fetch
  try {
    const res = await doFetch(INVOICE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order.invoice_data),
      cache: "no-store",
    })
    const data = (await res.json()) as { pdfUrl?: string; errors?: string[]; error?: string }
    if (!res.ok || !data.pdfUrl) return { ok: false, status: 502, error: data.errors?.join("; ") || data.error || "发票工具没接受这份数据" }
    // view=confirmed 是客户看的那一版（只印点了的菜，不印内部勾选清单）。
    const url = `${data.pdfUrl}&order_no=${encodeURIComponent(order.order_no ?? "")}&view=confirmed${opts.pay ? `&pay=${opts.pay}` : ""}`
    return { ok: true, url }
  } catch (e) {
    return { ok: false, status: 502, error: String(e) }
  }
}

/** The order columns the partner link reads. */
export const PARTNER_ORDER_COLUMNS = "id, order_no, order_status, event_start, invoice_data, dispatch_plan"
export type PartnerOrder = { id: string; order_no: string | null; order_status: string | null; event_start?: string | null; invoice_data: unknown; dispatch_plan: unknown }

/**
 * The partner's link stops this long after the party (review 2026-11-19): the invoice carries the
 * customer's name, phone, email and address, and nobody needs it once the party is settled.
 */
export const PARTNER_LINK_DAYS_AFTER_PARTY = 14

export type PartnerInvoiceResult = { status: 302; location: string } | { status: 404 | 502; body: string }

/** A minted invoice is reused for this long (the invoice tool keeps it 30 minutes). */
export const PARTNER_INVOICE_REUSE_MS = 15 * 60_000
const CACHE_MAX = 200
const partnerCache = new Map<string, { url: string; at: number }>()

const NOT_FOUND: PartnerInvoiceResult = { status: 404, body: "Not found" }

/**
 * GET /p/invoice/<token>: where the partner's link goes right now. 404 for a token that is malformed or
 * unknown, an order that is no longer outsourced (改回直营 drops the token) or cancelled, one whose party
 * was more than PARTNER_LINK_DAYS_AFTER_PARTY days ago, or one with no invoice yet; 502 when the invoice tool would not mint (the partner sees no internals, the log does).
 * findOrders: the orders whose mark carries this token (the database filter); the mark is checked
 * again here, so a loose filter cannot open someone else's invoice.
 */
export async function partnerInvoiceRedirect(
  token: string,
  deps: {
    findOrders: (token: string) => Promise<PartnerOrder[]>
    pay?: InvoicePay | null
    fetchImpl?: typeof fetch
    cache?: Map<string, { url: string; at: number }>
    now?: number
  },
): Promise<PartnerInvoiceResult> {
  if (!isInvoiceToken(token)) return NOT_FOUND
  let rows: PartnerOrder[]
  try {
    rows = await deps.findOrders(token)
  } catch (e) {
    console.error("[partner-invoice] order lookup failed", e instanceof Error ? e.message : e)
    return { status: 502, body: "The invoice is not available right now. Please try again in a minute." }
  }
  const hits = rows.filter((o) => outsourcedMark(o.dispatch_plan)?.invoice_token === token && !/cancel|void|refund/i.test(o.order_status ?? ""))
  if (hits.length !== 1) return NOT_FOUND
  const order = hits[0]
  const now = deps.now ?? Date.now()
  // event_start is PT wall time stored as UTC, so this is off by 7-8 hours at most: nothing against 14 days.
  const partyAt = order.event_start ? Date.parse(order.event_start) : NaN
  if (Number.isFinite(partyAt) && now > partyAt + PARTNER_LINK_DAYS_AFTER_PARTY * 86_400_000) return NOT_FOUND
  if (!order.invoice_data) return { status: 404, body: "This invoice is not ready yet." }

  const cache = deps.cache ?? partnerCache
  const digest = createHash("sha256").update(JSON.stringify([order.order_no, order.invoice_data])).digest("hex").slice(0, 24)
  const key = `${token}|${deps.pay ?? ""}|${digest}`
  const hit = cache.get(key)
  if (hit && now - hit.at < PARTNER_INVOICE_REUSE_MS) return { status: 302, location: hit.url }

  const minted = await mintInvoiceView(order, { pay: deps.pay ?? null, fetchImpl: deps.fetchImpl })
  if (!minted.ok) {
    console.error("[partner-invoice] mint failed", order.order_no, minted.error)
    return { status: 502, body: "The invoice could not be opened right now. Please try again in a minute." }
  }
  for (const [k, v] of cache) if (now - v.at >= PARTNER_INVOICE_REUSE_MS) cache.delete(k)
  while (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string)
  cache.set(key, { url: minted.url, at: now })
  return { status: 302, location: minted.url }
}
