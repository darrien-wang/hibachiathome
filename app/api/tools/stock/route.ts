import { randomBytes } from "node:crypto"
import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { resolveAdminActor } from "@/lib/admin-auth"
import { addStockSpec, archiveStockSpec, loadStockState, recentCounts, staffByStockToken, submitStockCount } from "@/lib/stocktake-server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// 师傅盘点（页面 /tools/stock，2026-11-26，口径见 lib/stocktake.ts）
//
//   GET  ?t=<token>            我是谁 + 每样现在账上多少、上次谁什么时候盘的、上次怎么数的 + 自定义规格
//   POST ?t=<token>  { action: submit, items: [{ item_key, lines | level }], note? }
//                    { action: add_spec, item_key, label?, amount, unit }      师傅加规格，加了就能用（老板定）
//
// 工作台登录的人（老板 / 坐席）不带 t 也能打开同一页盘（cookie 的 path 是 /，带得过来）。
// 只有老板：
//   GET  ?view=admin            师傅名单 + 谁有链接 + 最近的盘点记录
//   POST { action: issue_link | revoke_link, staff_member_id }   链接长期有效，收回了才失效
//   POST { action: archive_spec, id }

const noStore = { "cache-control": "no-store" } as const
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: noStore })
const deny = (status: number, error: string) => json({ ok: false, error }, status)
const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v)
const BASE = "https://www.realhibachi.com/tools/stock"

async function who(request: NextRequest, supabase: NonNullable<ReturnType<typeof createServerSupabaseClient>>) {
  const token = (request.nextUrl.searchParams.get("t") ?? "").trim()
  if (token) {
    const staff = await staffByStockToken(supabase, token)
    return staff ? { staffId: staff.id, name: staff.name, via: "link" as const, owner: false } : null
  }
  const actor = await resolveAdminActor(request).catch(() => null)
  if (!actor) return null
  return { staffId: null, name: actor.name ?? actor.alias, via: "workbench" as const, owner: actor.role === "owner" }
}

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  if (!supabase) return deny(500, "supabase not configured")
  const me = await who(request, supabase)
  if (!me) return deny(401, "链接不对或者已经收回了，找老板要一条新的")
  if (request.nextUrl.searchParams.get("view") === "admin") {
    if (!me.owner) return deny(403, "只有老板能看")
    const [{ data: staff }, counts] = await Promise.all([
      supabase.from("staff_members").select("id, display_name, full_name, role, staff_type, stock_token").eq("status", "active").order("display_name"),
      recentCounts(supabase, 30),
    ])
    return json({
      ok: true,
      staff: ((staff ?? []) as Array<{ id: string; display_name: string | null; full_name: string | null; role: string | null; staff_type: string | null; stock_token: string | null }>).map((s) => ({
        id: s.id,
        name: String(s.display_name ?? s.full_name ?? "").trim() || "未命名",
        role: s.role,
        fullTime: s.staff_type === "employee",
        url: s.stock_token ? `${BASE}?t=${s.stock_token}` : null,
      })),
      counts,
    })
  }
  const state = await loadStockState(supabase)
  return json({ ok: true, me: { name: me.name, via: me.via, owner: me.owner }, ...state })
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  if (!supabase) return deny(500, "supabase not configured")
  const me = await who(request, supabase)
  if (!me) return deny(401, "链接不对或者已经收回了，找老板要一条新的")
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  if (body.action === "submit") {
    const r = await submitStockCount(supabase, { staffId: me.staffId, name: me.name, via: me.via }, (body.items as never) ?? [], typeof body.note === "string" ? body.note : undefined)
    return r.ok ? json(r) : deny(r.status, r.error)
  }
  if (body.action === "add_spec") {
    const r = await addStockSpec(supabase, body, me.name)
    return r.ok ? json(r) : deny(r.status, r.error)
  }

  if (!me.owner) return deny(403, "只有老板能做")
  if (body.action === "archive_spec") {
    if (!isUuid(body.id)) return deny(400, "id 不对")
    return (await archiveStockSpec(supabase, body.id)) ? json({ ok: true }) : deny(500, "没改成")
  }
  if (body.action === "issue_link" || body.action === "revoke_link") {
    if (!isUuid(body.staff_member_id)) return deny(400, "staff_member_id 不对")
    const token = body.action === "issue_link" ? randomBytes(18).toString("base64url") : null
    const { error } = await supabase.from("staff_members").update({ stock_token: token }).eq("id", body.staff_member_id)
    if (error) return deny(500, error.message)
    return json({ ok: true, url: token ? `${BASE}?t=${token}` : null })
  }
  return deny(400, "unknown action")
}
