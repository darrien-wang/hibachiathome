// The pure half of the weekly competitor watch: pick what matters out of the
// provider payloads and write the report. No network here, so it is testable
// with fixtures; the route (app/api/admin/competitor-watch) does the calls.

import { COMPETITORS, COMPLAINT_MAX_RATING, SOCAL_ABBR_RE, SOCAL_PLACES_RE, WATCH_WINDOW_DAYS, type Competitor } from "@/config/competitor-watch"

/** One ad as anyapi /facebook.ads_search returns it (dates are unix seconds). */
export type MetaAdRaw = {
  id?: string
  pageName?: string
  pageUrl?: string
  text?: string
  title?: string
  ctaText?: string
  linkUrl?: string
  startDate?: number | string
  platforms?: string[]
  adCount?: number
  active?: boolean
}

export type MetaAd = { id: string; pageName: string; text: string; cta: string; link: string; since: string | null; adCount: number; competitor: string | null }

/** One creative as anyapi /google_ads.company_ads returns it. */
export type GoogleAdRaw = { adUrl?: string; format?: string; firstShown?: string | number; lastShown?: string | number; creativeId?: string }
export type GoogleAds = { competitor: string; domain: string; found: boolean; count: number; newest: string | null; sample: string | null; error?: string }

/** One review as litescrape /google/reviews returns it. */
export type ReviewRaw = { iso_date?: string; snippet?: string | null; rating?: number; user?: { name?: string } }
export type ReviewWatch = { competitor: string; rating: number | null; votes: number | null; newInWindow: number; complaints: Array<{ rating: number; date: string; text: string }>; error?: string }

const oneLine = (s: string | undefined | null, max = 160) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, max)
const day = (v: number | string | undefined | null): string | null => {
  if (v == null || v === "") return null
  const ms = typeof v === "number" ? (v > 1e12 ? v : v * 1000) : Date.parse(String(v))
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : null
}

/** Which configured competitor a page name / text / link belongs to, if any. */
export function matchCompetitor(parts: Array<string | undefined | null>, competitors: Competitor[] = COMPETITORS): string | null {
  const hay = parts.filter(Boolean).join(" \n ").toLowerCase()
  if (!hay) return null
  for (const c of competitors) {
    if (c.domain && hay.includes(c.domain)) return c.name
    if (c.aliases.some((a) => hay.includes(a))) return c.name
  }
  return null
}

/** Meta Ad Library hits that are about Southern California or a known competitor, newest first, one line per page+copy. */
export function pickSoCalAds(raw: MetaAdRaw[], competitors: Competitor[] = COMPETITORS, ourPage = "real hibachi"): MetaAd[] {
  const out: MetaAd[] = []
  const seen = new Set<string>()
  for (const a of raw) {
    const pageName = oneLine(a.pageName, 80)
    if (!pageName || pageName.toLowerCase() === ourPage) continue
    const text = oneLine(a.text || a.title, 220)
    const link = oneLine(a.linkUrl, 120)
    const competitor = matchCompetitor([pageName, text, link, a.pageUrl], competitors)
    const socal = competitor != null || SOCAL_PLACES_RE.test(`${pageName} ${text} ${link}`) || SOCAL_ABBR_RE.test(`${pageName} ${text}`)
    if (!socal) continue
    const key = `${pageName.toLowerCase()}|${text.slice(0, 60)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ id: String(a.id ?? key), pageName, text, cta: oneLine(a.ctaText, 40), link, since: day(a.startDate), adCount: typeof a.adCount === "number" ? a.adCount : 1, competitor })
  }
  return out.sort((x, y) => (y.since ?? "").localeCompare(x.since ?? "") || x.pageName.localeCompare(y.pageName))
}

/** One competitor's Google Ads Transparency rows -> a line of the report. found=false means the Center has no such advertiser. */
export function summarizeGoogleAds(competitor: string, domain: string, raw: GoogleAdRaw[], opts: { found?: boolean; error?: string } = {}): GoogleAds {
  if (opts.error) return { competitor, domain, found: false, count: 0, newest: null, sample: null, error: opts.error }
  if (opts.found === false) return { competitor, domain, found: false, count: 0, newest: null, sample: null }
  const dates = raw.map((r) => day(r.lastShown) ?? day(r.firstShown)).filter((d): d is string => Boolean(d)).sort()
  const sample = raw.find((r) => r.adUrl)?.adUrl ?? null
  return { competitor, domain, found: true, count: raw.length, newest: dates.length ? dates[dates.length - 1] : null, sample: sample ? oneLine(sample, 120) : null }
}

/** One competitor's newest Google reviews -> how many came in this week and which are complaints. */
export function summarizeReviews(competitor: string, raw: ReviewRaw[], meta: { rating?: number | null; votes?: number | null }, now = Date.now(), error?: string): ReviewWatch {
  if (error) return { competitor, rating: meta.rating ?? null, votes: meta.votes ?? null, newInWindow: 0, complaints: [], error }
  const cutoff = now - WATCH_WINDOW_DAYS * 86400_000
  let newInWindow = 0
  const complaints: ReviewWatch["complaints"] = []
  for (const r of raw) {
    const ts = r.iso_date ? Date.parse(r.iso_date) : NaN
    if (!Number.isFinite(ts) || ts < cutoff) continue
    newInWindow += 1
    if (typeof r.rating === "number" && r.rating <= COMPLAINT_MAX_RATING) complaints.push({ rating: r.rating, date: new Date(ts).toISOString().slice(0, 10), text: oneLine(r.snippet, 300) || "(no text)" })
  }
  return { competitor, rating: meta.rating ?? null, votes: meta.votes ?? null, newInWindow, complaints }
}

export type ReportInput = {
  weekOf: string
  metaAds: MetaAd[]
  metaTotal: number | null
  googleAds: GoogleAds[]
  reviews: ReviewWatch[]
  errors: string[]
  cost: number
}

/** The Monday report, Markdown, short enough to read on a phone. */
export function buildReport(input: ReportInput): string {
  const lines: string[] = []
  lines.push(`# 同行周报 · ${input.weekOf}`)
  lines.push("")
  lines.push(`## Meta 广告库（搜 hibachi，南加相关 ${input.metaAds.length} 条${input.metaTotal != null ? `，全美在跑 ${input.metaTotal} 条` : ""}）`)
  if (!input.metaAds.length) lines.push("- 本周没有南加相关的 hibachi 广告在跑")
  for (const a of input.metaAds.slice(0, 25)) {
    lines.push(`- **${a.pageName}**${a.competitor ? `（${a.competitor}）` : ""}${a.since ? ` · 自 ${a.since}` : ""}${a.adCount > 1 ? ` · ${a.adCount} 条` : ""}${a.cta ? ` · [${a.cta}]` : ""}：${a.text || "（无文案）"}`)
  }
  lines.push("")
  lines.push("## Google 广告透明中心（按同行域名）")
  if (!input.googleAds.length) lines.push("- 没有配置域名的同行")
  for (const g of input.googleAds) {
    if (g.error) lines.push(`- ${g.competitor}（${g.domain}）：查询失败 ${g.error}`)
    else if (!g.found) lines.push(`- ${g.competitor}（${g.domain}）：透明中心没有这个广告主`)
    else lines.push(`- ${g.competitor}（${g.domain}）：${g.count} 条广告${g.newest ? `，最近展示 ${g.newest}` : ""}${g.sample ? ` · ${g.sample}` : ""}`)
  }
  lines.push("")
  lines.push(`## Google 评价（最近 ${WATCH_WINDOW_DAYS} 天）`)
  for (const r of input.reviews) {
    const head = `- ${r.competitor}${r.rating != null ? ` ${r.rating}★` : ""}${r.votes != null ? `×${r.votes}` : ""}：`
    if (r.error) lines.push(`${head}查询失败 ${r.error}`)
    else if (!r.complaints.length) lines.push(`${head}新评价 ${r.newInWindow} 条，没有 ≤${COMPLAINT_MAX_RATING}★`)
    else {
      lines.push(`${head}新评价 ${r.newInWindow} 条，差评 ${r.complaints.length} 条`)
      for (const c of r.complaints) lines.push(`  - [${c.rating}★ ${c.date}] ${c.text}`)
    }
  }
  if (input.errors.length) {
    lines.push("")
    lines.push("## 本次没拿到的")
    for (const e of input.errors) lines.push(`- ${e}`)
  }
  lines.push("")
  lines.push(`_数据来源 monid（Meta Ad Library / Google Ads Transparency / Google Maps），本次花费约 $${input.cost.toFixed(3)}_`)
  return lines.join("\n")
}
