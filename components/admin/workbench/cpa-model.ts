// CPA 波动 · 计算部分（无 React，可以单独跑）
//
// 为什么要把随机波动画出来：CPA 的分母是押金单，一周只有 5~8 个。计数型随机的
// 幅度是 √n——n=6 时标准差 2.4，生意一点没变，光靠运气这周也可能是 4 单或 8 单，
// CPA 从 C/8 跳到 C/4，**上下 50%**。所以"这周 CPA 涨了 40%"本身不携带信息，
// 得先问一句"40% 超出随机范围了吗"。
//
// 做法：拿最近几个完整周合起来估一个"现在大概什么水平"（refCpa），再用它推出
// 这一周的花费按这个水平**应该**换来多少单（nExp），然后让这个计数按 Poisson
// 抖 ±√nExp，换算回 CPA 就是那条浅带。真实值落在带里 = 什么都没发生。
//
// 这不是严格的假设检验（参考速率来自被判断的那几周本身），是一把尺子：用来
// 拦住"单周涨跌就改投放"这类动作。

import { addDays, weekSundayOf } from "./helpers"

export const WEEKS = 12
/** 参考速率取最近 4 个完整周：单周太抖，更长又跟不上变化。 */
export const REF_WEEKS = 4

export type CpaDailyRow = { date: string; cost_cents: number; deposits: number }

export type CpaWeek = {
  start: string
  cost: number
  deposits: number
  /** 花费和成单都有才算得出来 */
  cpa: number | null
  /** 按参考速率，这周纯随机就能落到的 CPA 区间；样本太少时 high 为 null（上不封顶） */
  low: number | null
  high: number | null
  side: "in" | "above" | "below" | "na"
  partial: boolean
}

export type CpaModel = {
  weeks: CpaWeek[]
  refCpa: number | null
  refDeposits: number
  /** 最后一个完整周 */
  last: CpaWeek | null
  /** 本周（还没过完） */
  cur: CpaWeek | null
  /** 连着两周掉在带外同一侧才成立，否则 null */
  streakOut: "above" | "below" | null
  oneLess: number | null
  oneMore: number | null
}

export function buildCpaModel(daily: CpaDailyRow[], from: string, thisWeek: string): CpaModel {
  const byWeek = new Map<string, { cost: number; deposits: number }>()
  for (const r of daily) {
    const w = weekSundayOf(r.date)
    const cur = byWeek.get(w) ?? { cost: 0, deposits: 0 }
    cur.cost += r.cost_cents ?? 0
    cur.deposits += r.deposits ?? 0
    byWeek.set(w, cur)
  }

  const starts: string[] = []
  for (let w = from; w <= thisWeek; w = addDays(w, 7)) starts.push(w)

  // 广告花费是 2026-09 才开始按天入库的，更早的 0 是"没有数据"不是"没花钱"。
  // 窗口开头贴着取数起点的那串空周裁掉，中间的空周保留——那些是真的。
  const raw = starts.map((s) => byWeek.get(s) ?? { cost: 0, deposits: 0 })
  const firstReal = raw.findIndex((v) => v.cost > 0 || v.deposits > 0)
  const begin = firstReal > 0 ? firstReal : 0

  const complete = starts.slice(begin, -1)
  const ref = complete.slice(-REF_WEEKS).reduce(
    (a, s) => {
      const v = byWeek.get(s) ?? { cost: 0, deposits: 0 }
      return { cost: a.cost + v.cost, deposits: a.deposits + v.deposits }
    },
    { cost: 0, deposits: 0 },
  )
  const refCpa = ref.deposits > 0 && ref.cost > 0 ? ref.cost / ref.deposits : null

  const weeks: CpaWeek[] = starts.slice(begin).map((s) => {
    const v = byWeek.get(s) ?? { cost: 0, deposits: 0 }
    const cpa = v.deposits > 0 && v.cost > 0 ? v.cost / v.deposits : null
    let low: number | null = null
    let high: number | null = null
    if (refCpa && v.cost > 0) {
      const nExp = v.cost / refCpa
      const sd = Math.sqrt(nExp)
      low = v.cost / (nExp + sd)
      // 预期不足约 2 单时，"再少一点"就趋近于零单，CPA 上不封顶。
      high = nExp - sd > 0.5 ? v.cost / (nExp - sd) : null
    }
    const side: CpaWeek["side"] =
      cpa == null || low == null ? "na" : cpa > (high ?? Infinity) ? "above" : cpa < low ? "below" : "in"
    return { start: s, cost: v.cost, deposits: v.deposits, cpa, low, high, side, partial: s === thisWeek }
  })

  const settled = weeks.filter((w) => !w.partial)
  const last = settled[settled.length - 1] ?? null
  const prior = settled[settled.length - 2] ?? null
  // 每周落在 1σ 外某一侧约 16%，两周连着同一侧 ≈ 2.6%，那才值得动手。
  const streakOut =
    last && prior && (last.side === "above" || last.side === "below") && last.side === prior.side ? last.side : null

  const cur = weeks[weeks.length - 1] ?? null
  const oneLess = cur && cur.cost > 0 && cur.deposits > 1 ? cur.cost / (cur.deposits - 1) : null
  const oneMore = cur && cur.cost > 0 ? cur.cost / (cur.deposits + 1) : null

  return { weeks, refCpa, refDeposits: ref.deposits, last, cur, streakOut, oneLess, oneMore }
}
