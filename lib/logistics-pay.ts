import { payableHeads } from "@/lib/chef-pay"
import { partyHeadCounts, type OrderForHeads } from "@/lib/party-heads"

// 后勤（备货）的工钱：她做了哪几单是逐单勾出来的（兼职，不是每单都做 ——
// 老板 2026-10-11），勾上的单按人头算 —— 大人 1、收费小孩 0.5、免费小孩不计
// （和师傅人头费、看板"服务人数"同一口径，lib/party-heads.ts），乘以每人头单价。
// 27 个大人的单 = $27。每周日结一次（周一–周日）。
// staff_order_pay 一行 = 她做了这一单；settlement_id 有值 = 这单结过了，只结一次。

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
 * 三堆，都不含结过的、取消的、没定日期的：
 *   open       勾了、派对日期到 todayYmd 为止 —— 可以结
 *   upcoming   勾了、还没办 —— 办了才进结算
 *   candidates 没勾的单（sinceYmd 到 untilYmd），给老板勾
 */
export function logisticsLedgerRows(
  orders: LogisticsOrder[],
  opts: { perHeadCents: number; todayYmd: string; sinceYmd: string; untilYmd: string; markedOrderIds: Iterable<string>; paidOrderIds: Iterable<string> },
): { open: LogisticsRow[]; upcoming: LogisticsRow[]; candidates: LogisticsRow[] } {
  const marked = new Set(opts.markedOrderIds)
  const paid = new Set(opts.paidOrderIds)
  const open: LogisticsRow[] = []
  const upcoming: LogisticsRow[] = []
  const candidates: LogisticsRow[] = []
  for (const o of orders) {
    if (!o.event_start || o.order_status === "cancelled" || paid.has(o.id)) continue
    const ymd = o.event_start.slice(0, 10)
    if (marked.has(o.id)) (ymd <= opts.todayYmd ? open : upcoming).push(logisticsRow(o, opts.perHeadCents))
    else if (ymd >= opts.sinceYmd && ymd <= opts.untilYmd) candidates.push(logisticsRow(o, opts.perHeadCents))
  }
  const byDate = (a: LogisticsRow, b: LogisticsRow) => a.date.localeCompare(b.date) || (a.orderNo ?? "").localeCompare(b.orderNo ?? "")
  return { open: open.sort(byDate), upcoming: upcoming.sort(byDate), candidates: candidates.sort(byDate) }
}

export const sumCents = (rows: LogisticsRow[]) => rows.reduce((a, r) => a + r.cents, 0)
export const sumHeads = (rows: LogisticsRow[]) => rows.reduce((a, r) => a + r.heads, 0)
