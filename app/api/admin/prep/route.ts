import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase"
import { aggregatePrep, orderPrep, type InvoiceLite, type PrepItem } from "@/lib/prep-bom"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// 备料采购 + 装备库存：GET ?date=YYYY-MM-DD（PT 日，默认明天）→ 当天所有未取消订单的
// 用料合计 + 按单明细。份量来自发票系统同一套配比（lib/prep-bom.ts 镜像），
// 所以采购清单、厨师备料单、发票三者说同一个数。没填菜单的订单只按人头
// 算主食蔬菜蛋，蛋白质会标"菜单未定"，绝不悄悄按零算。

const PT = "America/Los_Angeles"
const ptDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: PT })

type Row = {
  id: string
  order_no: string
  customer_name: string | null
  event_start: string | null
  event_address: string | null
  guest_adult_count: number | null
  guest_child_count: number | null
  order_status: string | null
  created_at: string
  invoice_data: InvoiceLite | null
}

export async function GET(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "supabase not configured" }, { status: 500 })

  const qd = request.nextUrl.searchParams.get("date") ?? ""
  const date = /^\d{4}-\d{2}-\d{2}$/.test(qd) ? qd : ptDay(new Date(Date.now() + 24 * 3600_000))

  // PT 的一天在 UTC 上最多横跨 [date-1, date+2)，先宽取再按 PT 日精确过滤。
  const lo = new Date(`${date}T00:00:00Z`)
  const from = new Date(lo.getTime() - 24 * 3600_000).toISOString()
  const to = new Date(lo.getTime() + 48 * 3600_000).toISOString()
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_no, customer_name, event_start, event_address, guest_adult_count, guest_child_count, order_status, created_at, invoice_data")
    .gte("event_start", from)
    .lt("event_start", to)
    .order("event_start")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = ((data ?? []) as Row[]).filter(
    (r) => r.event_start && ptDay(new Date(r.event_start)) === date && !/cancel|void|refund/i.test(r.order_status ?? ""),
  )

  const allItems: PrepItem[] = []
  const orders = rows.map((r) => {
    const prep = orderPrep(r.invoice_data, r.created_at, r.guest_adult_count ?? 0, r.guest_child_count ?? 0)
    if (prep.menuKnown) allItems.push(...prep.items)
    else allItems.push(...prep.items.filter((i) => i.group !== "protein"))
    const t = new Date(r.event_start as string)
    return {
      id: r.id,
      orderNo: r.order_no,
      name: (r.customer_name ?? "").trim() || "未留名",
      timeLabel: t.toLocaleTimeString("en-US", { timeZone: PT, hour: "numeric", minute: "2-digit" }),
      city: (r.event_address ?? "").split(",").slice(-3, -2).join("").trim() || null,
      adults: prep.adults,
      kids: prep.kids,
      menuKnown: prep.menuKnown,
      proteinLine: prep.proteinServings.map((p) => `${p.label.split(" ")[0]} ×${p.servings}`).join(" · "),
      extrasLine: prep.items
        .filter((i) => i.group === "frozen" || i.group === "setup")
        .map((i) => `${i.label.split(" ")[0]}${i.unit === "份" ? ` ${i.qty}份` : ` ${i.qty}${i.unit}`}`)
        .join(" · "),
    }
  })

  const unknown = orders.filter((o) => !o.menuKnown)
  // 装备库存（桌椅桌布餐具气罐）：跟需求放在一张清单里对着看。
  const { data: stock } = await supabase.from("equipment_stock").select("item_key, label, unit, qty, low_at, note, updated_at").order("item_key")
  return NextResponse.json(
    {
      ok: true,
      date,
      orderCount: orders.length,
      guestTotal: orders.reduce((n, o) => n + o.adults + o.kids, 0),
      orders,
      totals: aggregatePrep(allItems),
      stock: stock ?? [],
      warnings: unknown.map((o) => `${o.timeLabel} ${o.name}（${o.adults + o.kids} 人）菜单未定——蛋白质没算进合计，买前先把菜单问回来`),
    },
    { headers: { "cache-control": "no-store" } },
  )
}

// 盘点：改一个装备的数（只有老板）。POST { action: "set_stock", item_key, qty, note? }
export async function POST(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (actor.role !== "owner") return NextResponse.json({ error: "只有老板能改库存" }, { status: 403 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "supabase not configured" }, { status: 500 })
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  if (body.action !== "set_stock") return NextResponse.json({ error: "unknown action" }, { status: 400 })
  const key = typeof body.item_key === "string" ? body.item_key.trim().slice(0, 40) : ""
  const qty = Math.round(Number(body.qty))
  if (!key || !Number.isFinite(qty) || qty < 0 || qty > 100000) return NextResponse.json({ error: "item_key / qty 不对" }, { status: 400 })
  const patch: Record<string, unknown> = { qty, updated_by: actor.alias, updated_at: new Date().toISOString() }
  if (typeof body.note === "string") patch.note = body.note.slice(0, 200) || null
  // 新装备（自定义名字）也允许直接建一行。
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 60) : null
  const unit = typeof body.unit === "string" && body.unit.trim() ? body.unit.trim().slice(0, 10) : null
  const { data: existing } = await supabase.from("equipment_stock").select("item_key").eq("item_key", key).maybeSingle()
  if (existing) {
    if (label) patch.label = label
    const { error } = await supabase.from("equipment_stock").update(patch).eq("item_key", key)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase.from("equipment_stock").insert({ item_key: key, label: label ?? key, unit: unit ?? "件", ...patch })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
