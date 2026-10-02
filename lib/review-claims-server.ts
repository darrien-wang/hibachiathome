// 认领怎么变成钱（老板 2026-10-02 定的规则）。公开页 /api/tools/reviews 和
// 工作台 /api/admin/reviews 共用这一份，两边不会各算各的。
//
// 规则（老板原话）：
//   "没人抢的认领自动通过；如果有人抢的，互相展示出来是谁在抢，让他们自己沟通，
//    有一方放弃就自动通过，否则就无法结算。"
//
// 翻成机器能执行的：
//   · 活跃认领 = 1 人  -> 直接记到他头上（不等老板）
//   · 活跃认领 ≥ 2 人  -> 谁都不记，之前记上的要退回来；双方名字在榜单上互相亮着
//   · 活跃认领 = 0 人  -> 退回"待认领"
//
// "否则就无法结算"是自然成立的：抢的期间这条压根没有 chef_review_bonuses 行，
// 结算只扫那张表，所以扫不到 —— 不需要额外在结算那边加判断。
//
// 两条不许碰：
//   · 已经结算过的（bonus.settlement_id 有值）一律冻结，谁也抢不动，只能老板撤对账单。
//   · 老板手动指的（link_chef，没有 approved 认领行）不许被抢 —— 他定了就是定了。

import { REVIEW_PHOTO_CENTS, REVIEW_PLAIN_CENTS } from "./chef-pay"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SB = any

export type ResolveResult = "credited" | "contested" | "open" | "frozen"

const ptToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" })
const ACTIVE = ["pending", "approved"]

type RevRow = { id: string; platform: string; reviewer: string | null; review_date: string | null; body: string | null; url: string | null; has_photo: boolean; bonus_id: string | null; staff_member_id: string | null }

/**
 * 当前归属是不是"认领来的"（而不是老板手动指的）。
 *
 * 要按**当前归属的那个人**查，不能只看这条评价上有没有 approved 行：
 * 他自己放弃之后那行会变成 withdrawn，只认 approved 的话就会把他误判成
 * "老板手动指的"而受保护，钱退不回来（09-02 实测踩到过）。
 */
export async function creditedByClaim(supabase: SB, reviewId: string, staffId: string | null): Promise<boolean> {
  if (!staffId) return false
  const { data } = await supabase.from("review_claims").select("id").eq("review_id", reviewId).eq("staff_member_id", staffId).in("state", ["approved", "withdrawn"]).limit(1)
  return !!data?.length
}

/** 这条的奖励结算过了没有。结过的一律冻结。 */
export async function isSettled(supabase: SB, bonusId: string | null): Promise<boolean> {
  if (!bonusId) return false
  const { data } = await supabase.from("chef_review_bonuses").select("settlement_id").eq("id", bonusId).maybeSingle()
  return !!(data as { settlement_id: string | null } | null)?.settlement_id
}

/** 记到某师傅头上：生成奖励行 + 在评价上占位。返回 null = 没占上（已经被记过）。 */
export async function creditReview(supabase: SB, reviewId: string, staffId: string, alias: string): Promise<{ bonusId: string; cents: number } | null> {
  const { data } = await supabase.from("business_reviews").select("id, platform, reviewer, review_date, body, url, has_photo, bonus_id, staff_member_id").eq("id", reviewId).maybeSingle()
  const rev = data as RevRow | null
  if (!rev) throw new Error("not found")
  if (rev.bonus_id) return null
  const cents = rev.has_photo ? REVIEW_PHOTO_CENTS : REVIEW_PLAIN_CENTS
  const { data: bonus, error } = await supabase
    .from("chef_review_bonuses")
    .insert({
      staff_member_id: staffId,
      platform: rev.platform,
      review_date: rev.review_date ?? ptToday(),
      reviewer: rev.reviewer,
      has_photo: rev.has_photo,
      excerpt: (rev.body ?? "").slice(0, 200) || null,
      url: rev.url,
      review_id: rev.id,
      cents,
      created_by: alias,
    })
    .select("id")
    .single()
  if (error) throw error
  // 条件占位：两个人同时点只有一个占得上，没占上的那笔 bonus 回滚。
  const { data: took } = await supabase.from("business_reviews").update({ bonus_id: bonus.id, staff_member_id: staffId }).eq("id", rev.id).is("bonus_id", null).select("id")
  if (!took?.length) {
    await supabase.from("chef_review_bonuses").delete().eq("id", bonus.id)
    return null
  }
  return { bonusId: bonus.id, cents }
}

/** 把归属退回来（奖励行删掉）。已结算的不动，返回 false。 */
export async function revokeCredit(supabase: SB, reviewId: string): Promise<boolean> {
  const { data } = await supabase.from("business_reviews").select("id, bonus_id").eq("id", reviewId).maybeSingle()
  const rev = data as { id: string; bonus_id: string | null } | null
  if (!rev?.bonus_id) return true
  if (await isSettled(supabase, rev.bonus_id)) return false
  await supabase.from("chef_review_bonuses").delete().eq("id", rev.bonus_id)
  await supabase.from("business_reviews").update({ bonus_id: null, staff_member_id: null }).eq("id", reviewId)
  return true
}

/**
 * 认领发生变化后重算这一条的归属。claim / unclaim / 老板驳回 之后都要调一次。
 * 幂等：重复调结果一样。
 */
export async function resolveClaims(supabase: SB, reviewId: string, alias: string): Promise<ResolveResult> {
  const { data: r } = await supabase.from("business_reviews").select("id, bonus_id, staff_member_id").eq("id", reviewId).maybeSingle()
  const rev = r as { id: string; bonus_id: string | null; staff_member_id: string | null } | null
  if (!rev) return "open"
  if (await isSettled(supabase, rev.bonus_id)) return "frozen"

  const { data: rows } = await supabase.from("review_claims").select("id, staff_member_id, state").eq("review_id", reviewId).in("state", ACTIVE)
  const active = (rows ?? []) as Array<{ id: string; staff_member_id: string; state: string }>
  const fromClaim = await creditedByClaim(supabase, reviewId, rev.staff_member_id)
  const now = new Date().toISOString()

  // 老板手动指的（有归属但没有 approved 认领行）：不归认领管，原样留着。
  if (rev.bonus_id && !fromClaim) return "credited"

  if (active.length === 1) {
    const winner = active[0]
    if (rev.staff_member_id === winner.staff_member_id) {
      if (winner.state !== "approved") await supabase.from("review_claims").update({ state: "approved", decided_at: now, decided_by: alias, note: "没人抢，自动通过" }).eq("id", winner.id)
      return "credited"
    }
    if (rev.bonus_id && !(await revokeCredit(supabase, reviewId))) return "frozen"
    const done = await creditReview(supabase, reviewId, winner.staff_member_id, alias)
    if (!done) return "credited" // 并发下别人刚占上，下一次 resolve 会收敛
    await supabase.from("review_claims").update({ state: "approved", decided_at: now, decided_by: alias, note: "没人抢，自动通过" }).eq("id", winner.id)
    return "credited"
  }

  if (active.length >= 2) {
    // 有人抢：谁都不给。之前自动通过的那个要退回来，大家一起回到 pending。
    if (rev.bonus_id && !(await revokeCredit(supabase, reviewId))) return "frozen"
    await supabase.from("review_claims").update({ state: "pending", decided_at: null, decided_by: null, note: null }).eq("review_id", reviewId).eq("state", "approved")
    return "contested"
  }

  // 一个认领都不剩了（都放弃了）：退回待认领。
  if (rev.bonus_id && !(await revokeCredit(supabase, reviewId))) return "frozen"
  return "open"
}
