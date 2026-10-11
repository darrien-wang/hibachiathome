import { payableHeads, type HeadCounts } from "@/lib/chef-pay"

// 一场派对有几位大人 / 收费小孩 / 免费小孩，以及按月汇总。
// 一个口径三处用：师傅结算（人头费）、日历月份小结、看板"每月服务人数"。
// 折算人数 = 大人 1 + 收费小孩 0.5，免费小孩不计（老板 2026-10-06 / 10-10）。

export type OrderForHeads = {
  invoice_data?: unknown
  guest_adult_count?: number | null
  guest_child_count?: number | null
}

/** 发票里读人头。免费小孩以 under-5 促销行为准（比 isLittle 标志可靠）。 */
export function partyHeadCounts(o: OrderForHeads): HeadCounts {
  const inv = (o.invoice_data ?? {}) as Record<string, unknown>
  const guests = Array.isArray(inv.guests) ? (inv.guests as Array<Record<string, unknown>>) : []
  const promos = Array.isArray(inv.promotions) ? (inv.promotions as Array<Record<string, unknown>>) : []
  const under5 = promos.find((p) => /^little kids/i.test(String(p.label ?? "")))
  const under5N = under5 ? Number(String(under5.label ?? "").match(/×(\d+)/)?.[1] ?? 1) : 0

  if (inv.mode === "detailed" && guests.length) {
    const adults = guests.filter((g) => g.isChild !== true).length
    const flagged = guests.filter((g) => g.isChild === true && g.isLittle === true).length
    const littles = Math.max(flagged, under5N)
    const kids = Math.max(0, guests.filter((g) => g.isChild === true).length - littles)
    return { adults, kids, littles }
  }
  const adults = Number(inv.adultCount ?? o.guest_adult_count ?? 0) || 0
  const child = Number(inv.childCount ?? o.guest_child_count ?? 0) || 0
  const littles = Math.min(child, under5N)
  return { adults, kids: Math.max(0, child - littles), littles }
}

export type MonthOrder = OrderForHeads & {
  event_start: string | null
  order_status?: string | null
  quoted_total_cents?: number | null
  amount_paid_total_cents?: number | null
}

export type MonthStat = {
  /** YYYY-MM（event_start 是墙上时间按 UTC 存的，直接切前 7 位） */
  month: string
  parties: number
  /** 其中已经办完的（派对日期早于今天） */
  done: number
  adults: number
  kids: number
  littles: number
  /** 折算人数：大人 + 收费小孩 × 0.5 */
  heads: number
  /** 订单总价（现金口径，含路费，不含小费）；没权限看钱时为 null */
  revenueCents: number | null
  /** 其中已办场次的总价 */
  doneRevenueCents: number | null
  /** 实际已收（含客人刷卡时一起付的小费） */
  paidCents: number | null
  /** 只有场次、没有人数金额的历史月份（2025 导入） */
  countOnly?: boolean
}

/** 按派对日期所在月份汇总；取消的单不算。todayYmd 用 PT 日期。 */
export function monthlyStats(orders: MonthOrder[], todayYmd: string, withMoney: boolean): MonthStat[] {
  const by = new Map<string, MonthStat>()
  for (const o of orders) {
    if (!o.event_start || o.order_status === "cancelled") continue
    const ymd = o.event_start.slice(0, 10)
    const month = ymd.slice(0, 7)
    const row =
      by.get(month) ??
      by.set(month, { month, parties: 0, done: 0, adults: 0, kids: 0, littles: 0, heads: 0, revenueCents: withMoney ? 0 : null, doneRevenueCents: withMoney ? 0 : null, paidCents: withMoney ? 0 : null }).get(month)!
    const c = partyHeadCounts(o)
    const isDone = ymd < todayYmd
    row.parties += 1
    row.adults += c.adults
    row.kids += c.kids
    row.littles += c.littles
    row.heads += payableHeads(c)
    if (isDone) row.done += 1
    if (withMoney) {
      const quoted = Math.max(0, o.quoted_total_cents ?? 0)
      row.revenueCents! += quoted
      if (isDone) row.doneRevenueCents! += quoted
      row.paidCents! += Math.max(0, o.amount_paid_total_cents ?? 0)
    }
  }
  return Array.from(by.values()).sort((a, b) => a.month.localeCompare(b.month))
}
