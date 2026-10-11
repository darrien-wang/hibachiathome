import { payableHeads } from "@/lib/chef-pay"
import { partyHeadCounts, type OrderForHeads } from "@/lib/party-heads"

// 后勤（备货）的工钱：从起算日起，每一场办了的派对按人头算 ——
// 大人 1、收费小孩 0.5、免费小孩不计（和师傅人头费、看板"服务人数"同一口径，
// lib/party-heads.ts），乘以每人头单价。27 个大人的单 = $27（老板 2026-10-11）。
// 每周日结一次（周一–周日）。一单只结一次：结过的记在 staff_order_pay。

export type LogisticsOrder = OrderForHeads & {
  id: string
  order_no?: string | null
  customer_name?: string | null
  event_start: string | null
  order_status?: string | null
}

export type LogisticsRow = {
  orderId: string
  orderNo: string | null
  date: string
  customer: string | null
  adults: number
  kids: number
  littles: number
  heads: number
  cents: number
}

export function logisticsRow(o: LogisticsOrder, perHeadCents: number): LogisticsRow {
  const c = partyHeadCounts(o)
  const heads = payableHeads(c)
  return {
    orderId: o.id,
    orderNo: o.order_no ?? null,
    date: (o.event_start ?? "").slice(0, 10),
    customer: o.customer_name ?? null,
    adults: c.adults,
    kids: c.kids,
    littles: c.littles,
    heads,
    cents: Math.round(heads * perHeadCents),
  }
}

/**
 * 没结过的场，按日期分两堆：open = 派对日期到 throughYmd 为止（可以结），
 * upcoming = 之后到 untilYmd（这周还没办的，只做预告）。取消的、没定日期的、
 * 起算日之前的、结过的都不算。
 */
export function logisticsOpenRows(
  orders: LogisticsOrder[],
  opts: { perHeadCents: number; startYmd: string; throughYmd: string; untilYmd?: string; paidOrderIds: Iterable<string> },
): { open: LogisticsRow[]; upcoming: LogisticsRow[] } {
  const paid = new Set(opts.paidOrderIds)
  const until = opts.untilYmd && opts.untilYmd > opts.throughYmd ? opts.untilYmd : opts.throughYmd
  const open: LogisticsRow[] = []
  const upcoming: LogisticsRow[] = []
  for (const o of orders) {
    if (!o.event_start || o.order_status === "cancelled" || paid.has(o.id)) continue
    const ymd = o.event_start.slice(0, 10)
    if (ymd < opts.startYmd || ymd > until) continue
    ;(ymd <= opts.throughYmd ? open : upcoming).push(logisticsRow(o, opts.perHeadCents))
  }
  const byDate = (a: LogisticsRow, b: LogisticsRow) => a.date.localeCompare(b.date) || (a.orderNo ?? "").localeCompare(b.orderNo ?? "")
  return { open: open.sort(byDate), upcoming: upcoming.sort(byDate) }
}

export const sumCents = (rows: LogisticsRow[]) => rows.reduce((a, r) => a + r.cents, 0)
export const sumHeads = (rows: LogisticsRow[]) => rows.reduce((a, r) => a + r.heads, 0)
