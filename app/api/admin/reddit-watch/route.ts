import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"
import { escapeHtml } from "@/lib/escape-html"
import { sendSupportNotificationEmail } from "@/lib/ops-notifications"
import { collectCandidates, type Candidate } from "@/lib/reddit-watch/run"
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
// 只做"发现"。绝不自动回帖、投票、私信——Reddit 上只能由人坦白身份手动回
// （docs/竞对Reddit营销扫描-2026-09-22.md 记了为什么）。手机收件箱
// （/api/admin/mobile/inbox）另外把一档新命中当事件推出去响铃。

const STATUSES = new Set(["new", "replied", "skipped"])
const LIST_COLUMNS = "id, subreddit, title, body, author, url, posted_at, tier, keywords, source, status, note, found_at, handled_at"

function cronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  return (request.headers.get("authorization") ?? "") === `Bearer ${secret}`
}

const toRow = (c: Candidate) => ({
  id: c.id,
  subreddit: c.subreddit,
  title: c.title.slice(0, 300),
  body: c.body ? c.body.slice(0, 1500) : null,
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
  const collected = await collectCandidates()
  const summary = { mode: collected.mode, fetched: collected.fetched, matched: collected.candidates.length, errors: collected.errors }

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

  const tier1 = fresh.filter((c) => c.tier === 1)
  const emailed = !dry && tier1.length > 0 ? await notifyTier1(tier1) : false

  return NextResponse.json({
    ok: true,
    dry,
    ...summary,
    inserted: dry ? 0 : fresh.length,
    tier1New: tier1.length,
    emailed,
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
