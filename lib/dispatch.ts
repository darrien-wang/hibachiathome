// 一天几场，最少要几个师傅、谁接谁（老板 2026-09-29）。
//
// 这里照抄的是老板他们人工排班的算法，不是我自己想出来的那一版。原话：
//
//   "第一台我们认为能够准时开场，甚至看情况提前开始……然后就是一个服务时长，计算到
//    装车能够出发，可能是 1 个半小时到 2 小时，再算一个两点之间的路程，能否提前
//    10min 到达客户家，最差情况踩点到，最差情况是迟到半小时，可能引起索赔的是迟到
//    1 小时，极限就是迟到 1 小时了，这个时候我们会给客户 100–200 的 off。"
//
// 和我第一版的出入（都以这里为准）：
//   · 占用时长是一个**范围**（90–120 分钟，开场到装车出发），不是一个数。
//     所以每条衔接都有"顺利的话"和"拖满的话"两个到场时刻。
//   · 到场标准是提前 10 分钟，不是 30 分钟。
//   · 迟到不是一刀切。踩点、迟到半小时内、迟到一小时内（要赔钱）是三档不同的代价，
//     接不接是老板的风险决定，不是算法替他决定。所以这里按容忍度各算一版排班，
//     让他看到"省一个师傅"的价钱。
//
// 迟到会顺着一条链往下传：第二场晚开了，第三场出发就跟着晚。所以不能只看两两之间
// 接不接得上（那样会高估），要沿着整条链把延误带下去。一天最多十来场，直接穷举
// 所有排法，取师傅最少的；一样少的里取最不容易迟到的。

export type DispatchParams = {
  /** 开场到装车出发，顺利的话（分钟） */
  busyMinMinutes: number
  /** 开场到装车出发，拖到最久 */
  busyMaxMinutes: number
  /** 目标：下一场开场前多久到 */
  arriveEarlyMinutes: number
}

/** 拖满时的到场情况，从好到坏 */
export type Grade = "solid" | "ontime" | "late_ok" | "late_limit"

export type ChainLink = {
  from: number
  to: number
  driveMinutes: number
  /** 到场时刻减开场时刻。负数 = 早到，正数 = 迟到。服务按最短算。 */
  bestLate: number
  /** 同上，服务按拖满算——排班看的是这个数。 */
  worstLate: number
  grade: Grade
}

export type DayPlan = {
  /** 这版排班最多容忍迟到几分钟 */
  tolerance: number
  chefs: number
  chains: number[][]
  links: ChainLink[]
}

export function gradeOf(worstLate: number, p: DispatchParams, lateOk: number): Grade {
  if (worstLate <= -p.arriveEarlyMinutes) return "solid"
  if (worstLate <= 0) return "ontime"
  if (worstLate <= lateOk) return "late_ok"
  return "late_limit"
}

type Chain = { items: number[]; links: ChainLink[]; delayBest: number; delayWorst: number }

/**
 * @param starts    每场开场时刻（当天零点起的分钟数，墙上时间）
 * @param drive     drive[i][j] = 第 i 场开到第 j 场的分钟数；null = 不知道（地址定位不到）
 * @param tolerance 拖满的情况下，最多允许迟到几分钟（0 = 最差踩点到）
 * @param lateOk    迟到多少分钟以内算"还行"，只用来给衔接定档
 */
export function planDay(starts: number[], drive: Array<Array<number | null>>, p: DispatchParams, tolerance: number, lateOk: number): DayPlan {
  const n = starts.length
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => starts[a] - starts[b] || a - b)

  let best: { chains: Chain[]; score: [number, number, number] } | null = null
  const chains: Chain[] = []

  const scoreOf = (): [number, number, number] => {
    const lates = chains.flatMap((c) => c.links.map((l) => l.worstLate))
    return [chains.length, lates.length ? Math.max(...lates) : -9999, lates.reduce((a, b) => a + b, 0)]
  }
  const beats = (a: [number, number, number], b: [number, number, number]) => a[0] !== b[0] ? a[0] < b[0] : a[1] !== b[1] ? a[1] < b[1] : a[2] < b[2]

  const rec = (k: number) => {
    // 师傅数只会越排越多，已经比最好的那版多了就不用往下试。
    if (best && chains.length > best.score[0]) return
    if (k === n) {
      const s = scoreOf()
      if (!best || beats(s, best.score)) {
        best = { chains: chains.map((c) => ({ ...c, items: [...c.items], links: [...c.links] })), score: s }
      }
      return
    }
    const j = order[k]

    for (const c of chains) {
      const i = c.items[c.items.length - 1]
      // 只往后接。同一时刻开场的两场谁也接不了谁。
      if (!(starts[j] > starts[i])) continue
      const d = drive[i]?.[j]
      if (d === null || d === undefined) continue
      // 上一场要是晚开了，这一场出发也跟着晚——延误顺着链往下带。
      const worstLate = starts[i] + c.delayWorst + p.busyMaxMinutes + d - starts[j]
      const bestLate = starts[i] + c.delayBest + p.busyMinMinutes + d - starts[j]
      if (worstLate > tolerance) continue

      const saved = { delayBest: c.delayBest, delayWorst: c.delayWorst }
      c.items.push(j)
      c.links.push({ from: i, to: j, driveMinutes: d, bestLate, worstLate, grade: gradeOf(worstLate, p, lateOk) })
      // 到了还得摆台：比"提前 10 分钟"晚到多少，这一场就晚开多少。
      c.delayWorst = Math.max(0, worstLate + p.arriveEarlyMinutes)
      c.delayBest = Math.max(0, bestLate + p.arriveEarlyMinutes)
      rec(k + 1)
      c.items.pop()
      c.links.pop()
      c.delayBest = saved.delayBest
      c.delayWorst = saved.delayWorst
    }

    // 或者这一场另派一个师傅。他的第一台：准时开，延误为零。
    chains.push({ items: [j], links: [], delayBest: 0, delayWorst: 0 })
    rec(k + 1)
    chains.pop()
  }
  rec(0)

  const found = (best as { chains: Chain[]; score: [number, number, number] } | null)?.chains ?? []
  const sorted = [...found].sort((a, b) => starts[a.items[0]] - starts[b.items[0]])
  return {
    tolerance,
    chefs: sorted.length,
    chains: sorted.map((c) => c.items),
    links: sorted.flatMap((c) => c.links),
  }
}
