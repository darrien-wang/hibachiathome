import { type NextRequest, NextResponse } from "next/server"
import { COMPETITORS, META_AD_QUERIES, REVIEWS_PER_COMPETITOR } from "@/config/competitor-watch"
import { can, resolveAdminActor } from "@/lib/admin-auth"
import { buildReport, pickSoCalAds, summarizeGoogleAds, summarizeReviews, type GoogleAdRaw, type MetaAdRaw, type ReviewRaw } from "@/lib/competitor-watch"
import { CRON_PURPOSE_COMPETITOR_WATCH, isCronCall } from "@/lib/cron-key"
import { escapeHtml } from "@/lib/escape-html"
import { monidEnabled, monidFound, monidList, monidRun } from "@/lib/monid"
import { sendSupportNotificationEmail } from "@/lib/ops-notifications"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// Weekly competitor watch (2026-10-21, owner: "开始做吧" for the three Monid
// jobs). Monday 09:00 PT by pg_cron (competitor-watch-weekly) with the derived
// key, or by hand from the workbench (board permission). ?dry=1 builds the
// report without storing or mailing it.
//
//   Meta Ad Library  anyapi /facebook.ads_search     3 queries, US, newest first
//   Google Ads       anyapi /google_ads.company_ads  one call per competitor domain
//   Google reviews   litescrape /google/reviews      newest 20 per place_id
//
// All calls run at once (about 15 s wall clock, about $0.01 a week). Only
// reads; nothing is posted anywhere.

type LiteReviews = { place_info?: { title?: string; rating?: number; reviews?: number }; reviews?: ReviewRaw[] }
const RUN = { timeoutMs: 40_000 }

function weekOf(now = new Date()): string {
  // The Monday of the week the report is produced in, Pacific.
  const pt = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }))
  pt.setDate(pt.getDate() - ((pt.getDay() + 6) % 7))
  return pt.toISOString().slice(0, 10)
}

async function run(dry: boolean) {
  const errors: string[] = []
  let cost = 0
  const add = (c: number | null) => {
    cost += c ?? 0
  }
  const withDomain = COMPETITORS.filter((c): c is typeof c & { domain: string } => Boolean(c.domain))
  const withPlace = COMPETITORS.filter((c): c is typeof c & { placeId: string } => Boolean(c.placeId))

  const [metas, gads, revs] = await Promise.all([
    Promise.all(META_AD_QUERIES.map((query) => monidRun("anyapi", "/facebook.ads_search", { body: { query, country: "US", sortBy: "recent", status: "ACTIVE" } }, RUN))),
    Promise.all(withDomain.map((c) => monidRun("anyapi", "/google_ads.company_ads", { body: { domain: c.domain, region: "US" } }, RUN))),
    Promise.all(withPlace.map((c) => monidRun<LiteReviews>("litescrape", "/google/reviews", { queryParams: { place_id: c.placeId, sort_by: "newestFirst", num: REVIEWS_PER_COMPETITOR } }, RUN))),
  ])

  // Meta Ad Library: merge the queries, the plain "hibachi" one carries the national total.
  const rawAds: MetaAdRaw[] = []
  let metaTotal: number | null = null
  metas.forEach((r, i) => {
    if (!r.ok) {
      errors.push(`Meta 广告库「${META_AD_QUERIES[i]}」: ${r.error}`)
      return
    }
    add(r.cost)
    rawAds.push(...monidList<MetaAdRaw>(r.output, "ads"))
    if (META_AD_QUERIES[i] === "hibachi") {
      const total = (r.output as { data?: { totalResults?: number } } | null)?.data?.totalResults
      metaTotal = typeof total === "number" ? total : null
    }
  })
  const metaAds = pickSoCalAds(rawAds)

  const googleAds = gads.map((r, i) => {
    const c = withDomain[i]
    if (!r.ok) return summarizeGoogleAds(c.name, c.domain, [], { error: r.error })
    add(r.cost)
    return summarizeGoogleAds(c.name, c.domain, monidList<GoogleAdRaw>(r.output, "ads"), { found: monidFound(r.output) })
  })

  const reviews = revs.map((r, i) => {
    const c = withPlace[i]
    if (!r.ok) return summarizeReviews(c.name, [], {}, Date.now(), r.error)
    add(r.cost)
    return summarizeReviews(c.name, r.output?.reviews ?? [], { rating: r.output?.place_info?.rating ?? null, votes: r.output?.place_info?.reviews ?? null })
  })

  const week = weekOf()
  const report = buildReport({ weekOf: week, metaAds, metaTotal, googleAds, reviews, errors, cost })
  const complaints = reviews.reduce((n, r) => n + r.complaints.length, 0)

  if (!dry) {
    const supabase = getSupabaseAdmin()
    if (supabase) {
      const { error } = await supabase.from("competitor_watch_reports").insert({ week_of: week, report_md: report, raw: { metaAds, metaTotal, googleAds, reviews, errors }, cost })
      if (error) errors.push(`store: ${error.message}`)
    }
    await sendSupportNotificationEmail({
      subject: `📊 同行周报 ${week} · 南加 Meta 广告 ${metaAds.length} 条 · 新差评 ${complaints} 条`,
      text: report,
      html: `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap;font-size:14px;line-height:1.5">${escapeHtml(report)}</pre>`,
    }).catch((e) => errors.push(`email: ${e instanceof Error ? e.message : String(e)}`))
  }
  return { ok: errors.length === 0, dry, weekOf: week, cost, metaAds: metaAds.length, metaTotal, googleAds: googleAds.length, reviews: reviews.length, complaints, errors, report }
}

export async function GET(request: NextRequest) {
  if (!isCronCall(request, CRON_PURPOSE_COMPETITOR_WATCH)) {
    const actor = await resolveAdminActor(request)
    if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
    if (!can(actor, "board")) return NextResponse.json({ ok: false, error: "没有看板权限" }, { status: 403 })
  }
  if (!monidEnabled()) return NextResponse.json({ ok: false, error: "MONID_API_KEY not set" })
  const dry = request.nextUrl.searchParams.get("dry") === "1"
  try {
    return NextResponse.json(await run(dry))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[competitor-watch] failed", message)
    return NextResponse.json({ ok: false, error: message })
  }
}
