import { INVOICE_APP_ORIGIN } from "@/lib/order-lint-client"

// The invoice app's party-page / invoice reconcile (order-flow rebuild
// 2026-11-11, D-1111-03, card B): for every order with a party in the next
// `days` days, where the customer's party page and the saved invoice disagree -
// headcount, each guest's proteins, appetizers, tables and tableware,
// allergies. On 11-11 eleven upcoming orders had a menu picked on the page and
// an empty one on the invoice, and nobody knew.
//
//   GET /api/self-service/reconcile?days=14   (x-admin-token: INVOICE_UPDATE_ADMIN_TOKEN)
//   -> [{ orderNo, eventStart, diffs: ["Makiko 加龙虾尾", "8 位加餐具"] }]
//
// The invoice app owns both copies, so it owns the comparison; this side only
// asks and lists (desk scan, bucket G). Never throws. null = it could not be
// asked (no token, not deployed yet, down, slow): callers show nothing.

export type ReconcileRow = { orderNo: string; eventStart: string | null; diffs: string[] }

function rowsOf(body: unknown): unknown[] | null {
  if (Array.isArray(body)) return body
  if (body && typeof body === "object") {
    const o = body as Record<string, unknown>
    if (o.ok === false) return null
    // The contract is a bare list; an { ok, orders: [...] } envelope like the lint's is read too.
    for (const key of ["orders", "rows", "items", "results", "data"]) if (Array.isArray(o[key])) return o[key] as unknown[]
  }
  return null
}

const text = (v: unknown): string => {
  if (typeof v === "string") return v.trim()
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>
    for (const key of ["messageZh", "message", "text", "label"]) if (typeof o[key] === "string") return (o[key] as string).trim()
  }
  return ""
}

/** The contract's rows, cleaned: an order number, and at least one difference in words. */
export function normalizeReconcile(body: unknown): ReconcileRow[] | null {
  const rows = rowsOf(body)
  if (!rows) return null
  const out: ReconcileRow[] = []
  for (const r of rows) {
    if (!r || typeof r !== "object") continue
    const o = r as Record<string, unknown>
    const orderNo = text(o.orderNo ?? o.order_no)
    const diffs = (Array.isArray(o.diffs) ? o.diffs : []).map(text).filter(Boolean)
    if (!orderNo || !diffs.length) continue
    const start = o.eventStart ?? o.event_start
    out.push({ orderNo, eventStart: typeof start === "string" && start ? start : null, diffs })
  }
  return out
}

export async function fetchReconcile(days = 14, timeoutMs = 20_000): Promise<ReconcileRow[] | null> {
  const token = process.env.INVOICE_UPDATE_ADMIN_TOKEN?.trim()
  if (!token) return null
  try {
    const res = await fetch(`${INVOICE_APP_ORIGIN}/api/self-service/reconcile?days=${Math.max(1, Math.round(days))}`, {
      headers: { "x-admin-token": token },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return null
    return normalizeReconcile(await res.json().catch(() => null))
  } catch {
    return null
  }
}
