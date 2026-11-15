// 份额页拖单（老板 2026-11-14）：把一单从一位师傅拖给另一位，用来调每周的人数份额。
// 这里是纯函数：拖下去之前先算能不能放、会顶掉谁、有什么要提醒的。写库在页面里走
// /api/admin/chefs assign（quiet，先不通知），最后统一点"通知改动"。
//
// 接不接得上和日历地图同一个算法（lib/dispatch.ts chainLinks）：占用 90–120 分、
// 车程、提前 10 分到、迟到顺着链往下传；两台有一台带桌椅多留 30 分。
// 拖满的话迟到超过"极限"（设置里 late_limit，默认 60 分）就算接不上。

import { chainLinks, TABLES_EXTRA_MINUTES, type DispatchParams } from "@/lib/dispatch"

export type BoardStop = {
  id: string
  name: string
  address: string
  time: string
  startMin: number
  /** 折算人数（小孩 0.5）。 */
  guests: number
  tables: boolean
  plan: { chefs: number }
  difficulty: { score: number } | null
  requestedChefId?: string | null
  chefIds: string[]
  helperIds?: string[]
  /** 排班上悄悄改过、还欠的通知（day-map 接口现算）。 */
  pending?: { add: string[]; remove: string[] }
}

export type BoardParams = { busyMin: number; busyMax: number; arriveEarly: number; lateOk: number; lateLimit: number }

export type BoardDay = {
  date: string
  stops: BoardStop[]
  /** drive[i][j]：第 i 场开到第 j 场几分钟，按 stops 的顺序；定位不到是 null。 */
  drive: Array<Array<number | null>>
  params: BoardParams
}

/** from / to 是师傅 id；null = 未派那一行。 */
export type Move = { orderId: string; from: string | null; to: string | null }

export type MoveCheck = {
  /** 放不了的原因；null = 能放。 */
  block: string | null
  /** 目标师傅当天接不上、得让出来的单（按开场时间）。 */
  clashes: string[]
  /** 让出 clashes 之后，目标师傅那天拖满最晚迟到几分钟（负数 = 早到）；一台都没有接是 null。 */
  worstLate: number | null
  warnings: string[]
  /** 冲突的单能不能换给原来那位（拖出来的那位师傅），不能的话为什么。 */
  swap: { ok: boolean; reason: string | null } | null
}

/** 新手（老板派单规则 D-1030-04）：难度 3 分以上派给他们要提醒。 */
export const NOVICE_NAMES = ["John", "Eason", "易非"]
const SAN_DIEGO = /san diego|chula vista|oceanside|carlsbad|escondido|la jolla|el cajon|santee|poway|vista,|encinitas|\b9(19|20|21)\d\d\b/i

const paramsOf = (p: BoardParams): DispatchParams => ({ busyMinMinutes: p.busyMin, busyMaxMinutes: p.busyMax, arriveEarlyMinutes: p.arriveEarly })

/** 这些单让一个人按开场先后跑：每段衔接拖满迟到多少，最坏的一段，有没有车程不知道的。 */
export function chainOf(day: BoardDay, orderIds: string[]) {
  const idx = orderIds.map((id) => day.stops.findIndex((s) => s.id === id)).filter((i) => i >= 0)
  idx.sort((a, b) => day.stops[a].startMin - day.stops[b].startMin || a - b)
  const starts = day.stops.map((s) => s.startMin)
  const extra = (a: number, b: number) => (day.stops[a].tables || day.stops[b].tables ? TABLES_EXTRA_MINUTES : 0)
  const links = chainLinks(idx, starts, day.drive, paramsOf(day.params), day.params.lateOk, extra)
  const unknownDrive = links.some((l) => day.drive[l.from]?.[l.to] == null)
  const worst = links.length ? Math.max(...links.map((l) => l.worstLate)) : null
  return {
    links: links.map((l) => ({ fromId: day.stops[l.from].id, toId: day.stops[l.to].id, worstLate: l.worstLate })),
    worst,
    unknownDrive,
  }
}

/** 这位师傅这天手上的单（只算师傅，不算帮手）。 */
export const ordersOf = (day: BoardDay, chefId: string) => day.stops.filter((s) => s.chefIds.includes(chefId)).map((s) => s.id)

/**
 * 加进 add 之后，keep 里得让出哪几单这位师傅才接得上。每次拿掉卡住的那一段里不是 add 的那一单，
 * 直到整条链拖满迟到都不超过极限。add 自己永远不拿掉。
 */
export function clashesFor(day: BoardDay, keep: string[], add: string[]): string[] {
  const out: string[] = []
  let rest = keep.filter((id) => !add.includes(id))
  for (let guard = 0; guard < 20; guard++) {
    const c = chainOf(day, [...rest, ...add])
    const bad = c.links.find((l) => l.worstLate > day.params.lateLimit)
    if (!bad) break
    const victim = add.includes(bad.fromId) ? bad.toId : bad.fromId
    if (add.includes(victim)) break
    out.push(victim)
    rest = rest.filter((id) => id !== victim)
  }
  const byStart = (id: string) => day.stops.find((s) => s.id === id)?.startMin ?? 0
  return out.sort((a, b) => byStart(a) - byStart(b))
}

export function checkMove(day: BoardDay, m: Move, ctx: { nameOf: (id: string) => string; activeIds: Set<string>; started: (s: BoardStop) => boolean; today: string }): MoveCheck {
  const none: MoveCheck = { block: null, clashes: [], worstLate: null, warnings: [], swap: null }
  const stop = day.stops.find((s) => s.id === m.orderId)
  if (!stop) return { ...none, block: "这一天找不到这单" }
  if (m.from === m.to) return { ...none, block: "没有变" }
  if (m.from === null && m.to === null) return { ...none, block: "没有变" }
  if (ctx.started(stop)) return { ...none, block: "派对已经开始或者做完了，不能再换人" }
  if (m.from !== null && !stop.chefIds.includes(m.from)) return { ...none, block: `${ctx.nameOf(m.from)} 已经不在这单上了，刷新一下` }
  if (m.to !== null && stop.chefIds.includes(m.to)) return { ...none, block: `${ctx.nameOf(m.to)} 已经在这单上了` }
  if (m.to !== null && !ctx.activeIds.has(m.to)) return { ...none, block: `${ctx.nameOf(m.to)} 现在不在可派名单里` }
  if (m.from === null && stop.chefIds.length >= Math.max(1, stop.plan.chefs)) return { ...none, block: "这单师傅已经派够了" }

  const warnings: string[] = []
  let clashes: string[] = []
  let worstLate: number | null = null
  let swap: MoveCheck["swap"] = null

  if (m.to !== null) {
    const toName = ctx.nameOf(m.to)
    clashes = clashesFor(day, ordersOf(day, m.to), [m.orderId])
    const after = chainOf(day, [...ordersOf(day, m.to).filter((id) => !clashes.includes(id)), m.orderId])
    worstLate = after.worst
    if (after.unknownDrive) warnings.push("有一场地址没定位到，那段车程按 0 分钟算，实际可能更紧")
    if (worstLate !== null && worstLate > day.params.lateOk) warnings.push(`${toName} 这天拖满的话会迟到 ${worstLate} 分（超过 ${day.params.lateOk} 分，按规矩要给客人补偿）`)
    else if (worstLate !== null && worstLate > 0) warnings.push(`${toName} 这天拖满的话会迟到 ${worstLate} 分`)

    if (NOVICE_NAMES.includes(toName) && (stop.difficulty?.score ?? 0) >= 3) warnings.push(`难 ${stop.difficulty!.score} 的场派给新手 ${toName}`)
    if (toName === "John" && SAN_DIEGO.test(stop.address)) warnings.push("John 不去圣地亚哥")
    if (toName === "Eason" && stop.guests > 15) warnings.push(`Eason 只接 15 人以下（这场 ${stop.guests} 人）`)
    if (toName === "易非") warnings.push("易非只当帮手")
    if ((stop.helperIds ?? []).includes(m.to)) warnings.push(`${toName} 原来是这单的帮手，会改成师傅`)

    // 冲突的单换给拖出来的那位：他少了这单，再接这几单接不接得上。
    if (clashes.length) {
      if (m.from === null) swap = { ok: false, reason: "从未派拖过来的，没有人可以换" }
      else {
        const fromKeep = ordersOf(day, m.from).filter((id) => id !== m.orderId)
        const already = clashes.filter((id) => day.stops.find((s) => s.id === id)?.chefIds.includes(m.from!))
        if (already.length) swap = { ok: false, reason: `${ctx.nameOf(m.from)} 已经在那单上了` }
        else {
          const back = clashesFor(day, fromKeep, clashes)
          swap = back.length ? { ok: false, reason: `换过去 ${ctx.nameOf(m.from)} 也接不上` } : { ok: true, reason: null }
        }
      }
    }
  }

  if (m.from !== null && stop.requestedChefId && stop.requestedChefId === m.from) warnings.push(`客人点名要 ${ctx.nameOf(m.from)}`)
  if (m.to === null) {
    const left = stop.chefIds.length - 1
    const need = Math.max(1, stop.plan.chefs)
    warnings.push(left <= 0 ? "拿掉后这单没有师傅了" : `这单要 ${need} 位师傅，拿掉后剩 ${left} 位`)
  }
  if (day.date === ctx.today) warnings.push("今天的单，原来的师傅可能已经在备料了")
  return { block: null, clashes, worstLate, warnings, swap }
}

/**
 * 真要写进订单的名单：被拖的那单 from 换成 to；冲突的单按选择换给 from（swap）或者拿掉 to（unassign）。
 * 返回每单的新师傅名单（不含帮手）。
 */
export function teamsAfter(day: BoardDay, m: Move, clashes: string[], resolve: "swap" | "unassign"): Array<{ orderId: string; team: string[] }> {
  const teamOf = (id: string) => day.stops.find((s) => s.id === id)?.chefIds ?? []
  const out: Array<{ orderId: string; team: string[] }> = []
  const main = teamOf(m.orderId).filter((id) => id !== m.from)
  if (m.to !== null) main.push(m.to)
  out.push({ orderId: m.orderId, team: main })
  for (const cid of clashes) {
    const t = teamOf(cid).filter((id) => id !== m.to)
    if (resolve === "swap" && m.from !== null && !t.includes(m.from)) t.push(m.from)
    out.push({ orderId: cid, team: t })
  }
  return out
}

/** 每位师傅这周的折算人数（多位师傅同场平分），和份额饼图同一个口径。 */
export function weekHeads(days: BoardDay[]): Map<string, { heads: number; parties: number }> {
  const out = new Map<string, { heads: number; parties: number }>()
  for (const d of days) {
    for (const s of d.stops) {
      const n = Math.max(1, s.chefIds.length)
      for (const id of s.chefIds) {
        const cur = out.get(id) ?? { heads: 0, parties: 0 }
        cur.heads += s.guests / n
        cur.parties += 1
        out.set(id, cur)
      }
    }
  }
  return out
}
