import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { resolveAdminActor } from "@/lib/admin-auth"
import { REVIEW_PLAIN_CENTS, REVIEW_PHOTO_CENTS } from "@/lib/chef-pay"
import { type ChefLite, soleMatch } from "@/lib/review-board"
import { creditReview, resolveClaims, setPhoto } from "@/lib/review-claims-server"
import { cleanPhotoUrls } from "@/lib/review-photos"
import { createHash, randomBytes } from "node:crypto"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// 好评模块（2026-09-28）：Google/Yelp 评价的历史主档 + 记给师傅的入口。
//   GET                 -> { reviews, staff, bonuses }（工作台"好评"页签整页数据）
//   POST { action }:
//     refresh      任何成员：拉平台最新评价入库（有 API key 才拉得动，见下）
//     import       老板/agent：整批导入（agent 用浏览器拉下来的整页评价走这里）
//     link_chef    老板：这条评价记给某师傅 -> 生成 chef_review_bonuses（月结）
//     unlink_chef  老板：取消关联（奖励没结算才行）
//     set_photo    老板：改带图标记（记过奖励的不许改——金额录入时已冻结）
//     delete_row   老板：删一条没关联奖励的原始记录
//     approve_claim / reject_claim   老板：处理师傅在 /tools/reviews 上的认领
//     auto_name    老板：正文点到名的一批自动归类（只归"只提到一个人"的）
//     issue_link / revoke_link       老板：发/收回师傅的榜单链接
//     set_aliases  老板：改师傅的名字别名（"Mr. Blue" -> Blu）
// 防重是硬规矩：(platform, external_key) 唯一 => 同一条评价只存一行；
// 一行最多挂一个 bonus_id => 同一条评价只算一次钱。
//
// 平台侧现实（2026-09-28 实测）：
// - Google 走 Places API (New)（GOOGLE_PLACES_API_KEY，real-hibachi 项目，
//   key 限定 Places 两个 API）：一次给"最相关"5 条（非最新），但带精确
//   publishTime 和每条的 googleMapsUri。旧版 API 对这个 Place ID 报
//   NOT_FOUND（id 过期），别再试。
// - Yelp Fusion /reviews 一次只给 3 条节选，需要 YELP_API_KEY（免费申请）。
// - API 只是增量哨兵：全量仍靠 agent 打开页面拉取走 import。
// - API 行和 agent 行的 external_key 体系不同，靠 fuzzyFilter 按
//   评价人+正文前缀（或 ±3 天）合并，否则同一条会两行。

const GOOGLE_PLACE_ID = "ChIJkxNMr8pbkkARqHR_D2YBK6E"
const GOOGLE_ALL_REVIEWS_URL = `https://search.google.com/local/reviews?placeid=${GOOGLE_PLACE_ID}`
const YELP_BIZ_ID = "nWEciUJTjQ40_5ZBzy80mA"
const YELP_ALL_REVIEWS_URL = "https://www.yelp.com/biz/nWEciUJTjQ40_5ZBzy80mA"
const BOARD_BASE = "https://www.realhibachi.com/tools/reviews"

type Body = Record<string, unknown> & { action?: string }
const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v)
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const dateOrNull = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
const ptToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" })
const hash10 = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 10)
const PLATFORMS = new Set(["google", "yelp", "other"])
const OWNER_ACTIONS = new Set(["import", "link_chef", "unlink_chef", "set_photo", "delete_row", "approve_claim", "reject_claim", "auto_name", "issue_link", "revoke_link", "set_aliases"])

type ReviewInsert = {
  platform: string
  external_key: string
  reviewer: string | null
  rating: number | null
  review_date: string | null
  body: string | null
  url: string | null
  has_photo: boolean
  photo_count: number
  /** 页面上看到的照片地址（agent 导入才有；平台 API 不给）。 */
  photo_urls: string[]
  raw: unknown
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any

// 跨 id 体系防重：agent 导入用 Maps DOM 的 data-review-id，API 刷新用
// 自己的 review id——同一条评价两种 key。exact key 交给 upsertRows；这里
// 把"key 不同但明显是同一条"的丢掉：同平台同评价人 + 正文前 25 字相同
//（Google 一个账号只能评一次，重名双评是不同账号、正文必不同），没正文
// 的按 评价人+日期±3 天。不做跨 key 回填，宁可少动已有行。
async function fuzzyFilter(supabase: SB, rows: ReviewInsert[]) {
  const photoPatches: PhotoPatch[] = []
  if (!rows.length) return { keep: rows, merged: 0, photoPatches }
  const { data: existing } = await supabase.from("business_reviews").select("id, platform, external_key, reviewer, review_date, body, has_photo, photo_count").limit(1000)
  const all = (existing ?? []) as Array<ExistingReview & { platform: string; external_key: string; reviewer: string | null; review_date: string | null; body: string | null }>
  const exact = new Set(all.map((e) => `${e.platform}|${e.external_key}`))
  const norm = (v: string | null | undefined) => (v ?? "").toLowerCase().replace(/\s+/g, " ").trim()
  const sigOf = (platform: string, reviewer: string | null, body: string | null) => `${platform}|${norm(reviewer)}|${norm(body).slice(0, 25)}`
  const sigs = new Map(all.filter((e) => e.body).map((e) => [sigOf(e.platform, e.reviewer, e.body), e]))
  const near = (a: string | null, b: string | null) => !!a && !!b && Math.abs(Date.parse(a) - Date.parse(b)) <= 3 * 86400000
  const keep: ReviewInsert[] = []
  let merged = 0
  for (const r of rows) {
    if (exact.has(`${r.platform}|${r.external_key}`)) {
      keep.push(r) // 同 key：upsertRows 负责 bump/enrich
      continue
    }
    const dupBody = r.body ? sigs.get(sigOf(r.platform, r.reviewer, r.body)) : undefined
    const dupBare = !r.body ? all.find((e) => e.platform === r.platform && norm(e.reviewer) === norm(r.reviewer) && norm(r.reviewer) !== "" && near(e.review_date, r.review_date)) : undefined
    const same = dupBody ?? dupBare
    if (same) {
      merged += 1
      // 同一条换了个 key 进来（API 行 vs 页面行）：别的字段不动，照片补到原来那行上
      if (r.photo_urls.length) photoPatches.push({ existing: same, photos: r.photo_urls })
      continue
    }
    keep.push(r)
  }
  return { keep, merged, photoPatches }
}

type ExistingReview = { id: string; has_photo: boolean; photo_count: number | null }
type PhotoPatch = { existing: ExistingReview; photos: string[] }

/**
 * 把照片地址挂到已有的评价上。没图 -> 有图会改钱（$2 -> $3），所以这一步走
 * setPhoto：已入账没结算的奖励跟着改；已结算的钱不动（setPhoto 会拒），照片照样存。
 * 导入只会把"没图"升成"有图"，不会反过来把老板手动标的带图冲掉。
 */
async function attachPhotos(supabase: SB, patches: PhotoPatch[], alias: string): Promise<number> {
  for (const { existing, photos } of patches) {
    await supabase
      .from("business_reviews")
      .update({ photo_urls: photos, photo_count: Math.max(Number(existing.photo_count) || 0, photos.length) })
      .eq("id", existing.id)
    if (!existing.has_photo) await setPhoto(supabase, existing.id, true, alias)
  }
  return patches.length
}

// 入库：同 (platform, external_key) 只存一行。enrich=true（agent 导入）时
// 已存在的行也用新数据补全（agent 看的是原页面，比 API 节选更准）；
// API 刷新只 bump last_seen_at，不动人工改过的字段。
async function upsertRows(supabase: SB, rows: ReviewInsert[], source: string, alias: string, enrich: boolean) {
  let added = 0
  let seen = 0
  let enriched = 0
  let photos = 0
  const now = new Date().toISOString()
  const byPlatform = new Map<string, ReviewInsert[]>()
  for (const r of rows) (byPlatform.get(r.platform) ?? byPlatform.set(r.platform, []).get(r.platform)!).push(r)
  for (const [platform, list] of byPlatform) {
    const keys = list.map((r) => r.external_key)
    const { data: existing } = await supabase.from("business_reviews").select("id, external_key, has_photo, photo_count").eq("platform", platform).in("external_key", keys)
    const rowsByKey = new Map<string, ExistingReview>((existing ?? []).map((e: ExistingReview & { external_key: string }) => [e.external_key, e]))
    const have = new Map<string, string>([...rowsByKey].map(([k, e]) => [k, e.id]))
    const fresh = list.filter((r) => !have.has(r.external_key))
    if (fresh.length) {
      const { error } = await supabase.from("business_reviews").insert(fresh.map((r) => ({ ...r, source, created_by: alias, first_seen_at: now, last_seen_at: now })))
      if (error) throw error
      added += fresh.length
      photos += fresh.filter((r) => r.photo_urls.length > 0).length
    }
    for (const r of list) {
      const id = have.get(r.external_key)
      if (!id) continue
      seen += 1
      if (enrich) {
        const patch: Record<string, unknown> = { last_seen_at: now }
        if (r.body) patch.body = r.body
        if (r.url) patch.url = r.url
        if (r.rating != null) patch.rating = r.rating
        if (r.review_date) patch.review_date = r.review_date
        if (r.reviewer) patch.reviewer = r.reviewer
        await supabase.from("business_reviews").update(patch).eq("id", id)
        enriched += 1
        // 带图标记只升不降，并且走 setPhoto（见 attachPhotos）
        const e = rowsByKey.get(r.external_key)!
        if (r.photo_urls.length) {
          photos += await attachPhotos(supabase, [{ existing: e, photos: r.photo_urls }], alias)
        } else if (r.has_photo && !e.has_photo) {
          await setPhoto(supabase, id, true, alias)
        }
      } else {
        await supabase.from("business_reviews").update({ last_seen_at: now }).eq("id", id)
      }
    }
  }
  return { added, seen, enriched, photos }
}

export async function GET(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "supabase not configured" }, { status: 500 })
  const [{ data: reviews, error: e1 }, { data: staff }, { data: bonuses }, { data: claims }] = await Promise.all([
    supabase
      .from("business_reviews")
      .select("id, platform, external_key, reviewer, rating, review_date, body, url, has_photo, photo_count, staff_member_id, bonus_id, source, first_seen_at, last_seen_at")
      .order("review_date", { ascending: false })
      .order("first_seen_at", { ascending: false })
      .limit(500),
    supabase.from("staff_members").select("id, display_name, full_name, status, review_token, review_aliases").eq("status", "active").order("display_name"),
    supabase.from("chef_review_bonuses").select("id, staff_member_id, platform, review_date, cents, has_photo, settlement_id, review_id").order("review_date", { ascending: false }).limit(1000),
    // pending = 还在抢的（要老板裁决）；approved = 自动归属的，给老板一个
    // 能回看的账 —— 钱现在不经过他的手，至少得看得见。
    supabase.from("review_claims").select("id, review_id, staff_member_id, state, source, claimed_at, decided_at").in("state", ["pending", "approved"]).order("claimed_at", { ascending: false }).limit(500),
  ])
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
  type StaffRow = { id: string; display_name: string | null; full_name: string | null; review_token: string | null; review_aliases: string[] | null }
  return NextResponse.json({
    ok: true,
    reviews: reviews ?? [],
    staff: ((staff ?? []) as StaffRow[]).map((s) => ({
      id: s.id,
      name: String(s.display_name ?? s.full_name ?? "").trim() || "未命名",
      aliases: s.review_aliases ?? [],
      boardUrl: s.review_token ? `${BOARD_BASE}?t=${s.review_token}` : null,
    })),
    bonuses: bonuses ?? [],
    claims: claims ?? [],
    links: { google: GOOGLE_ALL_REVIEWS_URL, yelp: YELP_ALL_REVIEWS_URL, board: BOARD_BASE },
    providers: { google: !!process.env.GOOGLE_PLACES_API_KEY, yelp: !!process.env.YELP_API_KEY },
  })
}

export async function POST(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "supabase not configured" }, { status: 500 })
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  const action = String(body.action ?? "")
  if (OWNER_ACTIONS.has(action) && actor.role !== "owner") return NextResponse.json({ error: "只有老板能改好评台账" }, { status: 403 })

  try {
    switch (action) {
      case "refresh": {
        const out: Record<string, unknown> = {}
        const gKey = process.env.GOOGLE_PLACES_API_KEY
        if (!gKey) {
          out.google = { ok: false, reason: "没配 GOOGLE_PLACES_API_KEY；先由 agent 人工拉取导入" }
        } else {
          try {
            const r = await fetch(`https://places.googleapis.com/v1/places/${GOOGLE_PLACE_ID}`, {
              headers: { "X-Goog-Api-Key": gKey, "X-Goog-FieldMask": "rating,userRatingCount,reviews" },
              cache: "no-store",
            })
            const j = (await r.json()) as {
              error?: { status?: string; message?: string }
              rating?: number
              userRatingCount?: number
              reviews?: Array<{ name?: string; publishTime?: string; rating?: number; googleMapsUri?: string; text?: { text?: string }; originalText?: { text?: string }; authorAttribution?: { displayName?: string } }>
            }
            if (j.error) throw new Error(`${j.error.status ?? "ERR"}: ${j.error.message ?? ""}`.slice(0, 200))
            const rows: ReviewInsert[] = (j.reviews ?? []).map((v) => ({
              platform: "google",
              // name = places/<pid>/reviews/<rid>；取尾段做 key
              external_key: `g2_${(v.name ?? "").split("/").pop() ?? hash10(`${v.authorAttribution?.displayName}|${v.publishTime}`)}`.slice(0, 120),
              reviewer: str(v.authorAttribution?.displayName, 120) || null,
              rating: Number.isFinite(v.rating) ? Number(v.rating) : null,
              review_date: v.publishTime ? new Date(v.publishTime).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }) : null,
              body: str(v.text?.text ?? v.originalText?.text, 4000) || null,
              url: str(v.googleMapsUri, 500) || GOOGLE_ALL_REVIEWS_URL,
              has_photo: false,
              photo_count: 0,
              photo_urls: [],
              raw: v,
            }))
            const { keep, merged } = await fuzzyFilter(supabase, rows)
            const res = await upsertRows(supabase, keep, "api", actor.alias, false)
            // 台账里有几条 Google 评价：和 Google 的总数一比，就知道还差没差（差了要全量拉）
            const { count: have } = await supabase.from("business_reviews").select("id", { count: "exact", head: true }).eq("platform", "google")
            out.google = { ok: true, ...res, merged, rating: j.rating, total: j.userRatingCount, have: have ?? null, note: "Places API (New)：最相关 5 条（非最新），带图靠人工标；总数对不上就让 agent 全量拉一遍" }
          } catch (e) {
            out.google = { ok: false, reason: e instanceof Error ? e.message : "拉取失败" }
          }
        }
        const yKey = process.env.YELP_API_KEY
        if (!yKey) {
          out.yelp = { ok: false, reason: "没配 YELP_API_KEY（Yelp Fusion 免费申请）；先由 agent 人工拉取导入" }
        } else {
          try {
            const r = await fetch(`https://api.yelp.com/v3/businesses/${YELP_BIZ_ID}/reviews?limit=3&sort_by=newest`, { headers: { Authorization: `Bearer ${yKey}` }, cache: "no-store" })
            const j = (await r.json()) as { error?: { description?: string }; reviews?: Array<{ id?: string; url?: string; text?: string; rating?: number; time_created?: string; user?: { name?: string } }> }
            if (j.error) throw new Error(j.error.description ?? "Yelp error")
            const rows: ReviewInsert[] = (j.reviews ?? []).map((v) => ({
              platform: "yelp",
              external_key: v.id ? `y_${v.id}` : `y_${hash10(`${v.user?.name}|${v.time_created}|${v.text?.slice(0, 40)}`)}`,
              reviewer: str(v.user?.name, 120) || null,
              rating: Number.isFinite(v.rating) ? Number(v.rating) : null,
              review_date: v.time_created ? v.time_created.slice(0, 10) : null,
              body: str(v.text, 4000) || null,
              url: str(v.url, 500) || YELP_ALL_REVIEWS_URL,
              has_photo: false,
              photo_count: 0,
              photo_urls: [],
              raw: v,
            }))
            const { keep, merged } = await fuzzyFilter(supabase, rows)
            out.yelp = { ok: true, ...(await upsertRows(supabase, keep, "api", actor.alias, false)), merged, note: "Fusion API 一次只给最新 3 条节选，全量靠人工补" }
          } catch (e) {
            out.yelp = { ok: false, reason: e instanceof Error ? e.message : "拉取失败" }
          }
        }
        return NextResponse.json({ ok: true, providers: out })
      }
      case "import": {
        // agent（或老板）把页面上看到的评价整批灌进来。external_key 没有平台
        // 原生 id 时用 内容哈希 顶：同一条重复导入会合并，不会多一行。
        const list = Array.isArray(body.reviews) ? (body.reviews as Array<Record<string, unknown>>).slice(0, 100) : []
        if (!list.length) return NextResponse.json({ error: "reviews required" }, { status: 400 })
        const rows: ReviewInsert[] = []
        for (const v of list) {
          const platform = PLATFORMS.has(String(v.platform)) ? String(v.platform) : ""
          if (!platform) return NextResponse.json({ error: `platform 只能是 google/yelp/other` }, { status: 400 })
          const reviewer = str(v.reviewer, 120) || null
          const reviewDate = dateOrNull(v.review_date)
          const text = str(v.body, 4000) || null
          const key = str(v.external_key, 120) || `m_${hash10(`${platform}|${reviewer ?? ""}|${reviewDate ?? ""}|${(text ?? "").slice(0, 60)}`)}`
          const photos = cleanPhotoUrls(v.photos)
          rows.push({
            platform,
            external_key: key,
            reviewer,
            rating: Number.isFinite(Number(v.rating)) && v.rating !== null && v.rating !== undefined && v.rating !== "" ? Math.round(Number(v.rating)) : null,
            review_date: reviewDate,
            body: text,
            url: str(v.url, 500) || null,
            has_photo: v.has_photo === true || photos.length > 0,
            photo_count: Math.max(photos.length, Number.isFinite(Number(v.photo_count)) ? Math.max(0, Math.round(Number(v.photo_count))) : v.has_photo === true ? 1 : 0),
            photo_urls: photos,
            raw: null,
          })
        }
        const { keep, merged, photoPatches } = await fuzzyFilter(supabase, rows)
        const res = await upsertRows(supabase, keep, str(body.source, 20) || "agent", actor.alias, true)
        const photosOnMerged = await attachPhotos(supabase, photoPatches, actor.alias)
        return NextResponse.json({ ok: true, ...res, merged, photos: res.photos + photosOnMerged })
      }
      case "link_chef": {
        // 这条评价记给某师傅（$2/$3 进他的月结账本）。一条只许记一次。
        if (!isUuid(body.review_id) || !isUuid(body.staff_member_id)) return NextResponse.json({ error: "review_id + staff_member_id required" }, { status: 400 })
        const done = await creditReview(supabase, body.review_id, body.staff_member_id, actor.alias)
        if (!done) return NextResponse.json({ error: "这条已经记过奖励了（不能重复计算）" }, { status: 409 })
        // 老板直接定了，这条上挂着的认领都作废（他说了算，不许再抢）
        await supabase
          .from("review_claims")
          .update({ state: "rejected", decided_at: new Date().toISOString(), decided_by: actor.alias, note: "老板直接指定了" })
          .eq("review_id", body.review_id)
          .in("state", ["pending", "approved"])
        return NextResponse.json({ ok: true, bonusId: done.bonusId, cents: done.cents })
      }
      case "approve_claim": {
        // 老板裁决一条抢单：判给这个人，同一条上其他人的认领一并驳回。
        // 正常情况（没人抢）根本走不到这里 —— 那种在 /tools/reviews 上已经自动通过了。
        if (!isUuid(body.claim_id)) return NextResponse.json({ error: "claim_id required" }, { status: 400 })
        const { data: claim } = await supabase.from("review_claims").select("id, review_id, staff_member_id, state").eq("id", body.claim_id).maybeSingle()
        if (!claim) return NextResponse.json({ error: "not found" }, { status: 404 })
        if (claim.state === "approved") return NextResponse.json({ error: "这条已经是他的了" }, { status: 400 })
        if (claim.state !== "pending") return NextResponse.json({ error: "这条认领已经处理过了" }, { status: 400 })
        const now = new Date().toISOString()
        // 先把其他人的认领驳回，剩下一个人，resolveClaims 自然就判给他
        await supabase
          .from("review_claims")
          .update({ state: "rejected", decided_at: now, decided_by: actor.alias, note: "老板判给了别人" })
          .eq("review_id", claim.review_id)
          .eq("state", "pending")
          .neq("id", claim.id)
        const state = await resolveClaims(supabase, claim.review_id, actor.alias)
        if (state !== "credited") return NextResponse.json({ error: state === "frozen" ? "这条已经结算过了，先撤那张对账单" : "判不下去，刷新看看" }, { status: 409 })
        // resolveClaims 留的痕是"没人抢，自动通过"——这条是老板判的，改回真实原因
        await supabase.from("review_claims").update({ note: "老板判的" }).eq("id", claim.id)
        return NextResponse.json({ ok: true, state })
      }
      case "reject_claim": {
        // 驳回一个人的认领。驳完如果只剩一个人，那个人自动拿到。
        if (!isUuid(body.claim_id)) return NextResponse.json({ error: "claim_id required" }, { status: 400 })
        const { data: claim } = await supabase.from("review_claims").select("id, review_id, state").eq("id", body.claim_id).maybeSingle()
        if (!claim) return NextResponse.json({ error: "not found" }, { status: 404 })
        const { error } = await supabase
          .from("review_claims")
          .update({ state: "rejected", decided_at: new Date().toISOString(), decided_by: actor.alias, note: str(body.note, 200) || null })
          .eq("id", body.claim_id)
          .in("state", ["pending", "approved"])
        if (error) throw error
        const state = await resolveClaims(supabase, claim.review_id, actor.alias)
        return NextResponse.json({ ok: true, state })
      }
      case "auto_name": {
        // 正文点到名的一批自动归类。只动"正好提到一个在册师傅"的那些——
        // 两个人都被提到、或者一个都没提到的，留给人判断。
        // dry=true 只看会归哪些，不写库（页面先给老板过目）。
        const dry = body.dry === true
        const { data: staffRows } = await supabase.from("staff_members").select("id, display_name, full_name, review_aliases").eq("status", "active")
        const chefs: ChefLite[] = ((staffRows ?? []) as Array<{ id: string; display_name: string | null; full_name: string | null; review_aliases: string[] | null }>).map((s) => ({
          id: s.id,
          name: String(s.display_name ?? s.full_name ?? "").trim() || "未命名",
          aliases: s.review_aliases,
        }))
        const names = new Map(chefs.map((c) => [c.id, c.name]))
        const { data: open } = await supabase.from("business_reviews").select("id, reviewer, review_date, body, has_photo").is("bonus_id", null).limit(500)
        const hits: Array<{ review_id: string; staff_member_id: string; chef: string; reviewer: string | null; date: string | null; cents: number }> = []
        for (const r of (open ?? []) as Array<{ id: string; reviewer: string | null; review_date: string | null; body: string | null; has_photo: boolean }>) {
          const only = soleMatch(r.body, chefs)
          if (!only) continue
          hits.push({ review_id: r.id, staff_member_id: only, chef: names.get(only) ?? "", reviewer: r.reviewer, date: r.review_date, cents: r.has_photo ? REVIEW_PHOTO_CENTS : REVIEW_PLAIN_CENTS })
        }
        if (dry) return NextResponse.json({ ok: true, dry: true, hits })
        let linked = 0
        let cents = 0
        for (const h of hits) {
          const done = await creditReview(supabase, h.review_id, h.staff_member_id, actor.alias)
          if (done) {
            linked += 1
            cents += done.cents
          }
        }
        return NextResponse.json({ ok: true, linked, cents, considered: hits.length })
      }
      case "issue_link": {
        // 给师傅发一条个人榜单链接。重发会换新 token（旧链接立刻失效）。
        if (!isUuid(body.staff_member_id)) return NextResponse.json({ error: "staff_member_id required" }, { status: 400 })
        const token = randomBytes(18).toString("base64url")
        const { error } = await supabase.from("staff_members").update({ review_token: token }).eq("id", body.staff_member_id)
        if (error) throw error
        return NextResponse.json({ ok: true, url: `${BOARD_BASE}?t=${token}` })
      }
      case "revoke_link": {
        if (!isUuid(body.staff_member_id)) return NextResponse.json({ error: "staff_member_id required" }, { status: 400 })
        const { error } = await supabase.from("staff_members").update({ review_token: null }).eq("id", body.staff_member_id)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case "set_aliases": {
        // 客人写 "Mr. Blue" 指的是 Blu —— 别名加上，自动归类才认得出来。
        if (!isUuid(body.staff_member_id)) return NextResponse.json({ error: "staff_member_id required" }, { status: 400 })
        const list = Array.isArray(body.aliases) ? (body.aliases as unknown[]).map((v) => str(v, 40)).filter((v) => v.length >= 2).slice(0, 12) : []
        const { error } = await supabase.from("staff_members").update({ review_aliases: list }).eq("id", body.staff_member_id)
        if (error) throw error
        return NextResponse.json({ ok: true, aliases: list })
      }
      case "unlink_chef": {
        if (!isUuid(body.review_id)) return NextResponse.json({ error: "review_id required" }, { status: 400 })
        const { data: rev } = await supabase.from("business_reviews").select("id, bonus_id, staff_member_id").eq("id", body.review_id).maybeSingle()
        if (!rev?.bonus_id) return NextResponse.json({ error: "这条没有记过奖励" }, { status: 400 })
        const { data: bonus } = await supabase.from("chef_review_bonuses").select("id, settlement_id").eq("id", rev.bonus_id).maybeSingle()
        if (bonus?.settlement_id) return NextResponse.json({ error: "这条奖励已经结算过（在对账单里），先撤销那张对账单" }, { status: 400 })
        if (bonus) {
          const { error } = await supabase.from("chef_review_bonuses").delete().eq("id", bonus.id)
          if (error) throw error
        }
        await supabase.from("business_reviews").update({ bonus_id: null, staff_member_id: null }).eq("id", rev.id)
        // 老板取消归属 = "这条不是他的"，**只否掉他一个人**，别人该认领还能认领。
        // 否掉的理由：退回 pending 的话会被"没人抢就自动通过"立刻又判回给他，
        // 跟老板对着干；否掉之后他也不能再认领这条。
        if (rev.staff_member_id) {
          await supabase
            .from("review_claims")
            .update({ state: "rejected", decided_at: new Date().toISOString(), decided_by: actor.alias, note: "老板取消了归属" })
            .eq("review_id", rev.id)
            .eq("staff_member_id", rev.staff_member_id)
            .in("state", ["pending", "approved"])
        }
        // 还有别人挂着认领的话，这里会自动收敛（只剩一个人就直接判给他）
        await resolveClaims(supabase, rev.id, actor.alias)
        return NextResponse.json({ ok: true })
      }
      case "set_photo": {
        // 2026-10-02 改：已记给师傅的也能改带图，奖励金额跟着 $2 ⇄ $3 走。
        // 原来这里直接拒绝（"金额按当时档位冻结"），老板得先取消归属再改再记
        // 回去，三步；而带图只能靠人眼标，这步是常态不是例外。结过账的仍然不动。
        if (!isUuid(body.review_id)) return NextResponse.json({ error: "review_id required" }, { status: 400 })
        const r = await setPhoto(supabase, body.review_id, body.has_photo === true, actor.alias)
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 })
        return NextResponse.json({ ok: true, cents: r.cents })
      }
      case "delete_row": {
        if (!isUuid(body.review_id)) return NextResponse.json({ error: "review_id required" }, { status: 400 })
        const { error } = await supabase.from("business_reviews").delete().eq("id", body.review_id).is("bonus_id", null)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "server error" }, { status: 500 })
  }
}
