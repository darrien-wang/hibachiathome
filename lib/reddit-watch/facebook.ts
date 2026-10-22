// Facebook public posts, the same way the Reddit groups work: find people
// asking for a hibachi-at-home recommendation, file them in reddit_mentions,
// let a person answer (2026-10-21). Runs through Monid
// (anyapi /facebook.search_posts, $0.00324 per result), so it runs once a day
// with a handful of queries and only when MONID_API_KEY is set. Nothing here
// posts, likes or messages anyone.
//
// Most of what the search returns is competitors' own marketing ("A Let's
// Hibachi chef brings the grill..."), so unlike a subreddit feed a post has to
// read like a question from a person, and the author must not be a business.

import { COMPETITORS } from "@/config/competitor-watch"
import { FACEBOOK_WATCH_LIMIT, FACEBOOK_WATCH_QUERIES, FACEBOOK_WATCH_SINCE_DAYS, REDDIT_MAX_POST_AGE_HOURS } from "@/config/reddit-watch"
import { monidEnabled, monidList, monidRun } from "@/lib/monid"
import type { RedditPost } from "./fetch"
import { classifyPost, looksSoCal } from "./match"
import type { Candidate } from "./run"

/** One post as anyapi /facebook.search_posts returns it. */
export type FacebookRaw = {
  id?: string | number
  authorName?: string
  authorUrl?: string
  text?: string
  url?: string
  createdUtc?: number
  type?: string
}

/** One Facebook post in the shape the classifier and reddit_mentions expect. */
export function facebookToPost(raw: FacebookRaw): RedditPost | null {
  const id = raw.id != null && String(raw.id).trim() ? `fb_${String(raw.id).trim()}` : null
  const text = (raw.text ?? "").replace(/\r/g, "").trim()
  if (!id || !text || !raw.url) return null
  const firstLine = text.split("\n").map((s) => s.trim()).find(Boolean) ?? text
  return {
    id,
    subreddit: "facebook",
    title: firstLine.slice(0, 200),
    body: text.slice(0, 8000),
    author: (raw.authorName ?? "").trim(),
    url: raw.url,
    postedAt: new Date((raw.createdUtc ?? Date.now() / 1000) * 1000).toISOString(),
  }
}

// A business posting about itself: a link, a hashtag wall, or selling words.
const PROMO =
  /https?:\/\/|\bwww\.|(?:#\w+\W*){3,}|\b(book now|now booking|booking now|we serve|we bring|we offer|our chefs?|dm us|dm me|message us|contact us|call us|text us|link in bio|limited spots|spots (?:are )?(?:filling|available|left)|reserve your|get a quote|free quote|special offer|discount code|promo code|follow us)\b/i
// Account names that are businesses, not people.
const BUSINESS_AUTHOR = /\b(hibachi|teppanyaki|cater\w*|chefs?|grill\w*|eats|kitchen|events?|catering|cuisine|llc|inc)\b/i
// Someone asking.
const ASK = /\?|\b(anyone|any one|anybody|any recs?|recommend\w*|suggestions?|looking for|in search of|iso|does anyone|know (?:of )?(?:a|any|anyone|someone)|who (?:does|do you|has|is)|where can|need (?:a|some|an)|help me find|is there a|has anyone)\b/i

export type FacebookDrop = "competitor" | "business" | "promo" | "not_ask" | "old" | "offtopic" | "geo"

/** Why a Facebook post is not a lead, or null when it reads like a person asking. */
export function facebookDropReason(p: RedditPost, now = Date.now(), competitors = COMPETITORS): FacebookDrop | null {
  if (Date.parse(p.postedAt) < now - REDDIT_MAX_POST_AGE_HOURS * 3600_000) return "old"
  const text = `${p.title}\n${p.body}`
  const author = p.author.toLowerCase()
  const lower = text.toLowerCase()
  if (competitors.some((c) => c.aliases.some((a) => author.includes(a)) || (c.domain ? lower.includes(c.domain) : false))) return "competitor"
  if (BUSINESS_AUTHOR.test(p.author)) return "business"
  if (PROMO.test(text)) return "promo"
  if (!ASK.test(text)) return "not_ask"
  if (classifyPost(p.title, p.body).tier === 0) return "offtopic"
  if (!looksSoCal(p.subreddit, p.title, p.body, new Set())) return "geo"
  return null
}

/** The posts worth a person's look, as candidates with source "facebook", plus a tally of what was dropped and why. */
export function facebookCandidates(posts: RedditPost[], now = Date.now()): { candidates: Candidate[]; dropped: Partial<Record<FacebookDrop, number>> } {
  const candidates: Candidate[] = []
  const dropped: Partial<Record<FacebookDrop, number>> = {}
  for (const p of posts) {
    const why = facebookDropReason(p, now)
    if (why) {
      dropped[why] = (dropped[why] ?? 0) + 1
      continue
    }
    const m = classifyPost(p.title, p.body)
    candidates.push({ ...p, tier: m.tier === 0 ? 2 : m.tier, keywords: m.keywords, source: "facebook" })
  }
  return { candidates, dropped }
}

export type FacebookFetch = { ok: boolean; posts: RedditPost[]; errors: string[]; cost: number; queries: number }

/** Every configured query at once (each takes about 30 s), merged and de-duplicated. */
export async function fetchFacebookPosts(opts: { queries?: string[]; limit?: number; sinceDays?: number; timeoutMs?: number } = {}): Promise<FacebookFetch> {
  if (!monidEnabled()) return { ok: false, posts: [], errors: ["MONID_API_KEY not set"], cost: 0, queries: 0 }
  const queries = opts.queries ?? FACEBOOK_WATCH_QUERIES
  const limit = opts.limit ?? FACEBOOK_WATCH_LIMIT
  const startDate = new Date(Date.now() - (opts.sinceDays ?? FACEBOOK_WATCH_SINCE_DAYS) * 86400_000).toISOString().slice(0, 10)
  // p50 33 s / p95 44 s per query (monid metrics, 2026-10-21); the route has 60 s.
  const results = await Promise.all(queries.map((query) => monidRun("anyapi", "/facebook.search_posts", { body: { query, limit, startDate } }, { timeoutMs: opts.timeoutMs ?? 45_000 })))
  const seen = new Set<string>()
  const posts: RedditPost[] = []
  const errors: string[] = []
  let cost = 0
  results.forEach((r, i) => {
    if (!r.ok) {
      errors.push(`${queries[i]}: ${r.error}`)
      return
    }
    cost += r.cost ?? 0
    for (const raw of monidList<FacebookRaw>(r.output, "items", "posts")) {
      const p = facebookToPost(raw)
      if (!p || seen.has(p.id)) continue
      seen.add(p.id)
      posts.push(p)
    }
  })
  return { ok: errors.length < queries.length, posts, errors, cost, queries: queries.length }
}
