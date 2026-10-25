// The invoice app's order lint (v0-real-hibachi-invoice-generator
// lib/order-lint.ts, owner 2026-10-17, D-1017-02): what an order is missing
// that the customer is owed - an entitlement the rules give that is not on the
// invoice, a free tray or a deal item the party does not carry (so the chef
// would not bring it), a per-head line priced for another headcount, travel
// never measured, no menu inside 72 hours, a planner that disagrees with the
// invoice on the headcount. The invoice app owns invoices, so it owns the
// check; this side only asks, with the shared INVOICE_UPDATE_ADMIN_TOKEN.
//
// Never throws. null = the invoice app could not be asked (no token, down,
// slow): callers say so instead of reading the order as clean.

export type OrderIssue = { code: string; message: string; messageZh: string; fix?: string }
export type OrderLint = { orderId: string; orderNo: string | null; blocking: OrderIssue[]; warnings: OrderIssue[] }

export const INVOICE_APP_ORIGIN = "https://invoice.realhibachi.com"

function issues(raw: unknown): OrderIssue[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object")
    .map((x) => ({
      code: String(x.code ?? ""),
      message: String(x.message ?? ""),
      messageZh: String(x.messageZh ?? x.message ?? ""),
      ...(typeof x.fix === "string" ? { fix: x.fix } : {}),
    }))
}

function lintOf(raw: Record<string, unknown>): OrderLint {
  return { orderId: String(raw.orderId ?? ""), orderNo: typeof raw.orderNo === "string" ? raw.orderNo : null, blocking: issues(raw.blocking), warnings: issues(raw.warnings) }
}

async function ask(path: string, timeoutMs: number): Promise<Record<string, unknown> | null> {
  const token = process.env.INVOICE_UPDATE_ADMIN_TOKEN?.trim()
  if (!token) return null
  try {
    const res = await fetch(`${INVOICE_APP_ORIGIN}${path}`, { headers: { "x-admin-token": token }, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) })
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null
    return res.ok && body?.ok === true ? body : null
  } catch {
    return null
  }
}

/** The lint for many orders (ids), keyed by order id; null when the invoice app could not be asked. */
export async function fetchOrderLints(orderIds: string[], timeoutMs = 25_000): Promise<Map<string, OrderLint> | null> {
  const ids = [...new Set(orderIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id)))].slice(0, 120)
  if (ids.length === 0) return new Map()
  const body = await ask(`/api/orders/lint?ids=${ids.join(",")}`, timeoutMs)
  if (!body || !Array.isArray(body.orders)) return null
  return new Map((body.orders as Array<Record<string, unknown>>).map((o) => [String(o.orderId ?? ""), lintOf(o)]))
}

/** The lint for one order, by id or RH- number; null when the invoice app could not be asked. */
export async function fetchOrderLint(ident: string, timeoutMs = 20_000): Promise<(OrderLint & Record<string, unknown>) | null> {
  const id = (ident ?? "").trim()
  if (!/^[0-9a-f-]{36}$/i.test(id) && !/^RH-\d{8}-\d{4}$/.test(id)) return null
  const body = await ask(`/api/orders/${encodeURIComponent(id)}/lint`, timeoutMs)
  return body ? { ...body, ...lintOf(body) } : null
}

/**
 * The order's gaps for the scan's 已付未齐 bucket: what the scan sees itself,
 * then the lint - blocking first, marked "!!" - without saying 菜单空 twice.
 */
export function gapsWithLint(base: string[], lint: OrderLint | null | undefined): string[] {
  const out = [...base]
  const seen = new Set(base)
  for (const [mark, list] of [["!! ", lint?.blocking ?? []], ["", lint?.warnings ?? []]] as const) {
    for (const x of list) {
      if (!x.messageZh || seen.has(x.messageZh)) continue
      seen.add(x.messageZh)
      out.push(`${mark}${x.messageZh}`)
    }
  }
  return out
}

/** One line of what blocks, for a summary: "订单缺项：A；B". Empty when nothing does. */
export function blockingLine(lint: OrderLint | null | undefined): string {
  const zh = (lint?.blocking ?? []).map((x) => x.messageZh).filter(Boolean)
  return zh.length ? `订单缺项：${zh.join("；")}` : ""
}
