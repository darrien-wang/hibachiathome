import { type NextRequest, NextResponse } from "next/server"
import { REDDIT_FAIL_ALERT_STREAK, REDDIT_FAIL_REALERT_EVERY, REDDIT_WATCH_GROUPS } from "@/config/reddit-watch"
import { resolveAdminActor } from "@/lib/admin-auth"
import { redditMode } from "@/lib/reddit-watch/fetch"
import { escapeHtml } from "@/lib/escape-html"
import { sendSupportNotificationEmail } from "@/lib/ops-notifications"
import { collectCandidates, type Candidate, type GroupResult } from "@/lib/reddit-watch/run"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// Reddit 监听。
//
//   GET            跑一轮：抓目标版块新帖 → 分级 → 新命中写 reddit_mentions →
//                  一档（直接问 hibachi/私厨）发一封提醒邮件。由桌面定时任务
//                  reddit-watch 每 20 分钟用 x-admin-key 调（Vercel 是 Hobby 版，
//                  cron 只能一天一次，写进 vercel.json 会让整站部署被拒，
//                  2026-09-22 踩过）；加 ?dry=1 只看不写。CRON_SECRET 分支留给
//                  以后升级付费版再用。
//   GET ?list=1    工作台面板读列表（?status=new|replied|skipped|all）
//   PATCH          工作台标状态 { id, status, note? }
//
// 取数走公开 RSS：Reddit 从 2025-11 起所有 API 应用都要先人工审批（商用要书面
// 批准），自助建应用已经关了（2026-09-22 用户实测被挡）。未登录时同一 IP 连发
// 第二个请求基本必挨限流，所以每轮只抓"最久没抓的那一组"：一次请求，两组轮流，
// 每组每 40 分钟一次，远小于两组最新 100 帖约 12/25 小时的覆盖窗口。
// 每组健康度记在 reddit_watch_status：连续失败 6 次（约 4 小时）在返回里给
// staleAlert，定时任务据此提醒一次，之后每再失败 18 次再提醒。
//
// 只做"发现"。绝不自动回帖、投票、私信——Reddit 上只能由人坦白身份手动回
// （docs/竞对Reddit营销扫描-2026-09-22.md 记了为什么）。手机收件箱
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
  const { data } = await supabase.from("reddit_watch_status").select("*").in("group_name", REDDIT_WATCH_GROUPS.map((g) => g.name))
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

function cronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  return (request.headers.get("authorization") ?? "") === `Bearer ${secret}`
}

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

const brief = (c: Candidate) => ({ id: c.id, tier: c.tier, subreddit: c.subreddit, title: c.title, url: c.url, keywords: c.keywords, postedAt: c.postedAt })

async function notifyTier1(hits: Candidate[]): Promise<boolean> {
  const lines = hits.map((c) => `[r/${c.subreddit}] ${c.title}\n${c.url}`)
  const subject = `Reddit 有 ${hits.length} 条新询问待回 · r/${hits[0].subreddit}`
  const text = ["有人在 Reddit 上问 hibachi / 私厨，去工作台线索页看，回的时候坦白身份、不放链接。", "", ...lines].join("\n")
  const html = `<p>有人在 Reddit 上问 hibachi / 私厨。去工作台线索页看，回的时候坦白身份、不放链接。</p><ul>${hits
    .map((c) => `<li><a href="${escapeHtml(c.url)}">${escapeHtml(c.title)}</a> <span style="color:#666">r/${escapeHtml(c.subreddit)}</span></li>`)
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

export async function GET(request: NextRequest) {
  const viaCron = cronAuthorized(request)
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
  const prev = await readStatus(supabase)
  // RSS 模式每轮一组一个请求；官方 API（将来拿到批准）有配额，全抓。
  const groups = redditMode() === "rss" ? [nextGroup(prev)] : REDDIT_WATCH_GROUPS
  const collected = await collectCandidates({ groups })
  const summary = { mode: collected.mode, fetched: collected.fetched, matched: collected.candidates.length, errors: collected.errors, groups: collected.groups }

  let known = new Set<string>()
  const ids = collected.candidates.map((c) => c.id)
  if (ids.length) {
    const { data: existing, error } = await supabase.from("reddit_mentions").select("id").in("id", ids)
    if (error) return NextResponse.json({ ok: false, error: error.message, ...summary }, { status: 500 })
    known = new Set((existing ?? []).map((r) => (r as { id: string }).id))
  }
  const fresh = collected.candidates.filter((c) => !known.has(c.id))

  if (!dry && fresh.length) {
    const { error } = await supabase.from("reddit_mentions").upsert(fresh.map(toRow), { onConflict: "id", ignoreDuplicates: true })
    if (error) return NextResponse.json({ ok: false, error: error.message, ...summary }, { status: 500 })
  }

  const health = await trackGroups(supabase, prev, collected.groups, !dry)
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
