// 一轮监听：拉各组版块的新帖 + 全站搜索，分级，去重，交给调用方入库。
// 这里不碰数据库，所以 scripts/reddit-watch-dry.ts 可以在本机干跑看命中。

import { REDDIT_GLOBAL_SEARCH, REDDIT_MAX_POST_AGE_HOURS, REDDIT_NATIONAL_SUBS, REDDIT_RSS_GAP_MS, REDDIT_WATCH_GROUPS, type RedditWatchGroup } from "@/config/reddit-watch"
import { fetchNewPosts, redditMode, searchPosts, type RedditMode, type RedditPost } from "./fetch"
import { classifyPost, looksSoCal } from "./match"

export type Candidate = RedditPost & { tier: 1 | 2; keywords: string[]; source: "feed" | "search" }

export type GroupResult = { name: string; ok: boolean; status: number; error?: string; posts: number }

export type CollectResult = {
  mode: RedditMode
  /** 看过的帖子数（各组 + 搜索，去重后） */
  fetched: number
  candidates: Candidate[]
  errors: string[]
  /** 每组这一轮抓没抓到，路由拿去记健康度 */
  groups: GroupResult[]
}

const SLOT_MS = 20 * 60_000
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * opts.groups 给定时只抓这几组（线上路由在 RSS 模式下每轮只给一组）；不给时抓全部组，
 * 组间歇 REDDIT_RSS_GAP_MS（本机干跑用）。
 */
export async function collectCandidates(opts: { groups?: RedditWatchGroup[]; gapMs?: number } = {}): Promise<CollectResult> {
  const mode = redditMode()
  const errors: string[] = []
  const groups: GroupResult[] = []
  const seen = new Set<string>()
  const candidates: Candidate[] = []
  const nationalSubs = new Set(REDDIT_NATIONAL_SUBS.map((s) => s.toLowerCase()))
  const localSubs = new Set(REDDIT_WATCH_GROUPS.flatMap((g) => g.subs.map((s) => s.toLowerCase())).filter((s) => !nationalSubs.has(s)))
  const cutoff = Date.now() - REDDIT_MAX_POST_AGE_HOURS * 3600_000
  let fetched = 0

  const consider = (p: RedditPost, source: Candidate["source"]) => {
    if (seen.has(p.id)) return
    seen.add(p.id)
    fetched += 1
    if (Date.parse(p.postedAt) < cutoff) return
    const m = classifyPost(p.title, p.body)
    if (m.tier === 0) return
    // 全站搜索和全国性版块的帖子，得提到南加地名（或本身发在南加版块）才留。
    const needsGeo = source === "search" || nationalSubs.has(p.subreddit.toLowerCase())
    if (needsGeo && !looksSoCal(p.subreddit, p.title, p.body, localSubs)) return
    candidates.push({ ...p, tier: m.tier, keywords: m.keywords, source })
  }

  // 未登录的公开流：同一 IP 连着发第二个请求常被限流，所以抓多组时组间歇一下，
  // 并且每 20 分钟换一次谁先抓——固定顺序会让同一组永远排在挨限流的位置。
  const slot = Math.floor(Date.now() / SLOT_MS)
  const all = opts.groups ?? REDDIT_WATCH_GROUPS
  const order = opts.groups ? all : all.map((_, i) => all[(i + slot) % all.length])
  const gap = opts.gapMs ?? (mode === "rss" ? REDDIT_RSS_GAP_MS : 0)

  for (let i = 0; i < order.length; i++) {
    const group = order[i]
    if (i > 0 && gap > 0) await sleep(gap)
    const r = await fetchNewPosts(group.subs)
    if (!r.ok) {
      errors.push(`${group.name}: ${r.error}`)
      groups.push({ name: group.name, ok: false, status: r.status, error: r.error, posts: 0 })
      continue
    }
    groups.push({ name: group.name, ok: true, status: 200, posts: r.posts.length })
    for (const p of r.posts) consider(p, "feed")
  }

  if (mode === "oauth") {
    const r = await searchPosts(REDDIT_GLOBAL_SEARCH.query, REDDIT_GLOBAL_SEARCH.limit)
    if (!r.ok) errors.push(`search: ${r.error}`)
    else for (const p of r.posts) consider(p, "search")
  }

  candidates.sort((a, b) => a.tier - b.tier || Date.parse(b.postedAt) - Date.parse(a.postedAt))
  return { mode, fetched, candidates, errors, groups }
}
