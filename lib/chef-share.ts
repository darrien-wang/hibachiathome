// 师傅份额：每位师傅占这一周总人数的比例，点一块看是哪些单（老板 2026-10-30）。
// 人数口径和工钱一样：大人 1、收费小孩 0.5、免费小孩 0，多位师傅同场平分。帮手不算。

/** 派单顺序，也是饼图的固定次序。颜色跟人走，换一周不变色。 */
export const ROTATION = ["Blu", "Gary", "John", "Eason", "易非"]
/** 只有这三位要每周 30–40 人；Eason 一周 1–2 单就行，易非最后考虑。 */
export const TARGET_CHEFS = ["Blu", "Gary", "John"]
export const TARGET_MIN = 30
export const TARGET_MAX = 40

export const OTHER_KEY = "other"
export const UNASSIGNED_KEY = "unassigned"

export type ShareParty = {
  orderId: string
  date: string
  eventStart: string | null
  customer: string | null
  address: string | null
  /** 这一块算到的人数。 */
  heads: number
  /** 全场人数。 */
  wholeHeads: number
  chefCount: number
  chefName: string | null
}

export type ShareSlice = {
  key: string
  label: string
  heads: number
  /** 占这周总人数，0–1。 */
  ratio: number
  parties: ShareParty[]
  target: "low" | "ok" | "high" | null
}

export type WeekShare = { slices: ShareSlice[]; totalHeads: number; partyCount: number }

type ShareShift = {
  orderId: string
  date: string
  eventStart: string | null
  customer: string | null
  address: string | null
  counts: { adults: number; kids: number }
  team: Array<{ id: string }>
  orderStatus: string | null
}
type ShareChef = { id: string; name: string; role?: string | null; shifts: ShareShift[] }
type ShareOrder = {
  id: string
  customer_name: string | null
  event_start: string | null
  event_address: string | null
  guest_adult_count: number | null
  guest_child_count: number | null
  order_status: string | null
}

const KID_HEAD = 0.5
const inWeek = (date: string, week: string, weekEnd: string) => date >= week && date <= weekEnd

const targetOf = (name: string, heads: number, weeks: number): ShareSlice["target"] => {
  if (!TARGET_CHEFS.includes(name)) return null
  if (heads < TARGET_MIN * weeks) return "low"
  return heads > TARGET_MAX * weeks ? "high" : "ok"
}

/**
 * week…weekEnd 可以跨两周：有的周排不平，下一周补，得连着看才知道补够没有
 * （老板 2026-10-30）。weeks 是这段时间有几周，目标按周数放大。
 */
export function weekShare(chefs: ShareChef[], orders: ShareOrder[], week: string, weekEnd: string, weeks = 1): WeekShare {
  const byKey = new Map<string, ShareSlice>()
  const sliceOf = (key: string, label: string) => {
    const cur = byKey.get(key)
    if (cur) return cur
    const made: ShareSlice = { key, label, heads: 0, ratio: 0, parties: [], target: null }
    byKey.set(key, made)
    return made
  }
  const seen = new Set<string>()
  for (const c of chefs) {
    if (c.role === "logistics") continue
    const inRotation = ROTATION.includes(c.name)
    for (const s of c.shifts) {
      if (s.orderStatus === "cancelled" || !inWeek(s.date, week, weekEnd)) continue
      const chefCount = Math.max(1, s.team.length)
      const wholeHeads = s.counts.adults + KID_HEAD * s.counts.kids
      const heads = wholeHeads / chefCount
      const slice = inRotation ? sliceOf(c.id, c.name) : sliceOf(OTHER_KEY, "兼职师傅")
      slice.heads += heads
      slice.parties.push({ orderId: s.orderId, date: s.date, eventStart: s.eventStart, customer: s.customer, address: s.address, heads, wholeHeads, chefCount, chefName: c.name })
      seen.add(s.orderId)
    }
  }
  // 还没派师傅的单也在这周的总人数里，不然比例会虚高。
  for (const o of orders) {
    const date = (o.event_start ?? "").slice(0, 10)
    if (!date || o.order_status === "cancelled" || seen.has(o.id) || !inWeek(date, week, weekEnd)) continue
    const heads = (o.guest_adult_count ?? 0) + KID_HEAD * (o.guest_child_count ?? 0)
    const slice = sliceOf(UNASSIGNED_KEY, "未派")
    slice.heads += heads
    slice.parties.push({ orderId: o.id, date, eventStart: o.event_start, customer: o.customer_name, address: o.event_address, heads, wholeHeads: heads, chefCount: 1, chefName: null })
    seen.add(o.id)
  }
  const rank = (s: ShareSlice) => {
    if (s.key === UNASSIGNED_KEY) return ROTATION.length + 1
    if (s.key === OTHER_KEY) return ROTATION.length
    return ROTATION.indexOf(s.label)
  }
  const slices = [...byKey.values()].sort((a, b) => rank(a) - rank(b))
  const totalHeads = slices.reduce((n, s) => n + s.heads, 0)
  for (const s of slices) {
    s.ratio = totalHeads > 0 ? s.heads / totalHeads : 0
    s.target = targetOf(s.label, s.heads, weeks)
    s.parties.sort((a, b) => (a.eventStart ?? a.date).localeCompare(b.eventStart ?? b.date))
  }
  return { slices, totalHeads, partyCount: seen.size }
}
