// 好评台账 ⇄ Google 商家资料：连接、找门店、全量同步、回复（2026-10-09）。
// API 细节和授权方式见 lib/gbp.ts；去重规则见 lib/review-merge.ts。
//
// 连接信息只有一行（gbp_connection.id = 'default'），refresh token 加密存。
//
// 同步 = 把 Google 上的全部评价和台账对一遍：
//   · 对上的：记下 gbp_review_id（以后靠它精确对、也靠它回复），只补空字段
//     （没日期补日期、没正文补正文、正文是 "…" 截断的补全文），回复状态以 Google 为准；
//     Google 上带照片、台账里还是"无图"的，照片挂上并走 setPhoto（没结算的 $2 → $3），
//     和 import 的老规矩一样：带图只升不降。
//   · 新的：插一行（external_key = gbp_<id>）。
//   · 台账有、Google 上没有的：只报不删（上面可能挂着钱，比如自己删了评价的 Christina）。
// 第一次同步会把几十条老记录和 Google 对起来，按名字对上的要人看一眼，所以第一次
// 必须先预演（dry）再写；之后每条都有 gbp_review_id，"手动刷新"直接全量同步。

import { randomBytes } from "node:crypto"
import {
  GBP_APIS,
  GBP_SCOPE,
  GbpError,
  OUR_PLACE_ID,
  accessTokenFor,
  apiLibraryUrl,
  buildAuthUrl,
  checkReply,
  clientProject,
  discoverLocations,
  exchangeCode,
  gbpClient,
  gbpReviewId,
  listAllReviews,
  openToken,
  parsePasted,
  pickLocation,
  pkcePair,
  primeAccessToken,
  ptDate,
  putReply,
  sealToken,
  starNumber,
  type GbpLocation,
  type GbpReview,
} from "./gbp"
import { normText, planGbpSync, type LinkRule } from "./review-merge"
import { cleanPhotoUrls } from "./review-photos"
import { setPhoto } from "./review-claims-server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any

/** 新进来的 Google 评价默认链到全部评价页（商家资料 API 不给单条的公开链接）。 */
export const GOOGLE_ALL_REVIEWS_URL = `https://search.google.com/local/reviews?placeid=${OUR_PLACE_ID}`
const PENDING_MINUTES = 20

type ConnRow = {
  id: string
  google_email: string | null
  account_name: string | null
  location_name: string | null
  location_title: string | null
  place_id: string | null
  maps_uri: string | null
  locations: GbpLocation[] | null
  refresh_token_enc: string | null
  scopes: string | null
  connected_at: string | null
  connected_by: string | null
  pending_state: string | null
  pending_verifier_enc: string | null
  pending_expires_at: string | null
  pending_by: string | null
  last_sync_at: string | null
  last_sync: Record<string, unknown> | null
  last_error: string | null
  last_error_at: string | null
}

const CONN_COLS =
  "id, google_email, account_name, location_name, location_title, place_id, maps_uri, locations, refresh_token_enc, scopes, connected_at, connected_by, pending_state, pending_verifier_enc, pending_expires_at, pending_by, last_sync_at, last_sync, last_error, last_error_at"

async function loadConn(supabase: SB): Promise<ConnRow | null> {
  const { data, error } = await supabase.from("gbp_connection").select(CONN_COLS).eq("id", "default").maybeSingle()
  if (error) throw error
  return (data as ConnRow | null) ?? null
}

async function saveConn(supabase: SB, patch: Partial<ConnRow>) {
  const { error } = await supabase.from("gbp_connection").upsert({ id: "default", ...patch, updated_at: new Date().toISOString() }, { onConflict: "id" })
  if (error) throw error
}

/** 出错时记一笔给老板看（状态卡上红字），不吞原错误。 */
export async function recordGbpError(supabase: SB, e: unknown) {
  const hint = e instanceof GbpError ? e.hint : e instanceof Error ? e.message : String(e)
  await saveConn(supabase, { last_error: hint.slice(0, 500), last_error_at: new Date().toISOString() }).catch(() => undefined)
}

function needClient() {
  const client = gbpClient()
  if (!client) throw new GbpError(500, "no_client", "OAuth client env missing", "服务器上没配 OAuth 客户端（GOOGLE_ADS_CLIENT_ID / SECRET）——这条要开发处理")
  return client
}

async function linkedCount(supabase: SB): Promise<number> {
  const { count } = await supabase.from("business_reviews").select("id", { count: "exact", head: true }).eq("platform", "google").not("gbp_review_id", "is", null)
  return count ?? 0
}

export type GbpStatus = {
  clientReady: boolean
  clientProject: string | null
  expectedProject: string
  connected: boolean
  email: string | null
  location: { name: string; title: string | null; placeIdMatches: boolean | null; mapsUri: string | null } | null
  candidates: Array<{ name: string; title: string | null; account: string }>
  pending: boolean
  connectedAt: string | null
  connectedBy: string | null
  lastSyncAt: string | null
  lastSync: Record<string, unknown> | null
  lastError: string | null
  lastErrorAt: string | null
  /** 有没有已经和 Google 对上的行：没有 = 第一次同步，必须先预演 */
  firstSyncDone: boolean
  linked: number
  apis: Array<{ id: string; label: string; url: string }>
}

export async function gbpStatus(supabase: SB): Promise<GbpStatus> {
  const client = gbpClient()
  const [conn, linked] = await Promise.all([loadConn(supabase), linkedCount(supabase)])
  const connected = !!conn?.refresh_token_enc
  return {
    clientReady: !!client,
    clientProject: client ? clientProject(client.clientId) : null,
    expectedProject: "987010086025",
    connected,
    email: conn?.google_email ?? null,
    location: connected && conn?.location_name ? { name: conn.location_name, title: conn.location_title, placeIdMatches: conn.place_id ? conn.place_id === OUR_PLACE_ID : null, mapsUri: conn.maps_uri } : null,
    candidates: connected && !conn?.location_name ? (conn?.locations ?? []).map((l) => ({ name: l.name, title: l.title, account: l.account })) : [],
    pending: !!conn?.pending_expires_at && Date.parse(conn.pending_expires_at) > Date.now(),
    connectedAt: conn?.connected_at ?? null,
    connectedBy: conn?.connected_by ?? null,
    lastSyncAt: conn?.last_sync_at ?? null,
    lastSync: conn?.last_sync ?? null,
    lastError: conn?.last_error ?? null,
    lastErrorAt: conn?.last_error_at ?? null,
    firstSyncDone: linked > 0,
    linked,
    apis: GBP_APIS.map((a) => ({ ...a, url: apiLibraryUrl(a.id) })),
  }
}

/** 第 1 步：生成 Google 授权页地址（state + PKCE 存库，20 分钟内有效、只能用一次）。 */
export async function startConnect(supabase: SB, alias: string): Promise<{ url: string; expiresInMinutes: number }> {
  const client = needClient()
  const state = randomBytes(24).toString("base64url")
  const { verifier, challenge } = pkcePair()
  await saveConn(supabase, {
    pending_state: state,
    pending_verifier_enc: sealToken(verifier, client.clientSecret),
    pending_expires_at: new Date(Date.now() + PENDING_MINUTES * 60000).toISOString(),
    pending_by: alias,
  })
  return { url: buildAuthUrl(client.clientId, state, challenge), expiresInMinutes: PENDING_MINUTES }
}

/**
 * 第 2 步：老板把授权后的地址贴回来 → 换 refresh token → 加密存 → 找门店。
 * 找门店失败（比如 API 还没启用）不回滚授权：启用之后点「重新查找门店」就行，不用再授权一次。
 */
export async function finishConnect(supabase: SB, alias: string, pasted: unknown) {
  const parsed = parsePasted(pasted)
  if ("error" in parsed) throw new GbpError(400, "bad_paste", parsed.error)
  const client = needClient()
  const conn = await loadConn(supabase)
  if (!conn?.pending_state || conn.pending_state !== parsed.state) {
    throw new GbpError(400, "state_mismatch", "state mismatch", "这段地址不是最近一次「连接 Google」点出来的（或者已经用过了）——重新点「连接 Google」再来一次")
  }
  if (!conn.pending_expires_at || Date.parse(conn.pending_expires_at) < Date.now()) {
    throw new GbpError(400, "state_expired", "state expired", `超过 ${PENDING_MINUTES} 分钟了——重新点「连接 Google」再来一次`)
  }
  const verifier = openToken(conn.pending_verifier_enc, client.clientSecret)
  // 先作废这一次（授权码一次性；不管换没换成功都不能再用这个 state）
  await saveConn(supabase, { pending_state: null, pending_verifier_enc: null, pending_expires_at: null, pending_by: null })
  if (!verifier) throw new GbpError(400, "verifier_unreadable", "verifier unreadable", "这次授权的校验信息解不开——重新点「连接 Google」再来一次")

  const t = await exchangeCode(client, parsed.code, verifier)
  if (!t.scopes.includes(GBP_SCOPE)) {
    throw new GbpError(400, "scope_missing", `granted: ${t.scopes.join(" ")}`, "同意页上没勾“Google 商家”那一项（See, edit, create, and delete your Google business listings）——重新连接，那一项要打勾")
  }
  if (!t.refreshToken) throw new GbpError(400, "no_refresh_token", "no refresh_token", "Google 这次没给长期授权——重新连接一次")
  if (t.accessToken) primeAccessToken(t.refreshToken, t.accessToken, t.expiresIn)
  await saveConn(supabase, {
    refresh_token_enc: sealToken(t.refreshToken, client.clientSecret),
    scopes: t.scopes.join(" "),
    google_email: t.email,
    connected_at: new Date().toISOString(),
    connected_by: alias,
    account_name: null,
    location_name: null,
    location_title: null,
    place_id: null,
    maps_uri: null,
    locations: [],
    last_error: null,
    last_error_at: null,
  })
  try {
    return { connected: true, email: t.email, located: await locate(supabase) }
  } catch (e) {
    await recordGbpError(supabase, e)
    return { connected: true, email: t.email, located: null, locateError: e instanceof GbpError ? e.hint : e instanceof Error ? e.message : String(e) }
  }
}

async function tokenAndConn(supabase: SB) {
  const client = needClient()
  const conn = await loadConn(supabase)
  if (!conn?.refresh_token_enc) throw new GbpError(409, "not_connected", "not connected", "还没连接 Google 商家资料——在「好评」页签点「连接 Google」")
  const refresh = openToken(conn.refresh_token_enc, client.clientSecret)
  if (!refresh) throw new GbpError(409, "token_unreadable", "token unreadable", "存着的授权解不开了（服务器的 OAuth 客户端换过）——点「重新连接」")
  return { token: await accessTokenFor(client, refresh), conn }
}

/** 找门店：Place ID 对得上的那家；只有一家就是它；多家对不上就把候选存下来让老板选。 */
export async function locate(supabase: SB, chosen?: string) {
  const { token, conn } = await tokenAndConn(supabase)
  if (chosen) {
    const l = (conn.locations ?? []).find((x) => x.name === chosen)
    if (!l) throw new GbpError(400, "unknown_location", "unknown location", "候选里没有这家——点「重新查找门店」")
    await saveConn(supabase, { account_name: l.account, location_name: l.name, location_title: l.title, place_id: l.placeId, maps_uri: l.mapsUri, last_error: null, last_error_at: null })
    return { accounts: null, found: (conn.locations ?? []).length, picked: l }
  }
  const d = await discoverLocations(token)
  const pick = pickLocation(d.locations)
  await saveConn(supabase, {
    locations: d.locations,
    account_name: pick?.account ?? null,
    location_name: pick?.name ?? null,
    location_title: pick?.title ?? null,
    place_id: pick?.placeId ?? null,
    maps_uri: pick?.mapsUri ?? null,
    last_error: d.locations.length ? null : "这个 Google 账号下面没有任何商家资料——连接时选错账号了：点「重新连接」，选管理 Real Hibachi 的那个账号",
    last_error_at: d.locations.length ? null : new Date().toISOString(),
  })
  return { accounts: d.accounts.length, found: d.locations.length, picked: pick, errors: d.errors }
}

/** 只删我们这边存的授权。不去 Google 撤销：撤销按"账号 × 客户端"整体撤，同账号的 Google Ads 授权会一起失效。 */
export async function disconnect(supabase: SB) {
  await saveConn(supabase, {
    refresh_token_enc: null,
    scopes: null,
    google_email: null,
    connected_at: null,
    connected_by: null,
    account_name: null,
    location_name: null,
    location_title: null,
    place_id: null,
    maps_uri: null,
    locations: [],
    pending_state: null,
    pending_verifier_enc: null,
    pending_expires_at: null,
    pending_by: null,
    last_error: null,
    last_error_at: null,
  })
}

// ------------------------------------------------------------ sync

type LedgerFull = {
  id: string
  external_key: string
  gbp_review_id: string | null
  reviewer: string | null
  review_date: string | null
  body: string | null
  rating: number | null
  has_photo: boolean
  photo_count: number | null
  photo_urls: string[] | null
  bonus_id: string | null
  reply_comment: string | null
}

const mediaThumbs = (v: GbpReview | undefined) => (v?.reviewMediaItems ?? []).map((m) => m.thumbnailUrl).filter((u): u is string => !!u)
const snippet = (s: string | null | undefined, n = 90) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim()
  return t.length > n ? `${t.slice(0, n)}…` : t
}
const briefGoogle = (v: GbpReview | undefined) => ({
  reviewer: v?.reviewer?.displayName ?? null,
  date: ptDate(v?.createTime),
  rating: starNumber(v?.starRating),
  snippet: snippet(v?.comment),
  photos: mediaThumbs(v).length,
  replied: !!v?.reviewReply?.comment,
})
const briefRow = (r: LedgerFull | undefined) => ({ id: r?.id ?? "", reviewer: r?.reviewer ?? null, date: r?.review_date ?? null, snippet: snippet(r?.body), hasBonus: !!r?.bonus_id })

/** 台账里的正文是页面上抓的、以 "…" 截断的，而 Google 给的是同一段的全文。 */
function truncatedOf(rowBody: string, full: string): boolean {
  const t = rowBody.trim()
  if (!/(…|\.\.\.)$/.test(t)) return false
  const head = normText(t.replace(/\s*(…|\.\.\.)$/, ""))
  return head.length >= 10 && normText(full).startsWith(head) && normText(full).length > head.length
}

export type SyncSummary = {
  ok: true
  dry: boolean
  onGoogle: number
  total: number | null
  average: number | null
  alreadyLinked: number
  newlyLinked: Array<{ rule: LinkRule; ledger: ReturnType<typeof briefRow>; google: ReturnType<typeof briefGoogle> }>
  fresh: Array<ReturnType<typeof briefGoogle>>
  suspects: Array<{ google: ReturnType<typeof briefGoogle>; ledger: Array<ReturnType<typeof briefRow>> }>
  missing: Array<ReturnType<typeof briefRow>>
  photoUpgrades: Array<{ reviewer: string | null; date: string | null; hasBonus: boolean }>
  replied: number
  unreplied: number
  // 写库之后才有
  added?: number
  linked?: number
  photos?: number
  have?: number
  errors?: string[]
}

export async function syncFromGbp(supabase: SB, alias: string, opts: { dry: boolean }): Promise<SyncSummary> {
  const { token, conn } = await tokenAndConn(supabase)
  if (!conn.account_name || !conn.location_name) throw new GbpError(409, "no_location", "no location", "还没认出是哪家门店——点「重新查找门店」")
  const { reviews, total, average } = await listAllReviews(token, conn.account_name, conn.location_name)

  const { data, error } = await supabase
    .from("business_reviews")
    .select("id, external_key, gbp_review_id, reviewer, review_date, body, rating, has_photo, photo_count, photo_urls, bonus_id, reply_comment")
    .eq("platform", "google")
    .limit(2000)
  if (error) throw error
  const rows = (data ?? []) as LedgerFull[]
  const rowById = new Map(rows.map((r) => [r.id, r]))
  const byId = new Map(reviews.map((v) => [gbpReviewId(v), v]))
  const plan = planGbpSync(
    rows,
    [...byId.entries()].filter(([id]) => !!id).map(([id, v]) => ({ reviewId: id, reviewer: v.reviewer?.displayName ?? null, date: ptDate(v.createTime), comment: v.comment ?? null })),
  )

  const summary: SyncSummary = {
    ok: true,
    dry: opts.dry,
    onGoogle: reviews.length,
    total,
    average,
    alreadyLinked: plan.links.filter((l) => l.rule === "id").length,
    newlyLinked: plan.links.filter((l) => l.rule !== "id").map((l) => ({ rule: l.rule, ledger: briefRow(rowById.get(l.rowId)), google: briefGoogle(byId.get(l.reviewId)) })),
    fresh: plan.fresh.map((id) => briefGoogle(byId.get(id))),
    suspects: plan.suspects.map((s) => ({ google: briefGoogle(byId.get(s.reviewId)), ledger: s.rowIds.map((id) => briefRow(rowById.get(id))) })),
    missing: plan.missing.map((id) => briefRow(rowById.get(id))),
    photoUpgrades: plan.links
      .filter((l) => mediaThumbs(byId.get(l.reviewId)).length > 0 && !rowById.get(l.rowId)?.has_photo)
      .map((l) => ({ reviewer: rowById.get(l.rowId)?.reviewer ?? null, date: rowById.get(l.rowId)?.review_date ?? null, hasBonus: !!rowById.get(l.rowId)?.bonus_id })),
    replied: reviews.filter((v) => !!v.reviewReply?.comment).length,
    unreplied: reviews.filter((v) => !v.reviewReply?.comment).length,
  }
  if (opts.dry) return summary

  const now = new Date().toISOString()
  const errors: string[] = []
  let linked = 0
  let photos = 0

  for (const l of plan.links) {
    const v = byId.get(l.reviewId)
    const r = rowById.get(l.rowId)
    if (!v || !r) continue
    const patch: Record<string, unknown> = { last_seen_at: now }
    if (r.gbp_review_id !== l.reviewId) patch.gbp_review_id = l.reviewId
    const rating = starNumber(v.starRating)
    if (r.rating == null && rating != null) patch.rating = rating
    const date = ptDate(v.createTime)
    if (!r.review_date && date) patch.review_date = date
    const comment = (v.comment ?? "").trim()
    if (comment && (!r.body || truncatedOf(r.body, comment))) patch.body = comment
    // 回复以 Google 上的为准（老板也可能直接在商家后台回）
    const reply = (v.reviewReply?.comment ?? "").trim() || null
    patch.reply_comment = reply
    patch.reply_updated_at = reply ? (v.reviewReply?.updateTime ?? null) : null
    patch.reply_state = reply ? (v.reviewReply?.reviewReplyState ?? null) : null
    if (reply !== (r.reply_comment ?? null)) patch.reply_by = null
    const pics = cleanPhotoUrls(mediaThumbs(v))
    if (pics.length && !(r.photo_urls ?? []).length) {
      patch.photo_urls = pics
      patch.photo_count = Math.max(Number(r.photo_count) || 0, pics.length)
    }
    const { error: e1 } = await supabase.from("business_reviews").update(patch).eq("id", r.id)
    if (e1) {
      errors.push(`${r.reviewer ?? r.id}: ${e1.message}`)
      continue
    }
    if (patch.gbp_review_id) linked += 1
    // 没图 → 有图会动钱（没结算的 $2 → $3），走 setPhoto；结算过的它会拒，照片照样挂上
    if (pics.length && !r.has_photo) {
      const res = await setPhoto(supabase, r.id, true, alias)
      if (res.ok) photos += 1
    }
  }

  const freshRows = plan.fresh
    .map((id) => byId.get(id))
    .filter((v): v is GbpReview => !!v)
    .map((v) => {
      const id = gbpReviewId(v)
      const pics = cleanPhotoUrls(mediaThumbs(v))
      const reply = (v.reviewReply?.comment ?? "").trim() || null
      return {
        platform: "google",
        external_key: `gbp_${id}`,
        gbp_review_id: id,
        reviewer: (v.reviewer?.displayName ?? "").trim() || null,
        rating: starNumber(v.starRating),
        review_date: ptDate(v.createTime),
        body: (v.comment ?? "").trim() || null,
        url: GOOGLE_ALL_REVIEWS_URL,
        has_photo: mediaThumbs(v).length > 0,
        photo_count: mediaThumbs(v).length,
        photo_urls: pics,
        source: "gbp",
        raw: { reviewId: id, createTime: v.createTime ?? null, updateTime: v.updateTime ?? null, starRating: v.starRating ?? null, media: (v.reviewMediaItems ?? []).length },
        reply_comment: reply,
        reply_updated_at: reply ? (v.reviewReply?.updateTime ?? null) : null,
        reply_state: reply ? (v.reviewReply?.reviewReplyState ?? null) : null,
        first_seen_at: now,
        last_seen_at: now,
        created_by: alias,
      }
    })
  let added = 0
  if (freshRows.length) {
    // 同一时间点了两次同步：(platform, external_key) 撞了就跳过，不会多一行
    const { data: ins, error: e2 } = await supabase.from("business_reviews").upsert(freshRows, { onConflict: "platform,external_key", ignoreDuplicates: true }).select("id")
    if (e2) errors.push(`新评价写入失败：${e2.message}`)
    else added = (ins ?? []).length
  }

  const have = await linkedCount(supabase)
  await saveConn(supabase, {
    last_sync_at: now,
    last_sync: { added, linked, photos, onGoogle: reviews.length, total, unreplied: summary.unreplied, missing: summary.missing.length, by: alias, errors: errors.length },
    ...(errors.length ? { last_error: `同步有 ${errors.length} 处没写进去：${errors[0]}`.slice(0, 500), last_error_at: now } : { last_error: null, last_error_at: null }),
  })
  return { ...summary, added, linked, photos, have, errors }
}

// ------------------------------------------------------------ reply

export async function replyToReview(supabase: SB, alias: string, reviewRowId: string, comment: unknown) {
  const checked = checkReply(comment)
  if (!checked.ok) throw new GbpError(400, "bad_reply", checked.error)
  const { data } = await supabase.from("business_reviews").select("id, platform, gbp_review_id").eq("id", reviewRowId).maybeSingle()
  const row = data as { id: string; platform: string; gbp_review_id: string | null } | null
  if (!row) throw new GbpError(404, "not_found", "not found", "这条评价不在台账里了")
  if (row.platform !== "google" || !row.gbp_review_id) throw new GbpError(409, "not_linked", "not linked", "这条还没和 Google 商家后台对上——先点「全量同步」")
  const { token, conn } = await tokenAndConn(supabase)
  if (!conn.account_name || !conn.location_name) throw new GbpError(409, "no_location", "no location", "还没认出是哪家门店——点「重新查找门店」")
  const r = await putReply(token, conn.account_name, conn.location_name, row.gbp_review_id, checked.text)
  const saved = {
    reply_comment: (r.comment ?? checked.text).trim(),
    reply_updated_at: r.updateTime ?? new Date().toISOString(),
    reply_state: r.reviewReplyState ?? null,
    reply_by: alias,
  }
  await supabase.from("business_reviews").update(saved).eq("id", row.id)
  return saved
}
