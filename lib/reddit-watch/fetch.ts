// 从 Reddit 取新帖。两条路，自动选：
//
//   rss    现在实际在用：公开的 .rss 流，和 Feedly 之类的订阅器一样。未登录会被
//          Reddit 按突发限流，偶发 429 就等下一轮（run.ts 错开两组、路由记健康度）。
//   oauth  设了 REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET 才走官方 API。**暂时用不上**：
//          Reddit 从 2025-11（Responsible Builder Policy）起所有 API 应用都要先
//          人工审批、商用要书面批准，2026-09-22 用户在 prefs/apps 点 create app
//          直接被挡。代码留着，哪天拿到批准只需加两个 env。
//
// 两条路都只读，不登录任何账号，不发任何东西。

import { REDDIT_USER_AGENT } from "@/config/reddit-watch"

export type RedditPost = {
  /** Reddit fullname，形如 t3_1abc2de */
  id: string
  subreddit: string
  title: string
  body: string
  author: string
  url: string
  postedAt: string
}

export type RedditMode = "oauth" | "rss"
export type FetchResult = { ok: true; mode: RedditMode; posts: RedditPost[] } | { ok: false; mode: RedditMode; status: number; error: string }

const OAUTH_BASE = "https://oauth.reddit.com"
const TOKEN_URL = "https://www.reddit.com/api/v1/access_token"
const RSS_BASE = "https://www.reddit.com"
// 公开 RSS 用浏览器 UA 才不被当脚本挡；官方 API 用注册过的 UA。
const RSS_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"

function credentials(): { id: string; secret: string } | null {
  const id = process.env.REDDIT_CLIENT_ID?.trim()
  const secret = process.env.REDDIT_CLIENT_SECRET?.trim()
  return id && secret ? { id, secret } : null
}

export function redditMode(): RedditMode {
  return credentials() ? "oauth" : "rss"
}

let tokenCache: { token: string; expiresAt: number } | null = null

async function appToken(): Promise<string> {
  const c = credentials()
  if (!c) throw new Error("reddit credentials missing")
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${c.id}:${c.secret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": REDDIT_USER_AGENT,
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`reddit token ${res.status}`)
  const json = (await res.json()) as { access_token?: string; expires_in?: number }
  if (!json.access_token) throw new Error("reddit token response had no access_token")
  tokenCache = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 }
  return json.access_token
}

type ListingChild = {
  data?: {
    name?: string
    id?: string
    subreddit?: string
    title?: string
    selftext?: string
    author?: string
    permalink?: string
    created_utc?: number
    over_18?: boolean
  }
}

function parseListing(json: unknown): RedditPost[] {
  const children = ((json as { data?: { children?: ListingChild[] } })?.data?.children ?? []) as ListingChild[]
  const out: RedditPost[] = []
  for (const c of children) {
    const d = c.data
    if (!d?.id || !d.title || !d.subreddit) continue
    if (d.over_18) continue
    out.push({
      id: d.name ?? `t3_${d.id}`,
      subreddit: d.subreddit,
      title: d.title,
      body: (d.selftext ?? "").slice(0, 8000),
      author: d.author ?? "",
      url: `https://www.reddit.com${d.permalink ?? `/comments/${d.id}/`}`,
      postedAt: new Date((d.created_utc ?? Date.now() / 1000) * 1000).toISOString(),
    })
  }
  return out
}

async function oauthGet(path: string): Promise<FetchResult> {
  let token: string
  try {
    token = await appToken()
  } catch (e) {
    return { ok: false, mode: "oauth", status: 0, error: e instanceof Error ? e.message : String(e) }
  }
  const res = await fetch(`${OAUTH_BASE}${path}`, {
    headers: { authorization: `bearer ${token}`, "user-agent": REDDIT_USER_AGENT },
    cache: "no-store",
  })
  if (!res.ok) return { ok: false, mode: "oauth", status: res.status, error: `reddit api ${res.status}` }
  const json = (await res.json().catch(() => null)) as unknown
  if (!json) return { ok: false, mode: "oauth", status: res.status, error: "reddit api returned no json" }
  return { ok: true, mode: "oauth", posts: parseListing(json) }
}

// ---- RSS fallback -----------------------------------------------------------

const decodeEntities = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#32;/g, " ")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&")

const pick = (xml: string, re: RegExp) => re.exec(xml)?.[1] ?? ""

function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<br\s*\/?>|<\/p>|<\/li>|<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
}

export function parseAtom(xml: string): RedditPost[] {
  const out: RedditPost[] = []
  for (const raw of xml.split("<entry>").slice(1)) {
    const e = raw.split("</entry>")[0]
    const id = pick(e, /<id>([^<]+)<\/id>/).trim()
    const subreddit = pick(e, /<category term="([^"]+)"/)
    const title = decodeEntities(pick(e, /<title>([\s\S]*?)<\/title>/)).trim()
    if (!id || !subreddit || !title) continue
    const url = pick(e, /<link href="([^"]+)"/).replace(/&amp;/g, "&")
    const author = decodeEntities(pick(e, /<name>([^<]*)<\/name>/)).replace(/^\/?u\//, "")
    const postedAt = pick(e, /<published>([^<]+)<\/published>/) || pick(e, /<updated>([^<]+)<\/updated>/)
    // content 是转义过一次的 HTML；正文在 <div class="md"> 里，末尾跟着 "submitted by" 尾巴。
    const content = decodeEntities(pick(e, /<content type="html">([\s\S]*?)<\/content>/))
    const body = stripHtml(content).replace(/\s*submitted by\s+\/?u\/[\s\S]*$/i, "").trim()
    out.push({ id, subreddit, title, body: body.slice(0, 8000), author, url, postedAt: postedAt ? new Date(postedAt).toISOString() : new Date().toISOString() })
  }
  return out
}

async function rssGet(path: string): Promise<FetchResult> {
  const attempt = async (): Promise<FetchResult> => {
    const res = await fetch(`${RSS_BASE}${path}`, {
      headers: { "user-agent": RSS_USER_AGENT, accept: "application/atom+xml, application/rss+xml, text/xml;q=0.9, */*;q=0.8" },
      cache: "no-store",
    })
    if (!res.ok) return { ok: false, mode: "rss", status: res.status, error: `reddit rss ${res.status}` }
    const xml = await res.text()
    if (!xml.includes("<feed")) return { ok: false, mode: "rss", status: res.status, error: "reddit rss returned no feed" }
    return { ok: true, mode: "rss", posts: parseAtom(xml) }
  }
  const first = await attempt()
  if (first.ok || first.status !== 429) return first
  // 突发限流：歇 5 秒再试一次，还不行就等下一轮。
  await new Promise((r) => setTimeout(r, 5000))
  return attempt()
}

// ---- public API -------------------------------------------------------------

/** 一组版块的最新帖子（r/a+b+c 合并流）。 */
export async function fetchNewPosts(subs: string[], limit = 100): Promise<FetchResult> {
  const multi = subs.map((s) => s.trim()).filter(Boolean).join("+")
  if (!multi) return { ok: true, mode: redditMode(), posts: [] }
  return redditMode() === "oauth"
    ? oauthGet(`/r/${multi}/new?limit=${limit}&raw_json=1`)
    : rssGet(`/r/${multi}/new/.rss?limit=${limit}`)
}

/** 全站关键词搜索，按新排序。公开 search.rss 一碰就 429，所以只在 oauth 模式下提供。 */
export async function searchPosts(query: string, limit = 50): Promise<FetchResult> {
  if (redditMode() !== "oauth") return { ok: false, mode: "rss", status: 0, error: "search needs reddit api credentials" }
  return oauthGet(`/search?q=${encodeURIComponent(query)}&sort=new&t=week&type=link&limit=${limit}&raw_json=1`)
}
