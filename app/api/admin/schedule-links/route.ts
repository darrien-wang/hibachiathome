import { randomBytes } from "node:crypto"
import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// 排班计算器的分享链接：老板在 设置 里发给认识的人，看每个链接用了多少，随时收回
// （2026-09-29）。只有 owner 能管。

const TODAY_TZ = "America/Los_Angeles"
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: TODAY_TZ })
const str = (v: unknown, max = 60) => (typeof v === "string" ? v.trim().slice(0, max) : "")

async function owner(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) }
  if (actor.role !== "owner") return { error: NextResponse.json({ error: "只有老板能管分享链接" }, { status: 403 }) }
  return { actor }
}

export async function GET(request: NextRequest) {
  const a = await owner(request)
  if ("error" in a) return a.error
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "not configured" }, { status: 500 })

  const [{ data: links }, { data: usage }] = await Promise.all([
    supabase.from("schedule_share_links").select("id, token, name, daily_limit, created_at, revoked_at, last_used_at").order("created_at", { ascending: false }),
    supabase.from("schedule_share_usage").select("link_id, day, runs, stops"),
  ])
  const d = today()
  const byLink = new Map<string, { today: number; runs: number; stops: number }>()
  for (const u of (usage ?? []) as Array<{ link_id: string; day: string; runs: number; stops: number }>) {
    const cur = byLink.get(u.link_id) ?? { today: 0, runs: 0, stops: 0 }
    cur.runs += u.runs
    cur.stops += u.stops
    if (u.day === d) cur.today += u.runs
    byLink.set(u.link_id, cur)
  }
  return NextResponse.json({
    ok: true,
    links: ((links ?? []) as Array<Record<string, unknown>>).map((l) => ({ ...l, usage: byLink.get(l.id as string) ?? { today: 0, runs: 0, stops: 0 } })),
  })
}

export async function POST(request: NextRequest) {
  const a = await owner(request)
  if ("error" in a) return a.error
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "not configured" }, { status: 500 })

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  const limit = Math.round(Number(body.daily_limit))
  const validLimit = Number.isFinite(limit) && limit >= 1 && limit <= 1000

  if (body.action === "create") {
    const name = str(body.name)
    if (!name) return NextResponse.json({ error: "给这个链接起个名字，比如「Tony · 同行」" }, { status: 400 })
    // 24 个字符的随机串：能力链接，拿到就能用，所以要猜不中。
    const token = randomBytes(18).toString("base64url")
    const { data, error } = await supabase
      .from("schedule_share_links")
      .insert({ token, name, daily_limit: validLimit ? limit : 30, created_by: a.actor.alias })
      .select("id, token, name, daily_limit, created_at")
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, link: data })
  }

  const id = str(body.id, 40)
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "id required" }, { status: 400 })

  if (body.action === "revoke") {
    const { error } = await supabase.from("schedule_share_links").update({ revoked_at: new Date().toISOString() }).eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.action === "set_limit") {
    if (!validLimit) return NextResponse.json({ error: "每天次数要在 1–1000 之间" }, { status: 400 })
    const { error } = await supabase.from("schedule_share_links").update({ daily_limit: limit }).eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 })
}
