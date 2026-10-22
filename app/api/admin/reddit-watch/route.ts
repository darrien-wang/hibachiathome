import { type NextRequest, NextResponse } from "next/server"
import { FACEBOOK_STATUS_GROUP, FACEBOOK_WATCH_EVERY_HOURS, REDDIT_FAIL_ALERT_STREAK, REDDIT_FAIL_REALERT_EVERY, REDDIT_WATCH_GROUPS, REDDIT_WATCH_HOURS_PT } from "@/config/reddit-watch"
import { resolveAdminActor } from "@/lib/admin-auth"
import { CRON_PURPOSE_REDDIT_WATCH, isCronCall } from "@/lib/cron-key"
import { escapeHtml } from "@/lib/escape-html"
import { monidEnabled } from "@/lib/monid"
import { sendSupportNotificationEmail } from "@/lib/ops-notifications"
import { facebookCandidates, fetchFacebookPosts, type FacebookFetch } from "@/lib/reddit-watch/facebook"
import { redditMode } from "@/lib/reddit-watch/fetch"
import { collectCandidates, type Candidate, type GroupResult } from "@/lib/reddit-watch/run"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// Reddit（+ Facebook 公开帖）监听。
//
//   GET            跑一轮：抓一组目标版块新帖 → 分级 → 新命中写 reddit_mentions →
//                  一档（直接问 hibachi/私厨）发一封提醒邮件。2026-10-21 起由
//                  Supabase pg_cron（reddit-watch-20min，派生钥匙 reddit-watch，
//                  见 lib/cron-key.ts）每 20 分钟调，07–24 PT 之外直接回
//                  quiet_hours；之前的桌面定时任务 10-04 起就没跑了。加 ?dry=1
//                  只看不写；?facebook=1 强制跑一次 Facebook 搜索。CRON_SECRET
//                  分支留给以后 Vercel 付费版。
//   GET ?list=1    工作台面板读列表（?status=new|replied|skipped|all）
//   PATCH          工作台标状态 { id, status, note? }
//
// 取数：设了 MONID_API_KEY 走 monid（anyapi 的 Reddit 合并流，$0.0008/次），否则
// 公开 RSS（Reddit 官方 API 自 2025-11 要人工审批，自助建应用已关，2026-09-22
// 用户实测被挡）。每轮只抓"最久没抓的那一组"：两组轮流，每组每 40 分钟一次，
// 远小于两组最新 100 帖约 12/25 小时的覆盖窗口。每组健康度记在
// reddit_watch_status：连续失败 6 次（约 4 小时）在返回里给 staleAlert，之后
// 每再失败 18 次再提醒。
//
// Facebook：每天第一轮顺带搜一次公开帖（lib/reddit-watch/facebook.ts，约 $0.10/
// 天），命中同样进 reddit_mentions（subreddit = "facebook"，id fb_…），健康度
// 记在 reddit_watch_status 的 facebook-search 行。
//
// 只做"发现"。绝不自动回帖、投票、私信、评论——Reddit/Facebook 上只能由人坦白
// 身份手动回（docs/竞对Reddit营销扫描-2026-09-22.md 记了为什么）。手机收件箱
// （/api/admin/mobile/inbox）另外把一档新命中当事件推出去响铃。

const STATUSES = new Set(["new", "replied", "skipped"])
const LIST_COLUMNS = "id, subreddit, title, body, author, url, posted_at, tier, keywords, source, status, note, found_at, handled_at"
// 面板只显示前 220 字；多存一点够判断，但不囤整帖。
const BODY_KEEP = 500

type StatusRow = {
  group_name: string
  created_at: string
  last_attempt_at: string | null
  last_ok_at: string | null
  last_status: number | null
  last_error: string | null
  alerted_at: string | null
  fail_streak: number
}
type StaleGroup = { group: string; label: string; failStreak: number; hoursSinceOk: number | null; lastError: string | null }
type Supabase = NonNullable<ReturnType<typeof getSupabaseAdmin>>

async function readStatus(supabase: Supabase): Promise<Map<string, StatusRow>> {
  const { data } = await supabase
    .from("reddit_watch_status")
    .select("*")
    .in("group_name", [...REDDIT_WATCH_GROUPS.map((g) => g.name), FACEBOOK_STATUS_GROUP])
  return new Map(((data ?? []) as StatusRow[]).map((r) => [r.group_name, r]))
}

/** 最久没抓的那一组（从没抓过的最先）。 */
function nextGroup(status: Map<string, StatusRow>) {
  return [...REDDIT_WATCH_GROUPS].sort((a, b) => {
    const ta = Date.parse(status.get(a.name)?.last_attempt_at ?? "") || 0
    const tb = Date.parse(status.get(b.name)?.last_attempt_at ?? "") || 0
    return ta - tb
  })[0]
}

/** 今天还没搜过 Facebook（上次是 23.5 小时之前，或从没搜过）。 */
function facebookDue(status: Map<string, StatusRow>, now: number): boolean {
  const last = status.get(FACEBOOK_STATUS_GROUP)?.last_attempt_at
  return !last || now - Date.parse(last) >= FACEBOOK_WATCH_EVERY_HOURS * 3600_000
}

const PT_HOUR = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hourCycle: "h23" })
/** 太平洋时间在不在定时任务的工作时段里（pg_cron 按 UTC 排，夏令时换算放这里做）。 */
function inWatchHours(now: number): boolean {
  const h = Number(PT_HOUR.format(now)) % 24
  return h >= REDDIT_WATCH_HOURS_PT.from && h < REDDIT_WATCH_HOURS_PT.to
}

function cronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  return (request.headers.get("authorization") ?? "") === `Bearer ${secret}`
}

const where = (c: { subreddit: string }) => (c.subreddit === "facebook" ? "Facebook" : `r/${c.subreddit}`)

const toRow = (c: Candidate) => ({
  id: c.id,
  subreddit: c.subreddit,
  title: c.title.slice(0, 300),
  body: c.body ? c.body.slice(0, BODY_KEEP) : null,
  author: c.author || null,
  url: c.url,
  posted_at: c.postedAt,
  tier: c.tier,
  keywords: c.keywords,
  source: c.source,
})

const brief = (c: Candidate) => ({ id: c.id, tier: c.tier, subreddit: c.subreddit, source: c.source, title: c.title, url: c.url, keywords: c.keywords, postedAt: c.postedAt })

async function notifyTier1(hits: Candidate[]): Promise<boolean> {
  const lines = hits.map((c) => `[${where(c)}] ${c.title}\n${c.url}`)
  const sites = new Set(hits.map((c) => (c.subreddit === "facebook" ? "Facebook" : "Reddit")))
  const subject = `${[...sites].join("/")} 有 ${hits.length} 条新询问待回 · ${where(hits[0])}`
  const text = ["有人在 Reddit / Facebook 上问 hibachi / 私厨，去工作台线索页看，回的时候坦白身份、不放链接。", "", ...lines].join("\n")
  const html = `<p>有人在 Reddit / Facebook 上问 hibachi / 私厨。去工作台线索页看，回的时候坦白身份、不放链接。</p><ul>${hits
    .map((c) => `<li><a href="${escapeHtml(c.url)}">${escapeHtml(c.title)}</a> <span style="color:#666">${escapeHtml(where(c))}</span></li>`)
    .join("")}</ul>`
  try {
    const r = await sendSupportNotificationEmail({ subject, text, html })
    return r.delivered
  } catch (e) {
    console.error("[reddit-watch] notify failed", e)
    return false
  }
}

/**
 * 记下这一轮每组抓没抓到（只有真跑才写库），算出连续失败到提醒线的组。
 * staleAlert = 这一轮刚好到提醒点的组（第 6 次、第 24 次……），不会每 20 分钟重复。
 */
async function trackGroups(supabase: Supabase, prev: Map<string, StatusRow>, results: GroupResult[], write: boolean): Promise<{ stale: StaleGroup[]; staleAlert: StaleGroup[] }> {
  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const byName = new Map(results.map((r) => [r.name, r]))
  const stale: StaleGroup[] = []
  const staleAlert: StaleGroup[] = []
  const upserts: Array<Record<string, unknown>> = []

  for (const g of REDDIT_WATCH_GROUPS) {
    const p = prev.get(g.name)
    const r = byName.get(g.name)
    const streak = r ? (r.ok ? 0 : (p?.fail_streak ?? 0) + 1) : (p?.fail_streak ?? 0)
    const lastOk = r?.ok ? nowIso : (p?.last_ok_at ?? null)
    if (streak >= REDDIT_FAIL_ALERT_STREAK) {
      const entry: StaleGroup = {
        group: g.name,
        label: g.label,
        failStreak: streak,
        hoursSinceOk: lastOk ? Math.round(((now - Date.parse(lastOk)) / 3600_000) * 10) / 10 : null,
        lastError: (r && !r.ok ? r.error : p?.last_error) ?? null,
      }
      stale.push(entry)
      const due = streak === REDDIT_FAIL_ALERT_STREAK || (streak - REDDIT_FAIL_ALERT_STREAK) % REDDIT_FAIL_REALERT_EVERY === 0
      if (r && !r.ok && due) staleAlert.push(entry)
    }
    if (r) {
      upserts.push({
        group_name: g.name,
        last_attempt_at: nowIso,
        last_ok_at: lastOk,
        last_status: r.status,
        last_error: r.ok ? null : (r.error ?? null),
        fail_streak: streak,
        alerted_at: staleAlert.some((a) => a.group === g.name) ? nowIso : r.ok ? null : (p?.alerted_at ?? null),
      })
    }
  }

  if (write && upserts.length) {
    const { error } = await supabase.from("reddit_watch_status").upsert(upserts, { onConflict: "group_name" })
    if (error) console.error("[reddit-watch] status upsert failed", error.message)
  }
  // dry 跑不写库，也就不该让调用方去提醒。
  return { stale, staleAlert: write ? staleAlert : [] }
}

/** Facebook 搜索的健康度行；没有提醒线，失败了明天再来。 */
async function trackFacebook(supabase: Supabase, prev: Map<string, StatusRow>, fb: FacebookFetch, write: boolean) {
  if (!write) return
  const p = prev.get(FACEBOOK_STATUS_GROUP)
  const nowIso = new Date().toISOString()
  const { error } = await supabase.from("reddit_watch_status").upsert(
    {
      group_name: FACEBOOK_STATUS_GROUP,
      last_attempt_at: nowIso,
      last_ok_at: fb.ok ? nowIso : (p?.last_ok_at ?? null),
      last_status: fb.ok ? 200 : 0,
      last_error: fb.errors.length ? fb.errors.join("; ").slice(0, 500) : null,
      fail_streak: fb.ok ? 0 : (p?.fail_streak ?? 0) + 1,
      alerted_at: p?.alerted_at ?? null,
    },
    { onConflict: "group_name" },
  )
  if (error) console.error("[reddit-watch] facebook status upsert failed", error.message)
}

export async function GET(request: NextRequest) {
  const viaCron = cronAuthorized(request) || isCronCall(request, CRON_PURPOSE_REDDIT_WATCH)
  if (!viaCron && !(await resolveAdminActor(request))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })
  const sp = request.nextUrl.searchParams

  if (sp.get("list")) {
    const status = sp.get("status") ?? "new"
    let query = supabase.from("reddit_mentions").select(LIST_COLUMNS).order("posted_at", { ascending: false }).limit(80)
    if (status !== "all") query = query.eq("status", STATUSES.has(status) ? status : "new")
    const { data, error } = await query
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, items: data ?? [] })
  }

  const dry = sp.get("dry") === "1"
  const now = Date.now()
  // 定时任务每 20 分钟全天调，夜里直接回，不抓不响；人手动调不受限。
  if (viaCron && !inWatchHours(now)) return NextResponse.json({ ok: true, skipped: "quiet_hours" })
  const prev = await readStatus(supabase)
  // 官方 API（将来拿到批准）有配额，全抓；monid 按次计费、RSS 怕限流，都是每轮一组。
  const groups = redditMode() === "oauth" ? REDDIT_WATCH_GROUPS : [nextGroup(prev)]
  const runFacebook = monidEnabled() && (sp.get("facebook") === "1" || (!dry && facebookDue(prev, now)))
  const [collected, fb] = await Promise.all([collectCandidates({ groups }), runFacebook ? fetchFacebookPosts() : Promise.resolve(null)])
  const fbPicked = fb ? facebookCandidates(fb.posts, now) : null
  const candidates = [...collected.candidates, ...(fbPicked?.candidates ?? [])]
  const summary = {
    mode: collected.mode,
    fetched: collected.fetched + (fb?.posts.length ?? 0),
    matched: candidates.length,
    errors: [...collected.errors, ...(fb?.errors.map((e) => `facebook ${e}`) ?? [])],
    groups: collected.groups,
    facebook: fb
      ? { ran: true, ok: fb.ok, queries: fb.queries, posts: fb.posts.length, matched: fbPicked?.candidates.length ?? 0, dropped: fbPicked?.dropped ?? {}, cost: fb.cost }
      : { ran: false },
  }

  let known = new Set<string>()
  const ids = candidates.map((c) => c.id)
  if (ids.length) {
    const { data: existing, error } = await supabase.from("reddit_mentions").select("id").in("id", ids)
    if (error) return NextResponse.json({ ok: false, error: error.message, ...summary }, { status: 500 })
    known = new Set((existing ?? []).map((r) => (r as { id: string }).id))
  }
  const fresh = candidates.filter((c) => !known.has(c.id))

  if (!dry && fresh.length) {
    const { error } = await supabase.from("reddit_mentions").upsert(fresh.map(toRow), { onConflict: "id", ignoreDuplicates: true })
    if (error) return NextResponse.json({ ok: false, error: error.message, ...summary }, { status: 500 })
  }

  const health = await trackGroups(supabase, prev, collected.groups, !dry)
  if (fb) await trackFacebook(supabase, prev, fb, !dry)
  const tier1 = fresh.filter((c) => c.tier === 1)
  const emailed = !dry && tier1.length > 0 ? await notifyTier1(tier1) : false

  return NextResponse.json({
    ok: true,
    dry,
    ...summary,
    inserted: dry ? 0 : fresh.length,
    tier1New: tier1.length,
    emailed,
    stale: health.stale,
    staleAlert: health.staleAlert,
    fresh: fresh.map(brief),
  })
}

export async function PATCH(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })

  const body = (await request.json().catch(() => null)) as { id?: unknown; status?: unknown; note?: unknown } | null
  const id = typeof body?.id === "string" ? body.id.trim() : ""
  const status = typeof body?.status === "string" ? body.status : ""
  if (!id || !STATUSES.has(status)) return NextResponse.json({ ok: false, error: "id and status (new|replied|skipped) required" }, { status: 400 })

  const patch: Record<string, unknown> = {
    status,
    handled_at: status === "new" ? null : new Date().toISOString(),
    handled_by: status === "new" ? null : (actor.name ?? actor.alias),
  }
  if (typeof body?.note === "string") patch.note = body.note.slice(0, 500)

  const { error } = await supabase.from("reddit_mentions").update(patch).eq("id", id)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id, status })
}
