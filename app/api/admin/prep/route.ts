import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase"
import { aggregatePrep, BUY_UNITS, orderPrep, splitVeg, VEGE_MIX, type InvoiceLite, type PrepItem } from "@/lib/prep-bom"
import { isBulkItem, stockLabel, stockUnit, VEG_IDS } from "@/lib/pantry"
import { setVegTotal, vegTotal } from "@/lib/prep-reservations"
import type { SetupSelection } from "@/config/table-themes"
import { coolerSections, zhTime } from "@/lib/cooler-sheet"

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
  setup_selection: SetupSelection | null
}

export async function GET(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "supabase not configured" }, { status: 500 })

  const qd = request.nextUrl.searchParams.get("date") ?? ""
  const date = /^\d{4}-\d{2}-\d{2}$/.test(qd) ? qd : ptDay(new Date(Date.now() + 24 * 3600_000))

  // 备货模式（仓库页签"备货"）：?orders=<uuid,...> 时按勾选的订单集合算，可以跨天。
  const orderIds = (request.nextUrl.searchParams.get("orders") ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter((x) => /^[0-9a-f-]{36}$/i.test(x))
    .slice(0, 40)
  const byOrders = orderIds.length > 0

  const sel = "id, order_no, customer_name, event_start, event_address, guest_adult_count, guest_child_count, order_status, created_at, invoice_data, setup_selection"
  const query = byOrders
    ? supabase.from("orders").select(sel).in("id", orderIds).order("event_start")
    : (() => {
        // PT 的一天在 UTC 上最多横跨 [date-1, date+2)，先宽取再按 PT 日精确过滤。
        const lo = new Date(`${date}T00:00:00Z`)
        const from = new Date(lo.getTime() - 24 * 3600_000).toISOString()
        const to = new Date(lo.getTime() + 48 * 3600_000).toISOString()
        return supabase.from("orders").select(sel).gte("event_start", from).lt("event_start", to).order("event_start")
      })()
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // event_start 存的是墙上时间（按 UTC 写入），所以"哪一天"直接取 ISO 日期
  // 位，时间也按 UTC 读，不做时区换算（换算会把 12:00 显示成 5:00 AM）。
  const rows = ((data ?? []) as Row[]).filter(
    (r) => r.event_start && (byOrders || r.event_start.slice(0, 10) === date) && !/cancel|void|refund/i.test(r.order_status ?? ""),
  )

  const allItems: PrepItem[] = []
  const orders = rows.map((r) => {
    const prep = orderPrep(r.invoice_data, r.created_at, r.guest_adult_count ?? 0, r.guest_child_count ?? 0, r.setup_selection)
    const mine = prep.menuKnown ? prep.items : prep.items.filter((i) => i.group !== "protein")
    if (prep.menuKnown) allItems.push(...prep.items)
    else allItems.push(...prep.items.filter((i) => i.group !== "protein"))
    const t = new Date(r.event_start as string)
    return {
      id: r.id,
      dateLabel: (r.event_start ?? "").slice(5, 10),
      orderNo: r.order_no,
      name: (r.customer_name ?? "").trim() || "未留名",
      timeLabel: t.toLocaleTimeString("en-US", { timeZone: "UTC", hour: "numeric", minute: "2-digit" }),
      city: (r.event_address ?? "").split(",").slice(-3, -2).join("").trim() || null,
      adults: prep.adults,
      kids: prep.kids,
      menuKnown: prep.menuKnown,
      proteinLine: prep.proteinServings.map((p) => `${p.label.split(" ")[0]} ×${p.servings}`).join(" · "),
      extrasLine: prep.items
        .filter((i) => i.group === "frozen" || i.group === "setup")
        .map((i) => `${i.label.split(" ")[0]}${i.unit === "份" ? ` ${i.qty}份` : ` ${i.qty}${i.unit}`}`)
        .join(" · "),
      // 后勤备货单（装保温箱）：这一单要放进箱子的东西，中文、按她手上的单位。
      cooler: { time: zhTime(r.event_start as string), chef: null as string | null, owner: null as string | null, adults: prep.adults, kids: prep.kids, menuKnown: prep.menuKnown, sections: coolerSections(prep.items, prep.menuKnown) },
    }
  })
  // 备货单上写哪位厨师来拿这一箱（不写客户）。
  if (orders.length) {
    const { data: asg } = await supabase.from("order_staff_assignments").select("order_id, staff_member_id, assignment_status").in("order_id", orders.map((o) => o.id)).in("assignment_status", ["tentative", "confirmed", "completed"])
    const staffIds = Array.from(new Set((asg ?? []).map((a) => String(a.staff_member_id))))
    const { data: staffRows } = staffIds.length ? await supabase.from("staff_members").select("id, display_name, full_name").in("id", staffIds) : { data: [] as Array<{ id: string; display_name: string | null; full_name: string | null }> }
    const nameOf = new Map((staffRows ?? []).map((s) => [String(s.id), String(s.display_name ?? s.full_name ?? "").trim()]))
    for (const o of orders) {
      const names = (asg ?? []).filter((a) => a.order_id === o.id).map((a) => nameOf.get(String(a.staff_member_id)) ?? "").filter(Boolean)
      o.cooler.chef = names.length ? names.join("、") : null
    }
    // 备货负责人：后勤里这一单勾给了谁（员工 → 结算页，staff_order_pay）。以后帮忙备货的人多了，
    // 纸上得写清楚这一箱是谁的（老板 2026-10-11）。没勾就留空，打出来手写。
    const { data: marks } = await supabase.from("staff_order_pay").select("order_id, staff_member_id").in("order_id", orders.map((o) => o.id))
    const ownerIds = Array.from(new Set((marks ?? []).map((m) => String(m.staff_member_id))))
    const { data: ownerRows } = ownerIds.length ? await supabase.from("staff_members").select("id, display_name, full_name").in("id", ownerIds) : { data: [] as Array<{ id: string; display_name: string | null; full_name: string | null }> }
    const ownerName = new Map((ownerRows ?? []).map((s) => [String(s.id), String(s.display_name ?? s.full_name ?? "").trim()]))
    for (const o of orders) {
      const names = (marks ?? []).filter((m) => m.order_id === o.id).map((m) => ownerName.get(String(m.staff_member_id)) ?? "").filter(Boolean)
      o.cooler.owner = names.length ? names.join("、") : null
    }
  }

  const unknown = orders.filter((o) => !o.menuKnown)
  // 装备库存（桌椅桌布餐具气罐）：跟需求放在一张清单里对着看。
  const { data: stock } = await supabase.from("equipment_stock").select("item_key, label, unit, qty, low_at, note, updated_at").order("item_key")
  // 食材库存：收据入库进来的，备料时拿来和需求对着看（"还差多少"）。
  const { data: pantryRows } = await supabase.from("pantry_stock").select("item_key, qty, unit, updated_at, counted_at")
  const pantry: Record<string, number> = {}
  for (const r of (pantryRows ?? []) as Array<{ item_key: string; qty: number }>) pantry[r.item_key] = Number(r.qty) || 0
  // 清单把四样蔬菜合成一行，所以库存也合起来比。
  pantry.mixed_vege = Math.round(VEG_IDS.reduce((n, k) => n + (pantry[k] ?? 0), 0) * 100) / 100
  // 补货去哪买：仓库品项上有 buy_channel，用 pantry_key 对回 BOM 的 id。
  const { data: whItems } = await supabase.from("warehouse_items").select("item_key, pantry_key, buy_channel, pack_label")
  const stores: Record<string, { channel: string | null; pack: string | null }> = {}
  for (const w of (whItems ?? []) as Array<{ item_key: string; pantry_key: string | null; buy_channel: string | null; pack_label: string | null }>) {
    const k = w.pantry_key || w.item_key
    if (k && !(k in stores)) stores[k] = { channel: w.buy_channel, pack: w.pack_label }
  }
  stores.mixed_vege = { channel: "Walmart", pack: null }

  // 占用（"别的单占了多少、可用 = 在库 − 占用"）2026-10-12 整套删掉：老板全选过一次备货，
  // 所有单的料就一直被占着，之后单算一单的缺口全是错的——"用不上"。现在缺口 = 要的 − 在库，
  // 勾哪几单就只算哪几单。这两个字段留空给页面兼容。
  const committed: Record<string, number> = {}
  const committedBy: Record<string, Array<{ orderId: string; name: string; date: string; time: string; qty: number }>> = {}

  const { data: consumed } = await supabase.from("stock_moves").select("id").eq("ref", `consume:${date}`).limit(1)
  return NextResponse.json(
    {
      ok: true,
      date: byOrders ? null : date,
      byOrders,
      stores,
      orderCount: orders.length,
      guestTotal: orders.reduce((n, o) => n + o.adults + o.kids, 0),
      orders,
      // pack = 这一行的采购单位，页面用它把缺口翻成"买几瓶/几盒"。
      // 备货模式把"蔬菜合计"拆成四样各一行（按单看的订单页还是一行合计）
      totals: aggregatePrep(allItems)
        .flatMap((i) => (byOrders && i.id === "mixed_vege" ? splitVeg(i) : [i]))
        .map((i) => ({ ...i, pack: BUY_UNITS[i.id] ?? null })),
      stock: stock ?? [],
      pantry,
      // 别的单占着的量：页面上「可用 = 在库 − 占用」，缺口按可用算。
      committed,
      // 占着的是哪几单、各占多少
      committedBy,
      // 蔬菜合计不单独记账：它的"上次盘点"= 四样里最近盘的那一次
      pantryDetail: [
        ...((pantryRows ?? []) as Array<{ item_key: string; counted_at: string | null }>).filter((r) => r.item_key !== "mixed_vege"),
        {
          item_key: "mixed_vege",
          qty: pantry.mixed_vege,
          counted_at:
            ((pantryRows ?? []) as Array<{ item_key: string; counted_at: string | null }>)
              .filter((r) => (VEG_IDS as readonly string[]).includes(r.item_key) && r.counted_at)
              .map((r) => r.counted_at as string)
              .sort()
              .pop() ?? null,
        },
      ],
      consumed: (consumed ?? []).length > 0,
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
  if (body.action === "consume") {
    const date = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : ""
    if (!date) return NextResponse.json({ error: "date required" }, { status: 400 })
    const items = Array.isArray(body.items) ? body.items : []
    const ref = `consume:${date}`
    let applied = 0
    for (const raw of items.slice(0, 60)) {
      const it = (raw ?? {}) as Record<string, unknown>
      const key = typeof it.item_key === "string" ? it.item_key : ""
      const qty = Number(it.qty)
      if (!key || !Number.isFinite(qty) || qty <= 0) continue
      const { error: moveErr } = await supabase
        .from("stock_moves")
        .insert({ item_key: key, delta: -qty, unit: stockUnit(key), reason: "consume", ref, note: `${date} 派对用料`, created_by: actor.alias })
      if (moveErr) {
        if (/duplicate key/i.test(moveErr.message)) continue
        return NextResponse.json({ error: moveErr.message }, { status: 500 })
      }
      const { data: cur } = await supabase.from("pantry_stock").select("qty").eq("item_key", key).maybeSingle()
      // 允许扣成 0，但不记负数：师傅多拿少拿是正常波动，负库存只会误导。
      const next = Math.max(0, Math.round(((Number(cur?.qty) || 0) - qty) * 100) / 100)
      const patch = { label: stockLabel(key), unit: stockUnit(key), qty: next, updated_by: actor.alias, updated_at: new Date().toISOString() }
      const { error: upErr } = cur
        ? await supabase.from("pantry_stock").update(patch).eq("item_key", key)
        : await supabase.from("pantry_stock").insert({ item_key: key, ...patch })
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
      applied++
    }
    return NextResponse.json({ ok: true, applied })
  }

  if (body.action === "set_pantry") {
    const key = typeof body.item_key === "string" ? body.item_key.trim().slice(0, 40) : ""
    const qty = Number(body.qty)
    if (!key || !Number.isFinite(qty) || qty < 0) return NextResponse.json({ error: "item_key / qty 不对" }, { status: 400 })
    const rounded = Math.round(qty * 100) / 100
    // 蔬菜合计：按比例改四样分开记的数（见 lib/prep-reservations.ts setVegTotal）
    if (key === "mixed_vege") {
      const before = await vegTotal(supabase)
      await setVegTotal(supabase, rounded, actor.alias, true)
      await supabase.from("stock_moves").insert({ item_key: key, delta: rounded - before, unit: "oz", reason: "count", note: "盘点（蔬菜合计，按比例分到四样）", created_by: actor.alias })
      return NextResponse.json({ ok: true })
    }
    const { data: cur } = await supabase.from("pantry_stock").select("qty").eq("item_key", key).maybeSingle()
    const patch = { label: stockLabel(key), unit: stockUnit(key), qty: rounded, counted_at: new Date().toISOString(), updated_by: actor.alias, updated_at: new Date().toISOString() }
    const { error } = cur
      ? await supabase.from("pantry_stock").update(patch).eq("item_key", key)
      : await supabase.from("pantry_stock").insert({ item_key: key, ...patch })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await supabase.from("stock_moves").insert({ item_key: key, delta: rounded - (Number(cur?.qty) || 0), unit: stockUnit(key), reason: "count", note: "盘点", created_by: actor.alias })
    return NextResponse.json({ ok: true })
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
