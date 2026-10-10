// Google 商家资料（Business Profile）API —— 只在服务端用（2026-10-09）。
//
// 为什么接它：Places API 只给"最相关"5 条、不保证最新；全量一直靠 agent 在内置浏览器
// 登录 Maps 抓页面，脆、还要老板登录。2026-10-09 Google 批了 API 白名单
// （Case 5-6384000041625，项目 real-hibachi / 987010086025，300 QPM）。
//
// 授权（OAuth，不是 API key）：
//   · 用 real-hibachi 项目里现成的那个"桌面应用"OAuth 客户端（Google Ads 也用它，
//     Vercel 里是 GOOGLE_ADS_CLIENT_ID / SECRET）。同意屏幕 09-18 起是"正式发布"，
//     所以 refresh token 不会 7 天就死（测试状态才会）。配额算在客户端所属项目上，
//     必须是 987010086025，别换成别的项目的客户端。
//   · 桌面客户端只认回环地址回跳，所以回跳到 http://127.0.0.1:8769/ —— 这台电脑上
//     没有程序在听，浏览器会显示"无法访问此网站"，老板把地址栏整段贴回工作台就行
//     （code 一次性、还要配服务端的 client secret + PKCE verifier 才换得到 token）。
//   · refresh token 加密后存 Supabase gbp_connection（AES-256-GCM，钥匙由 client
//     secret 派生；数据库里看不到明文）。断开只删我们这边的，不去 Google 撤销——
//     撤销是按"这个账号 × 这个客户端"整体撤，同账号的 Ads 授权会一起死。
//
// 三个 API 都要在 real-hibachi 项目里启用：
//   mybusinessaccountmanagement（列账号）、mybusinessbusinessinformation（列门店）、
//   mybusiness（v4：评价列表 + 回复）。

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto"

export const GBP_SCOPE = "https://www.googleapis.com/auth/business.manage"
export const GBP_SCOPES = ["openid", "email", GBP_SCOPE]
export const GBP_REDIRECT_URI = "http://127.0.0.1:8769/"
export const GBP_PROJECT_NUMBER = "987010086025"
/** 我们这家店在 Places 里的 id（refresh 的 Places 那条路也用它）——找门店时拿来认 */
export const OUR_PLACE_ID = "ChIJkxNMr8pbkkARqHR_D2YBK6E"

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const TOKEN_URL = "https://oauth2.googleapis.com/token"
const ACCOUNTS_URL = "https://mybusinessaccountmanagement.googleapis.com/v1/accounts"
const BIZINFO_URL = "https://mybusinessbusinessinformation.googleapis.com/v1"
const V4_URL = "https://mybusiness.googleapis.com/v4"

export const GBP_APIS = [
  { id: "mybusinessaccountmanagement.googleapis.com", label: "My Business Account Management API" },
  { id: "mybusinessbusinessinformation.googleapis.com", label: "My Business Business Information API" },
  { id: "mybusiness.googleapis.com", label: "Google My Business API" },
] as const
export const apiLibraryUrl = (id: string) => `https://console.cloud.google.com/apis/library/${id}?project=real-hibachi`

// ------------------------------------------------------------ OAuth client

export type GbpClient = { clientId: string; clientSecret: string }

/** 有 GBP_OAUTH_* 就用那一对，否则用 Ads 那一对（同一个项目的同一个客户端）。不混搭。 */
export function gbpClient(): GbpClient | null {
  const own = { clientId: (process.env.GBP_OAUTH_CLIENT_ID ?? "").trim(), clientSecret: (process.env.GBP_OAUTH_CLIENT_SECRET ?? "").trim() }
  if (own.clientId) return own.clientSecret ? own : null
  const ads = { clientId: (process.env.GOOGLE_ADS_CLIENT_ID ?? "").trim(), clientSecret: (process.env.GOOGLE_ADS_CLIENT_SECRET ?? "").trim() }
  return ads.clientId && ads.clientSecret ? ads : null
}

/** 客户端 id 开头的数字就是它所属的 GCP 项目号（配额和白名单都按这个算）。 */
export const clientProject = (clientId: string) => /^(\d+)-/.exec(clientId)?.[1] ?? null

export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString("base64url")
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") }
}

export function buildAuthUrl(clientId: string, state: string, challenge: string): string {
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: GBP_REDIRECT_URI,
    response_type: "code",
    scope: GBP_SCOPES.join(" "),
    // offline + consent：一定拿到 refresh token；select_account：老板可能登着好几个号，逼他选
    access_type: "offline",
    prompt: "select_account consent",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  })
  return `${AUTH_URL}?${p.toString()}`
}

/**
 * 老板贴回来的东西：整条地址、没有 http:// 的地址、只有 ?code=…&state=… 都认。
 * Google 回跳带的 error（比如点了取消）原样翻出来。
 */
export function parsePasted(input: unknown): { code: string; state: string } | { error: string } {
  const s = typeof input === "string" ? input.trim() : ""
  if (!s) return { error: "框里是空的——把授权后浏览器地址栏整段复制过来" }
  const q = (s.includes("?") ? s.slice(s.indexOf("?") + 1) : s).split("#")[0]
  const p = new URLSearchParams(q)
  const err = p.get("error")
  if (err) return { error: err === "access_denied" ? "授权页上点了取消，或者没勾“Google 商家”那一项——重新点「连接 Google」再来一次" : `Google 返回：${err}` }
  const code = p.get("code")
  const state = p.get("state")
  if (!code || !state) return { error: "没找到授权码——要复制的是授权完之后那一页（“无法访问此网站”）地址栏里的整段地址" }
  return { code, state }
}

// ------------------------------------------------------------ errors

export class GbpError extends Error {
  status: number
  reason: string
  /** 给老板看的中文：怎么修 */
  hint: string
  constructor(status: number, reason: string, message: string, hint?: string) {
    super(message)
    this.status = status
    this.reason = reason
    this.hint = hint ?? message
  }
}

type GoogleErrorBody = {
  error?:
    | string
    | {
        code?: number
        message?: string
        status?: string
        details?: Array<{ reason?: string; metadata?: Record<string, string> }>
      }
  error_description?: string
}

const apiLabel = (service: string | undefined) => GBP_APIS.find((a) => a.id === service)?.label ?? service ?? "这个 API"

/** Google 的报错 → 中文的"怎么修"。只认我们实际会碰到的几种，其余原样给。 */
export function gbpErrorFrom(status: number, body: GoogleErrorBody | null, text = ""): GbpError {
  if (body && typeof body.error === "string") {
    // OAuth 端点的报错格式：{ error: "invalid_grant", error_description }
    const reason = body.error
    if (reason === "invalid_grant") return new GbpError(status, reason, body.error_description ?? reason, "Google 授权失效了（被撤销、改了账号权限，或者授权码过期/用过了）——在「好评」页签点「重新连接」再走一次")
    if (reason === "invalid_client" || reason === "unauthorized_client") return new GbpError(status, reason, body.error_description ?? reason, "服务器上的 OAuth 客户端配置不对（GOOGLE_ADS_CLIENT_ID / SECRET）——这条要开发处理")
    return new GbpError(status, reason, body.error_description ?? reason)
  }
  const e = body && typeof body.error === "object" ? body.error : undefined
  const info = e?.details?.find((d) => d.reason) ?? undefined
  const reason = info?.reason ?? e?.status ?? `HTTP_${status}`
  const message = (e?.message ?? text ?? `HTTP ${status}`).slice(0, 300)
  const service = info?.metadata?.service
  if (reason === "SERVICE_DISABLED" || /has not been used in project|is disabled/i.test(message)) {
    return new GbpError(status, "SERVICE_DISABLED", message, `real-hibachi 项目里还没启用「${apiLabel(service)}」——打开 ${apiLibraryUrl(service ?? "mybusiness.googleapis.com")} 点「启用」，等 1–2 分钟再试`)
  }
  if (status === 429 || reason === "RATE_LIMIT_EXCEEDED" || reason === "RESOURCE_EXHAUSTED") {
    return new GbpError(status, reason, message, "Google 配额不够：要么白名单没生效（配额还是 0），要么一分钟内点太多次。等一分钟再试；一直这样就去 GCP 配额页看 QPM 是不是 300")
  }
  if (status === 401) return new GbpError(status, reason, message, "Google 授权失效了——在「好评」页签点「重新连接」")
  if (status === 403) return new GbpError(status, reason, message, "Google 拒绝了：连接用的这个 Google 账号可能不是这家店的所有者/管理员，或者 API 白名单没覆盖这个项目")
  if (status === 404) return new GbpError(status, reason, message, "Google 上找不到这个账号/门店/评价（门店换了或评价被删了）——点「重新查找门店」")
  return new GbpError(status, reason, message)
}

// ------------------------------------------------------------ token at rest

const sealKey = (secret: string) => createHmac("sha256", secret).update("rh-gbp-refresh-token-v1").digest()

/** refresh token 加密存库：数据库（含 SQL 查询结果、备份）里永远看不到明文。 */
export function sealToken(plain: string, secret: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv("aes-256-gcm", sealKey(secret), iv)
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()])
  return ["v1", iv.toString("base64url"), enc.toString("base64url"), c.getAuthTag().toString("base64url")].join(".")
}

/** 解不开（钥匙换了 / 被改过）返回 null —— 那就只能重新连接。 */
export function openToken(sealed: string | null | undefined, secret: string): string | null {
  const parts = (sealed ?? "").split(".")
  if (parts.length !== 4 || parts[0] !== "v1") return null
  try {
    const d = createDecipheriv("aes-256-gcm", sealKey(secret), Buffer.from(parts[1], "base64url"))
    d.setAuthTag(Buffer.from(parts[3], "base64url"))
    return Buffer.concat([d.update(Buffer.from(parts[2], "base64url")), d.final()]).toString("utf8")
  } catch {
    return null
  }
}

// ------------------------------------------------------------ token endpoint

async function tokenCall(params: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
    cache: "no-store",
  })
  const text = await res.text()
  let j: Record<string, unknown> = {}
  try {
    j = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    // 非 JSON 当纯文本
  }
  if (!res.ok) throw gbpErrorFrom(res.status, j as GoogleErrorBody, text)
  return j as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; id_token?: string }
}

/** id_token 直接来自 Google 的 token 端点（TLS），这里只读它的 email，不验签。 */
export function emailFromIdToken(idToken: string | undefined): string | null {
  try {
    const payload = JSON.parse(Buffer.from(String(idToken ?? "").split(".")[1] ?? "", "base64url").toString("utf8")) as { email?: string }
    return typeof payload.email === "string" ? payload.email : null
  } catch {
    return null
  }
}

export async function exchangeCode(client: GbpClient, code: string, verifier: string) {
  const j = await tokenCall({
    code,
    client_id: client.clientId,
    client_secret: client.clientSecret,
    redirect_uri: GBP_REDIRECT_URI,
    grant_type: "authorization_code",
    code_verifier: verifier,
  })
  return {
    refreshToken: j.refresh_token ?? null,
    accessToken: j.access_token ?? null,
    expiresIn: Number(j.expires_in ?? 3600),
    scopes: String(j.scope ?? "").split(/\s+/).filter(Boolean),
    email: emailFromIdToken(j.id_token),
  }
}

const accessCache = new Map<string, { token: string; until: number }>()

/** refresh token → access token（每个函数实例缓存到过期前 2 分钟）。 */
export async function accessTokenFor(client: GbpClient, refreshToken: string): Promise<string> {
  const k = createHash("sha256").update(refreshToken).digest("hex").slice(0, 24)
  const hit = accessCache.get(k)
  if (hit && hit.until > Date.now()) return hit.token
  const j = await tokenCall({ client_id: client.clientId, client_secret: client.clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" })
  if (!j.access_token) throw new GbpError(500, "no_access_token", "token refresh returned no access_token")
  accessCache.set(k, { token: j.access_token, until: Date.now() + Math.max(60, Number(j.expires_in ?? 3600) - 120) * 1000 })
  return j.access_token
}

export function primeAccessToken(refreshToken: string, accessToken: string, expiresIn: number) {
  const k = createHash("sha256").update(refreshToken).digest("hex").slice(0, 24)
  accessCache.set(k, { token: accessToken, until: Date.now() + Math.max(60, expiresIn - 120) * 1000 })
}

// ------------------------------------------------------------ REST

async function gapi<T>(token: string, url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: { authorization: `Bearer ${token}`, ...(init?.body !== undefined ? { "content-type": "application/json" } : {}) },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  })
  const text = await res.text()
  let j: unknown = null
  try {
    j = text ? JSON.parse(text) : {}
  } catch {
    // 非 JSON
  }
  if (!res.ok) throw gbpErrorFrom(res.status, j as GoogleErrorBody | null, text)
  return (j ?? {}) as T
}

export type GbpAccount = { name: string; accountName: string | null; type: string | null; role: string | null }
export type GbpLocation = { account: string; name: string; title: string | null; placeId: string | null; mapsUri: string | null; newReviewUri: string | null }

/** 这个 Google 账号能管的所有账号 + 门店。某个账号列门店失败不影响别的。 */
export async function discoverLocations(token: string): Promise<{ accounts: GbpAccount[]; locations: GbpLocation[]; errors: string[] }> {
  const accounts: GbpAccount[] = []
  let pageToken = ""
  for (let i = 0; i < 5; i++) {
    const q = new URLSearchParams({ pageSize: "20" })
    if (pageToken) q.set("pageToken", pageToken)
    const j = await gapi<{ accounts?: Array<{ name?: string; accountName?: string; type?: string; role?: string }>; nextPageToken?: string }>(token, `${ACCOUNTS_URL}?${q}`)
    for (const a of j.accounts ?? []) if (a.name) accounts.push({ name: a.name, accountName: a.accountName ?? null, type: a.type ?? null, role: a.role ?? null })
    if (!j.nextPageToken) break
    pageToken = j.nextPageToken
  }
  const locations: GbpLocation[] = []
  const errors: string[] = []
  const seen = new Set<string>()
  for (const a of accounts.slice(0, 10)) {
    let lt = ""
    try {
      for (let i = 0; i < 5; i++) {
        const q = new URLSearchParams({ readMask: "name,title,metadata", pageSize: "100" })
        if (lt) q.set("pageToken", lt)
        const j = await gapi<{ locations?: Array<{ name?: string; title?: string; metadata?: { placeId?: string; mapsUri?: string; newReviewUri?: string } }>; nextPageToken?: string }>(token, `${BIZINFO_URL}/${a.name}/locations?${q}`)
        for (const l of j.locations ?? []) {
          if (!l.name || seen.has(l.name)) continue
          seen.add(l.name)
          locations.push({ account: a.name, name: l.name, title: l.title ?? null, placeId: l.metadata?.placeId ?? null, mapsUri: l.metadata?.mapsUri ?? null, newReviewUri: l.metadata?.newReviewUri ?? null })
        }
        if (!j.nextPageToken) break
        lt = j.nextPageToken
      }
    } catch (e) {
      // 列账号能过、列门店报"API 没启用"的话要让老板知道，不能吞
      if (e instanceof GbpError && e.reason === "SERVICE_DISABLED") throw e
      errors.push(`${a.name}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200))
    }
  }
  return { accounts, locations, errors }
}

/** 认门店：Place ID 对上的优先；只有一家就是它；多家又对不上就让老板选。 */
export function pickLocation(locations: GbpLocation[], placeId = OUR_PLACE_ID): GbpLocation | null {
  return locations.find((l) => l.placeId === placeId) ?? (locations.length === 1 ? locations[0] : null)
}

export type GbpReview = {
  name?: string
  reviewId?: string
  reviewer?: { displayName?: string; isAnonymous?: boolean; profilePhotoUrl?: string }
  starRating?: string
  comment?: string
  createTime?: string
  updateTime?: string
  reviewReply?: { comment?: string; updateTime?: string; reviewReplyState?: string; policyViolation?: string }
  reviewMediaItems?: Array<{ thumbnailUrl?: string; thumbnailLabel?: string; videoUrl?: string }>
  reviewReplyUrl?: string
}

/** 一家店的全部评价（v4，一页最多 50 条，翻到底；保险起见最多 40 页）。 */
export async function listAllReviews(token: string, account: string, location: string): Promise<{ reviews: GbpReview[]; total: number | null; average: number | null }> {
  const reviews: GbpReview[] = []
  let total: number | null = null
  let average: number | null = null
  let pageToken = ""
  for (let i = 0; i < 40; i++) {
    const q = new URLSearchParams({ pageSize: "50" })
    if (pageToken) q.set("pageToken", pageToken)
    const j = await gapi<{ reviews?: GbpReview[]; totalReviewCount?: number; averageRating?: number; nextPageToken?: string }>(token, `${V4_URL}/${account}/${location}/reviews?${q}`)
    reviews.push(...(j.reviews ?? []))
    if (typeof j.totalReviewCount === "number") total = j.totalReviewCount
    if (typeof j.averageRating === "number") average = j.averageRating
    if (!j.nextPageToken) break
    pageToken = j.nextPageToken
  }
  return { reviews, total, average }
}

/** 回复评价（没回过就新建，回过就覆盖）。公开可见——只能由老板在工作台点。 */
export async function putReply(token: string, account: string, location: string, reviewId: string, comment: string) {
  return gapi<{ comment?: string; updateTime?: string; reviewReplyState?: string }>(token, `${V4_URL}/${account}/${location}/reviews/${encodeURIComponent(reviewId)}/reply`, {
    method: "PUT",
    body: { comment },
  })
}

/** 回复内容检查：不能空，Google 上限 4096 字节（UTF-8，中文一个字 3 字节）。 */
export function checkReply(v: unknown): { ok: true; text: string } | { ok: false; error: string } {
  const text = typeof v === "string" ? v.replace(/\r\n/g, "\n").trim() : ""
  if (!text) return { ok: false, error: "回复不能是空的" }
  const bytes = Buffer.byteLength(text, "utf8")
  if (bytes > 4096) return { ok: false, error: `太长了：${bytes} 字节，Google 上限 4096` }
  return { ok: true, text }
}

// ------------------------------------------------------------ review mapping

const STARS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }
export const starNumber = (s: string | undefined) => (s && STARS[s] ? STARS[s] : null)

/** createTime（UTC）→ 洛杉矶日期 YYYY-MM-DD，和台账其余日期一个口径。 */
export const ptDate = (iso: string | undefined) => (iso && !Number.isNaN(Date.parse(iso)) ? new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }) : null)

export const gbpReviewId = (v: GbpReview) => v.reviewId || (v.name ?? "").split("/").pop() || ""
