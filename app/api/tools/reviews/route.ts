import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { resolveAdminActor } from "@/lib/admin-auth"
import { type BoardClaim, type BoardReview, type ChefLite, ptToday, recentWeeks, reviewState, soleMatch, standings, weekRange, weekStart } from "@/lib/review-board"
import { creditReview, creditedByClaim, isSettled, resolveClaims, revokeCredit } from "@/lib/review-claims-server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// 好评榜单（公开页 /tools/reviews，2026-10-02）
//
//   GET  ?week=YYYY-MM-DD | ?range=all   榜单 + 该周的评价清单（谁都能看）
//   GET  ?t=<token>                      再带上"我是谁"，页面才给认领按钮
//   POST ?t=<token>  { action: claim|unclaim, review_id }
//   POST（带工作台登录 cookie，老板）{ action: assign|unassign, review_id, staff_member_id }
//
// 老板 2026-10-02："我需要有权限能够替师傅结算，我知道的我就帮他们直接点了"。
// 他手机上工作台是登录状态，session cookie 的 path 是 /，对 /api/tools/ 一样
// 带得过来 —— 所以不用再发一套权限，resolveAdminActor 认得出他。
// 指派等同工作台的 link_chef：老板说了算，这条之后谁也抢不走。
//
// 老板的原话："因为厨师是没有拿到他的名字的，那这样子这个好评呢就不会归到那个
// 厨师头上，我觉得这样子也不公平"。所以没点名的那些要能被认领。
//
// 认领怎么变成钱：没人抢的自动通过，有人抢的互相亮名字自己谈 —— 规则和实现
// 都在 lib/review-claims-server.ts，工作台那边走同一份。
//
// 两条红线：
//   1. 已结算的一律冻结（谁也抢不动，只能老板撤对账单）。
//   2. 老板手动指的（link_chef）不许被抢。
//
// 页面不收录（layout 里 noindex）。链接是私人的，但谁拿到都能看榜单；
// 认领必须带自己的 token。

const noStore = { "cache-control": "no-store" } as const
const deny = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status, headers: noStore })
const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v)
const WEEKS_BACK = 16

type StaffRow = { id: string; display_name: string | null; full_name: string | null; review_token: string | null; review_aliases: string[] | null }
const nameOf = (s: StaffRow) => String(s.display_name ?? s.full_name ?? "").trim() || "未命名"

/** token -> 师傅。只认在职的。 */
async function whoAmI(supabase: ReturnType<typeof createServerSupabaseClient>, token: string) {
  if (!supabase || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null
  const { data } = await supabase.from("staff_members").select("id, display_name, full_name, review_token, review_aliases, status").eq("review_token", token).maybeSingle()
  const row = data as (StaffRow & { status: string }) | null
  return row && row.status === "active" ? row : null
}

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  if (!supabase) return deny(500, "supabase not configured")
  const sp = request.nextUrl.searchParams
  const token = (sp.get("t") ?? "").trim()
  const all = sp.get("range") === "all"
  const today = ptToday()
  const week = /^\d{4}-\d{2}-\d{2}$/.test(sp.get("week") ?? "") ? weekStart(sp.get("week")!) : weekStart(today)

  const [me, actor, { data: staff }, { data: reviewRows, error }] = await Promise.all([
    token ? whoAmI(supabase, token) : Promise.resolve(null),
    // 老板用工作台的登录态打开这个页面时，多给他一套"替师傅点"的按钮
    resolveAdminActor(request).catch(() => null),
    supabase.from("staff_members").select("id, display_name, full_name, review_aliases").eq("status", "active").order("display_name"),
    supabase
      .from("business_reviews")
      .select("id, platform, reviewer, rating, review_date, body, url, has_photo, staff_member_id, bonus_id")
      .order("review_date", { ascending: false })
      .limit(1000),
  ])
  if (error) return deny(500, error.message)

  const chefs: ChefLite[] = ((staff ?? []) as StaffRow[]).map((s) => ({ id: s.id, name: nameOf(s), aliases: s.review_aliases }))
  const raw = (reviewRows ?? []) as Array<Omit<BoardReview, "settled">>

  // 哪些奖励已经结过了 —— 结过的在榜单上标出来，老板一眼看出还欠多少
  const bonusIds = raw.map((r) => r.bonus_id).filter((v): v is string => !!v)
  const settled = new Set<string>()
  if (bonusIds.length) {
    const { data: bonuses } = await supabase.from("chef_review_bonuses").select("id, settlement_id").in("id", bonusIds)
    for (const b of (bonuses ?? []) as Array<{ id: string; settlement_id: string | null }>) if (b.settlement_id) settled.add(b.id)
  }

  const { data: claimRows } = await supabase.from("review_claims").select("review_id, staff_member_id, state, claimed_at").in("state", ["pending", "approved"])
  const activeClaims = (claimRows ?? []) as BoardClaim[]
  // pending 的才是"还在抢"（没人抢的早就自动入账了）；approved 用来判断
  // 这条到底是不是他认领来的 —— 老板手动指的不该给他"撤回"按钮。
  const claims = activeClaims.filter((c) => c.state === "pending")

  const everything: BoardReview[] = raw.map((r) => ({ ...r, settled: !!r.bonus_id && settled.has(r.bonus_id) }))
  const { start, end } = weekRange(week)
  const inRange = all ? everything : everything.filter((r) => !!r.review_date && r.review_date >= start && r.review_date <= end)

  const { rows, summary } = standings(inRange, claims, chefs)
  // 全时段的奖池也给出去：周榜看手气，总榜看谁一直在拿
  const lifetime = standings(everything, claims, chefs).rows

  // 只给有评价的那些周（加上本周），下拉里不出现空周
  const weeksWithData = new Set(everything.map((r) => (r.review_date ? weekStart(r.review_date) : "")).filter(Boolean))
  weeksWithData.add(weekStart(today))
  const weeks = recentWeeks(WEEKS_BACK, today)
    .filter((w) => weeksWithData.has(w))
    .slice(0, WEEKS_BACK)

  // 我自己认领过的（不管还在抢还是已经归我）—— 只有这些才给"撤回/让给他"
  const mine = me ? new Set(activeClaims.filter((c) => c.staff_member_id === me.id).map((c) => c.review_id)) : new Set<string>()

  return NextResponse.json(
    {
      ok: true,
      today,
      week,
      range: all ? "all" : "week",
      weeks,
      chefs: chefs.map((c) => ({ id: c.id, name: c.name })),
      me: me ? { id: me.id, name: nameOf(me) } : null,
      owner: actor?.role === "owner",
      standings: rows,
      lifetime,
      summary,
      reviews: inRange.map((r) => ({
        id: r.id,
        platform: r.platform,
        reviewer: r.reviewer,
        rating: r.rating,
        date: r.review_date,
        body: r.body,
        url: r.url,
        hasPhoto: r.has_photo,
        state: reviewState(r, claims),
        settled: r.settled,
        creditedTo: r.staff_member_id,
        // 正文点到名的（提示用；真正归类还是老板点）
        namedChef: soleMatch(r.body, chefs),
        claimedBy: claims.filter((c) => c.review_id === r.id).map((c) => c.staff_member_id),
        minedByMe: mine.has(r.id),
      })),
    },
    { headers: noStore },
  )
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  if (!supabase) return deny(500, "supabase not configured")
  const me = await whoAmI(supabase, (request.nextUrl.searchParams.get("t") ?? "").trim())
  const actor = await resolveAdminActor(request).catch(() => null)
  const isOwner = actor?.role === "owner"
  if (!me && !isOwner) return deny(401, "链接无效或已收回——找老板要你的榜单链接")

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return deny(400, "invalid json")
  }
  const action = String(body.action ?? "")
  if (!isUuid(body.review_id)) return deny(400, "review_id required")
  const reviewId = body.review_id

  const { data: rev } = await supabase.from("business_reviews").select("id, staff_member_id, bonus_id").eq("id", reviewId).maybeSingle()
  if (!rev) return deny(404, "这条评价不在了")

  // ---- 老板替师傅点（和工作台 link_chef / unlink_chef 同一套语义）----
  if (action === "assign" || action === "unassign") {
    if (!isOwner) return deny(403, "只有老板能直接指派")
    if (await isSettled(supabase, rev.bonus_id)) return deny(409, "这条已经结算过了，先撤那张对账单")
    const alias = actor?.alias ?? "owner"
    const now = new Date().toISOString()

    if (action === "unassign") {
      if (!rev.bonus_id) return NextResponse.json({ ok: true, state: "open" }, { headers: noStore })
      if (!(await revokeCredit(supabase, reviewId))) return deny(409, "这条已经结算过了，先撤那张对账单")
      // 只否掉被取消的那一个人，别人该认领还能认领（和工作台一致）
      if (rev.staff_member_id) {
        await supabase
          .from("review_claims")
          .update({ state: "rejected", decided_at: now, decided_by: alias, note: "老板取消了归属" })
          .eq("review_id", reviewId)
          .eq("staff_member_id", rev.staff_member_id)
          .in("state", ["pending", "approved"])
      }
      const state = await resolveClaims(supabase, reviewId, alias)
      return NextResponse.json({ ok: true, state }, { headers: noStore })
    }

    if (!isUuid(body.staff_member_id)) return deny(400, "staff_member_id required")
    const target = body.staff_member_id
    if (rev.staff_member_id === target) return NextResponse.json({ ok: true, state: "credited" }, { headers: noStore })
    // 改派：先把现在那个人的退回来
    if (rev.bonus_id && !(await revokeCredit(supabase, reviewId))) return deny(409, "这条已经结算过了，先撤那张对账单")
    const done = await creditReview(supabase, reviewId, target, alias)
    if (!done) return deny(409, "刚被占上了，刷新看看")
    // 老板定了，这条上挂着的认领全部作废（谁也别再抢）
    await supabase
      .from("review_claims")
      .update({ state: "rejected", decided_at: now, decided_by: alias, note: "老板直接指定了" })
      .eq("review_id", reviewId)
      .in("state", ["pending", "approved"])
    return NextResponse.json({ ok: true, state: "credited", cents: done.cents }, { headers: noStore })
  }

  if (!me) return deny(401, "链接无效或已收回——找老板要你的榜单链接")

  if (action === "claim") {
    if (await isSettled(supabase, rev.bonus_id)) return deny(409, "这条已经结算过了，找老板")
    // 已经有归属的，只有"归属是别人认领来的、而且还没结算"才允许挑战；
    // 老板手动指的不许抢。
    if (rev.bonus_id && !(await creditedByClaim(supabase, reviewId, rev.staff_member_id))) return deny(409, "这条老板已经定了")
    if (rev.staff_member_id === me.id) return NextResponse.json({ ok: true, state: "credited" }, { headers: noStore })
    // 老板驳回过的不许自己再认领回来 —— 他说了算
    const { data: prior } = await supabase.from("review_claims").select("state").eq("review_id", reviewId).eq("staff_member_id", me.id).maybeSingle()
    if ((prior as { state: string } | null)?.state === "rejected") return deny(409, "这条老板已经判过了，找他")

    const { error } = await supabase.from("review_claims").upsert(
      { review_id: reviewId, staff_member_id: me.id, state: "pending", source: "self", claimed_at: new Date().toISOString(), decided_at: null, decided_by: null, note: null },
      { onConflict: "review_id,staff_member_id" },
    )
    if (error) return deny(500, error.message)
    const state = await resolveClaims(supabase, reviewId, `chef:${me.id.slice(0, 8)}`)
    return NextResponse.json({ ok: true, state }, { headers: noStore })
  }

  if (action === "unclaim") {
    // 放弃自己的认领。结过账的拿不回来也放不掉。
    if (await isSettled(supabase, rev.bonus_id)) return deny(409, "这条已经结算过了，找老板")
    const { error } = await supabase
      .from("review_claims")
      .update({ state: "withdrawn", decided_at: new Date().toISOString(), decided_by: `chef:${me.id.slice(0, 8)}`, note: "自己放弃" })
      .eq("review_id", reviewId)
      .eq("staff_member_id", me.id)
      .in("state", ["pending", "approved"])
    if (error) return deny(500, error.message)
    // 放弃之后如果只剩一个人了，那个人自动拿到
    const state = await resolveClaims(supabase, reviewId, `chef:${me.id.slice(0, 8)}`)
    return NextResponse.json({ ok: true, state }, { headers: noStore })
  }

  return deny(400, "unknown action")
}
