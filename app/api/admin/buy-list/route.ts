import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// 常买清单 + 待买（老板 2026-10-10）。
//
// 老板的原话："当我们讨论好以后都买这个的时候，放到采购数据库里，以后就方便重复
// 买了"。所以一行 = 一样定下来的东西（干蒜粒、汤盒、点火用的伏特加…），带着讨论
// 时比过价的候选商品和选定的那个链接。缺了就把 need_qty 设上，页面"要买的"那块
// 按店分组，点链接直接下单；买完点"买了"清掉。
//
// 和仓库的补货清单不是一回事：那边按库存线算"该补几包"，这里只管"去哪买、买哪个"。
// 入账（钱）照旧走 supplies skill，这里不记钱的流水。

const str = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const cents = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : Number(v)
  if (v === null || v === undefined || v === "" || !Number.isFinite(n) || n < 0) return undefined
  return Math.round(n)
}
const isId = (s: string) => /^[0-9a-f-]{36}$/i.test(s)

// 候选整组替换时逐字段清洗：这些值会被渲染成链接，不能原样落库。
function cleanCandidates(raw: unknown) {
  if (!Array.isArray(raw)) return undefined
  return raw
    .slice(0, 8)
    .map((r) => {
      const c = (r && typeof r === "object" ? r : {}) as Record<string, unknown>
      const url = str(c.url, 500)
      const checked = str(c.checked, 10)
      return {
        title: str(c.title, 140),
        // 只认 http(s)：javascript: 进了 href 就是点一下就执行的洞。
        url: /^https?:\/\//i.test(url) ? url : undefined,
        price: cents(c.price),
        ship: cents(c.ship),
        store: str(c.store, 40) || undefined,
        size: str(c.size, 40) || undefined,
        note: str(c.note, 200) || undefined,
        // 价格是哪天看的：网上的价一周就变，过了一个月的价只能当参考。
        checked: /^\d{4}-\d{2}-\d{2}$/.test(checked) ? checked : undefined,
      }
    })
    .filter((c) => c.title)
}

export async function GET(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "not configured" }, { status: 500 })
  const { data, error } = await supabase.from("buy_items").select("*").eq("active", true).order("sort_order").order("created_at")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, items: data ?? [] })
}

export async function POST(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "not configured" }, { status: 500 })

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  const action = str(body.action, 24)
  const now = new Date().toISOString()

  // 新建或按 id 改。agent 和页面走同一个口子。
  if (action === "upsert") {
    const id = str(body.id, 40)
    const patch: Record<string, unknown> = { updated_at: now }
    if (body.label !== undefined) {
      const label = str(body.label, 60)
      if (label) patch.label = label
    }
    if (body.unit !== undefined) patch.unit = str(body.unit, 12) || "件"
    if (body.category !== undefined) patch.category = str(body.category, 24) || null
    if (body.item_key !== undefined) patch.item_key = str(body.item_key, 40) || null
    if (body.buy_note !== undefined) patch.buy_note = str(body.buy_note, 300) || null
    if (body.note !== undefined) patch.note = str(body.note, 300) || null
    if (body.chosen_url !== undefined) patch.chosen_url = str(body.chosen_url, 500) || null
    if (body.sort_order !== undefined && Number.isFinite(Number(body.sort_order))) patch.sort_order = Math.round(Number(body.sort_order))
    const cands = cleanCandidates(body.candidates)
    if (cands) patch.candidates = cands

    if (id) {
      if (!isId(id)) return NextResponse.json({ error: "bad id" }, { status: 400 })
      const { data, error } = await supabase.from("buy_items").update(patch).eq("id", id).select("*").maybeSingle()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, item: data })
    }
    if (!patch.label) return NextResponse.json({ error: "写个名字" }, { status: 400 })
    // 新的一行：选定链接没传就默认第一个候选，讨论完多半就是它。
    if (!patch.chosen_url && cands?.[0]?.url) patch.chosen_url = cands[0].url
    const { data: last } = await supabase.from("buy_items").select("sort_order").order("sort_order", { ascending: false }).limit(1)
    patch.sort_order = patch.sort_order ?? (Number(last?.[0]?.sort_order) || 0) + 10
    const { data, error } = await supabase.from("buy_items").insert(patch).select("*").maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, item: data })
  }

  const id = str(body.id, 40)
  if (!isId(id)) return NextResponse.json({ error: "id required" }, { status: 400 })

  // 缺了：放进"要买的"。qty 0 = 拿出来（不买了）。
  if (action === "need") {
    const q = Number(body.qty ?? 1)
    const qty = Number.isFinite(q) && q > 0 ? Math.min(q, 999) : 0
    const { data, error } = await supabase
      .from("buy_items")
      .update({ need_qty: qty, need_note: qty ? str(body.note, 200) || null : null, needed_at: qty ? now : null, updated_at: now })
      .eq("id", id)
      .select("*")
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, item: data })
  }

  if (action === "bought") {
    const { data, error } = await supabase
      .from("buy_items")
      .update({ need_qty: 0, need_note: null, needed_at: null, last_bought_at: now, updated_at: now })
      .eq("id", id)
      .select("*")
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, item: data })
  }

  // 不再买这个：置 active=false，留着讨论过的候选，万一又改回来。
  if (action === "archive") {
    const { error } = await supabase.from("buy_items").update({ active: false, need_qty: 0, updated_at: now }).eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 })
}
