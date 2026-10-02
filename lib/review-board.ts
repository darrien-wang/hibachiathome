// 好评榜单（2026-10-02）——公开页和工作台共用的纯函数，没有服务端依赖。
//
// 为什么有这个文件：API 直接按名字统计是不公平的。评价里提到师傅名字的只是
// 少数，剩下的师傅一样干了活，却一分钱都算不到头上。所以分两条路：
//   · 正文里点了名的  -> 按名字自动归类（matchChefs）
//   · 没点名的        -> 师傅自己认领，老板一键确认（review_claims）
//
// 钱的口径不变：无图 $2 / 带图 $3，一条评价永远只算一次（库层 bonus_id 防重）。
// 认领只是"候选"，approve 之后才生成 chef_review_bonuses——榜单上分两个数显示。

import { REVIEW_PHOTO_CENTS, REVIEW_PLAIN_CENTS } from "./chef-pay"

export const PT_TZ = "America/Los_Angeles"

/** 太平洋时间的今天，YYYY-MM-DD。 */
export const ptToday = (now: Date = new Date()) => now.toLocaleDateString("en-CA", { timeZone: PT_TZ })

/**
 * 这一天所在那一周的周日，YYYY-MM-DD。
 * 周日起算 —— 和转化率口径（09-13 那个周日重置）保持一致，别出现两套"本周"。
 */
export function weekStart(dateISO: string): string {
  const t = Date.parse(`${dateISO}T00:00:00Z`)
  if (!Number.isFinite(t)) return dateISO
  const dow = new Date(t).getUTCDay() // 0 = 周日
  return new Date(t - dow * 86400000).toISOString().slice(0, 10)
}

export const addDays = (dateISO: string, n: number) => new Date(Date.parse(`${dateISO}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)

/** 一周的闭区间 [start, end]，两头都含。 */
export function weekRange(weekStartISO: string): { start: string; end: string } {
  return { start: weekStartISO, end: addDays(weekStartISO, 6) }
}

/** 9/28 – 10/4 这种给人看的写法。 */
export function weekLabel(weekStartISO: string): string {
  const { start, end } = weekRange(weekStartISO)
  const short = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`
  return `${short(start)} – ${short(end)}`
}

/** 从最近的一周往回数 n 周，用来做周切换的下拉。 */
export function recentWeeks(n: number, today = ptToday()): string[] {
  const cur = weekStart(today)
  return Array.from({ length: Math.max(1, n) }, (_, i) => addDays(cur, -7 * i))
}

export const reviewCents = (hasPhoto: boolean) => (hasPhoto ? REVIEW_PHOTO_CENTS : REVIEW_PLAIN_CENTS)

// ---------------------------------------------------------------------------
// 名字匹配

export type ChefLite = { id: string; name: string; aliases?: string[] | null }

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * 正文里点到名的师傅（可能不止一个）。整词匹配，大小写不敏感。
 *
 * 别名很重要：客人写 "Mr. Blue" 指的就是 Blu，光比对 display_name 会漏。
 * 别名在 staff_members.review_aliases 里，老板可以自己加。
 */
export function matchChefs(body: string | null | undefined, chefs: ChefLite[]): string[] {
  const text = (body ?? "").trim()
  if (!text) return []
  const hit: string[] = []
  for (const c of chefs) {
    const needles = [c.name, ...(c.aliases ?? [])].map((s) => String(s ?? "").trim()).filter((s) => s.length >= 2)
    // 别名里带点和空格（"Mr. Blue"）时 \b 在结尾照样成立，开头用 (^|[^\p{L}]) 兜住
    const found = needles.some((n) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(n)}(?![\\p{L}\\p{N}])`, "iu").test(text))
    if (found) hit.push(c.id)
  }
  return hit
}

/** 只有正好一个师傅被点到，才敢说"这条就是他的"。两个人都被提到就得人来判。 */
export function soleMatch(body: string | null | undefined, chefs: ChefLite[]): string | null {
  const hit = matchChefs(body, chefs)
  return hit.length === 1 ? hit[0] : null
}

// ---------------------------------------------------------------------------
// 榜单聚合

export type BoardReview = {
  id: string
  platform: string
  reviewer: string | null
  rating: number | null
  review_date: string | null
  body: string | null
  url: string | null
  has_photo: boolean
  /** 已入账的归属（= chef_review_bonuses 已生成） */
  staff_member_id: string | null
  bonus_id: string | null
  /** 这条评价的奖励结没结（null = 没入账或没结） */
  settled: boolean
}

export type BoardClaim = { review_id: string; staff_member_id: string; state: "pending" | "approved" | "rejected"; claimed_at: string }

export type ChefStanding = {
  id: string
  name: string
  /** 已入账的条数 / 钱（真金白银，和结算账本对得上） */
  creditedCount: number
  creditedCents: number
  /** 已入账里还没结算的钱 —— 老板现在欠他的 */
  unsettledCents: number
  /**
   * 还在抢的条数 / 钱。**不计入奖池** —— 老板定的规则是有人抢就谁都不给，
   * 算进去等于两个人都显示拿到了，是假的。
   */
  contestedCount: number
  contestedCents: number
  /** 奖池 = 已入账。没人抢的认领已经自动变成已入账了，不用再加一层。 */
  poolCents: number
}

export type BoardSummary = {
  total: number
  credited: number
  /** 还没归到任何人头上、也没人认领的 —— 这就是"需要认领"那一桶 */
  openCount: number
  openCents: number
  /** 两个人以上在抢的 —— 这些结不了算，要他们自己谈 */
  contestedCount: number
  contestedCents: number
}

/**
 * 这条评价现在是什么状态。
 *   credited  已经归到某人头上（没人抢的会自动走到这里）
 *   contested 两个人以上都说是自己的 —— 谁都不给，也结不了算
 *   pending   只有一个人认领但还没落下来（正常只是一瞬间，重算一次就收敛）
 *   open      没人要
 */
export function reviewState(r: BoardReview, claims: BoardClaim[]): "credited" | "contested" | "pending" | "open" {
  if (r.staff_member_id) return "credited"
  const n = claims.filter((c) => c.review_id === r.id && c.state === "pending").length
  return n >= 2 ? "contested" : n === 1 ? "pending" : "open"
}

/**
 * 给定一批评价 + 认领记录，算出每个师傅的站位和整体概况。
 * reviews 要先按时间范围筛好 —— 这个函数不管周口径。
 */
export function standings(reviews: BoardReview[], claims: BoardClaim[], chefs: ChefLite[]): { rows: ChefStanding[]; summary: BoardSummary } {
  const byId = new Map<string, ChefStanding>(
    chefs.map((c) => [c.id, { id: c.id, name: c.name, creditedCount: 0, creditedCents: 0, unsettledCents: 0, contestedCount: 0, contestedCents: 0, poolCents: 0 }]),
  )
  const reviewIds = new Set(reviews.map((r) => r.id))
  const pendingByReview = new Map<string, BoardClaim[]>()
  for (const c of claims) {
    if (c.state !== "pending" || !reviewIds.has(c.review_id)) continue
    const list = pendingByReview.get(c.review_id)
    if (list) list.push(c)
    else pendingByReview.set(c.review_id, [c])
  }

  let credited = 0
  let openCount = 0
  let openCents = 0
  let contestedCount = 0
  let contestedCents = 0

  for (const r of reviews) {
    const cents = reviewCents(r.has_photo)
    if (r.staff_member_id) {
      credited += 1
      const row = byId.get(r.staff_member_id)
      if (row) {
        row.creditedCount += 1
        row.creditedCents += cents
        if (!r.settled) row.unsettledCents += cents
      }
      continue
    }
    const pend = pendingByReview.get(r.id) ?? []
    if (!pend.length) {
      openCount += 1
      openCents += cents
      continue
    }
    // 还挂着 pending 的只剩"有人抢"这一种（没人抢的已经自动入账了）。
    // 两边都记一笔"抢中"，但都不进奖池 —— 谁都还没拿到。
    contestedCount += 1
    contestedCents += cents
    for (const c of pend) {
      const row = byId.get(c.staff_member_id)
      if (!row) continue
      row.contestedCount += 1
      row.contestedCents += cents
    }
  }

  const rows = [...byId.values()]
  for (const r of rows) r.poolCents = r.creditedCents
  // 奖池高的在前；并列时条数多的在前，再按名字稳定排序
  rows.sort((a, b) => b.poolCents - a.poolCents || b.creditedCount - a.creditedCount || a.name.localeCompare(b.name))

  return { rows, summary: { total: reviews.length, credited, openCount, openCents, contestedCount, contestedCents } }
}

export const dollars = (cents: number) => `$${(Math.round(cents) / 100).toFixed(2).replace(/\.00$/, "")}`
