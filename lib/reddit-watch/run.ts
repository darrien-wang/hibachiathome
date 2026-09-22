// 一轮监听：拉各组版块的新帖 + 全站搜索，分级，去重，交给调用方入库。
// 这里不碰数据库，所以 scripts/reddit-watch-dry.ts 可以在本机干跑看命中。

import { REDDIT_GLOBAL_SEARCH, REDDIT_MAX_POST_AGE_HOURS, REDDIT_WATCH_GROUPS } from "@/config/reddit-watch"
import { fetchNewPosts, redditMode, searchPosts, type RedditMode, type RedditPost } from "./fetch"
import { classifyPost, looksSoCal } from "./match"

export type Candidate = RedditPost & { tier: 1 | 2; keywords: string[]; source: "feed" | "search" }

export type CollectResult = {
  mode: RedditMode
  /** 看过的帖子数（各组 + 搜索，去重后） */
  fetched: number
  candidates: Candidate[]
  errors: string[]
}

export async function collectCandidates(): Promise<CollectResult> {
  const mode = redditMode()
  const errors: string[] = []
  const seen = new Set<string>()
  const candidates: Candidate[] = []
  const knownSubs = new Set(REDDIT_WATCH_GROUPS.flatMap((g) => g.subs.map((s) => s.toLowerCase())))
  const cutoff = Date.now() - REDDIT_MAX_POST_AGE_HOURS * 3600_000
  let fetched = 0

  const consider = (p: RedditPost, source: Candidate["source"]) => {
    if (seen.has(p.id)) return
    seen.add(p.id)
    fetched += 1
    if (Date.parse(p.postedAt) < cutoff) return
    const m = classifyPost(p.title, p.body)
    if (m.tier === 0) return
    if (source === "search" && !looksSoCal(p.subreddit, p.title, p.body, knownSubs)) return
    candidates.push({ ...p, tier: m.tier, keywords: m.keywords, source })
  }

  for (const group of REDDIT_WATCH_GROUPS) {
    const r = await fetchNewPosts(group.subs)
    if (!r.ok) {
      errors.push(`${group.name}: ${r.error}`)
      continue
    }
    for (const p of r.posts) consider(p, "feed")
  }

  if (mode === "oauth") {
    const r = await searchPosts(REDDIT_GLOBAL_SEARCH.query, REDDIT_GLOBAL_SEARCH.limit)
    if (!r.ok) errors.push(`search: ${r.error}`)
    else for (const p of r.posts) consider(p, "search")
  }

  candidates.sort((a, b) => a.tier - b.tier || Date.parse(b.postedAt) - Date.parse(a.postedAt))
  return { mode, fetched, candidates, errors }
}
