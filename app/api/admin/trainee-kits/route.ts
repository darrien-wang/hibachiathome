import { type NextRequest, NextResponse } from "next/server"
import { can, resolveAdminActor } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// 学员套装（老板 2026-09-29）。
//
// 一套完整的出摊家伙，先由老板垫钱配齐，借给学员跑一两场；学员觉得能长干，这套
// 就卖给他，老板再配一套。所以它既不是消耗品（不会用光）也不是周转品（不会还回
// 来）——卖出去正是它的归宿，不是丢了东西。
//
// 两张表两件事：`trainee_kit_items` 是"一套里有什么"（采购清单，可改），
// `trainee_kits` 是"我手上这几套现在各自怎么样"（台账）。清单改了不影响已有的套
// 装，就像改菜谱不会动已经做好的菜。
//
// 成本不进 supply_purchases（老板 09-24 定：装备摊进"每人食材成本"会污染那个数
// 字），成本和卖价只记在台账里。

const str = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const cents = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n)
}
const day = (v: unknown): string | null => {
  const s = str(v, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

const STATUSES = new Set(["in_stock", "on_loan", "sold", "retired"])

type KitRow = {
  id: string
  kit_no: string
  status: string
  holder_staff_id: string | null
  holder_name: string | null
  cost_cents: number
  sold_price_cents: number | null
  bought_on: string | null
  loaned_on: string | null
  sold_on: string | null
  note: string | null
}

export async function GET(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "not configured" }, { status: 500 })

  const [itemsRes, kitsRes, staffRes] = await Promise.all([
    supabase.from("trainee_kit_items").select("*").eq("active", true).order("sort_order"),
    supabase.from("trainee_kits").select("*").order("kit_no"),
    supabase.from("staff_members").select("id, full_name, display_name, status").eq("status", "active"),
  ])

  // 采购清单谁都能看（将来可能让坐席去买），但台账带成本和卖价，那是老板的钱，
  // 和厨师工资一个口径（lib/workbench-perms.ts 的 chef_sensitive）。
  const canSeeMoney = can(actor, "chef_sensitive")
  const kits = canSeeMoney ? ((kitsRes.data ?? []) as KitRow[]) : []
  // 摆在最前面的三个数：手上能给出去几套、几套在学员那儿、卖出去几套回了多少钱。
  const inStock = kits.filter((k) => k.status === "in_stock").length
  const onLoan = kits.filter((k) => k.status === "on_loan").length
  const sold = kits.filter((k) => k.status === "sold")
  const spent = kits.reduce((a, k) => a + (k.cost_cents ?? 0), 0)
  const recovered = sold.reduce((a, k) => a + (k.sold_price_cents ?? 0), 0)

  return NextResponse.json({
    ok: true,
    items: itemsRes.data ?? [],
    kits,
    staff: (staffRes.data ?? []).map((s) => ({
      id: s.id as string,
      name: ((s.display_name as string | null) ?? (s.full_name as string | null) ?? "").trim(),
    })),
    canSeeMoney,
    summary: canSeeMoney
      ? { inStock, onLoan, sold: sold.length, spentCents: spent, recoveredCents: recovered }
      : { inStock: 0, onLoan: 0, sold: 0, spentCents: 0, recoveredCents: 0 },
  })
}

export async function POST(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  // 台账带钱，和厨师工资一样只给 owner。
  if (!can(actor, "chef_sensitive")) return NextResponse.json({ error: "你的账号看不了这块" }, { status: 403 })
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

  // ---- 台账 ---------------------------------------------------------------

  if (action === "add_kit") {
    // 编号自己往下排，免得老板去想这是第几套。
    const { data: last } = await supabase.from("trainee_kits").select("kit_no").order("kit_no", { ascending: false }).limit(1)
    const n = Number(String((last?.[0]?.kit_no as string | undefined) ?? "").replace(/\D/g, "")) || 0
    const { data, error } = await supabase
      .from("trainee_kits")
      .insert({
        kit_no: str(body.kit_no, 16) || `第 ${n + 1} 套`,
        cost_cents: cents(body.cost_cents) ?? 0,
        bought_on: day(body.bought_on),
        note: str(body.note, 300) || null,
      })
      .select("*")
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, kit: data })
  }

  if (action === "set_kit") {
    const id = str(body.id, 40)
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "id required" }, { status: 400 })
    const patch: Record<string, unknown> = { updated_at: now }

    if (body.status !== undefined) {
      const status = str(body.status, 16)
      if (!STATUSES.has(status)) return NextResponse.json({ error: "invalid status" }, { status: 400 })
      patch.status = status
      // 状态自己带日期：借出去那天、卖出去那天，事后没人记得住。传了日期就用传的。
      if (status === "on_loan") patch.loaned_on = day(body.loaned_on) ?? new Date().toISOString().slice(0, 10)
      if (status === "sold") patch.sold_on = day(body.sold_on) ?? new Date().toISOString().slice(0, 10)
      // 收回来 = 这套又能给下一个人用了，试用那段就翻篇。
      if (status === "in_stock") {
        patch.loaned_on = null
        patch.holder_staff_id = null
        patch.holder_name = null
      }
    }
    if (body.holder_staff_id !== undefined) {
      const sid = str(body.holder_staff_id, 40)
      patch.holder_staff_id = /^[0-9a-f-]{36}$/i.test(sid) ? sid : null
    }
    if (body.holder_name !== undefined) patch.holder_name = str(body.holder_name, 60) || null
    if (body.cost_cents !== undefined) patch.cost_cents = cents(body.cost_cents) ?? 0
    if (body.sold_price_cents !== undefined) patch.sold_price_cents = cents(body.sold_price_cents)
    if (body.bought_on !== undefined) patch.bought_on = day(body.bought_on)
    if (body.note !== undefined) patch.note = str(body.note, 300) || null
    if (body.kit_no !== undefined) {
      const no = str(body.kit_no, 16)
      if (no) patch.kit_no = no
    }

    const { data, error } = await supabase.from("trainee_kits").update(patch).eq("id", id).select("*").maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, kit: data })
  }

  if (action === "delete_kit") {
    const id = str(body.id, 40)
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "id required" }, { status: 400 })
    const { error } = await supabase.from("trainee_kits").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // ---- 清单（一套里有什么） -------------------------------------------------

  if (action === "add_item") {
    const label = str(body.label, 60)
    if (!label) return NextResponse.json({ error: "写个名字" }, { status: 400 })
    const { data: last } = await supabase.from("trainee_kit_items").select("sort_order").order("sort_order", { ascending: false }).limit(1)
    const { data, error } = await supabase
      .from("trainee_kit_items")
      .insert({
        label,
        qty: Number(body.qty) > 0 ? Number(body.qty) : 1,
        unit: str(body.unit, 8) || "件",
        item_key: str(body.item_key, 40) || null,
        buy_channel: str(body.buy_channel, 40) || null,
        est_cost_cents: cents(body.est_cost_cents),
        note: str(body.note, 200) || null,
        sort_order: (Number(last?.[0]?.sort_order) || 0) + 10,
      })
      .select("*")
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, item: data })
  }

  if (action === "set_item") {
    const id = str(body.id, 40)
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "id required" }, { status: 400 })
    const patch: Record<string, unknown> = { updated_at: now }
    if (body.label !== undefined) {
      const label = str(body.label, 60)
      if (label) patch.label = label
    }
    if (body.qty !== undefined) patch.qty = Number(body.qty) > 0 ? Number(body.qty) : 1
    if (body.unit !== undefined) patch.unit = str(body.unit, 8) || "件"
    if (body.buy_channel !== undefined) patch.buy_channel = str(body.buy_channel, 40) || null
    if (body.est_cost_cents !== undefined) patch.est_cost_cents = cents(body.est_cost_cents)
    if (body.note !== undefined) patch.note = str(body.note, 200) || null
    // 选定哪个候选。传空串 = 取消选择（页面上再点一次"已选"）。
    if (body.chosen_url !== undefined) patch.chosen_url = str(body.chosen_url, 400) || null
    // 候选整组替换。逐字段清洗一遍：这些值会被当成链接渲染出去，不能原样落库。
    if (Array.isArray(body.candidates)) {
      patch.candidates = (body.candidates as unknown[]).slice(0, 8).map((raw) => {
        const c = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
        const url = str(c.url, 400)
        return {
          title: str(c.title, 120),
          // 只认 http(s)：javascript: 这种进了 href 就是一个点击执行的洞。
          url: /^https?:\/\//i.test(url) ? url : undefined,
          price: cents(c.price) ?? undefined,
          ship: cents(c.ship) ?? undefined,
          store: str(c.store, 40) || undefined,
          note: str(c.note, 200) || undefined,
        }
      }).filter((c) => c.title)
    }
    if (body.buy_note !== undefined) patch.buy_note = str(body.buy_note, 300) || null
    // 删掉一行是置 active=false：以前配的套装是按当时的清单买的，把行真删了，
    // 回头看"当初这套里有什么"就对不上了。
    if (body.active !== undefined) patch.active = body.active === true
    const { data, error } = await supabase.from("trainee_kit_items").update(patch).eq("id", id).select("*").maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, item: data })
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 })
}
