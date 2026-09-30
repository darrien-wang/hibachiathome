import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase"
import { aggregatePrep, BUY_UNITS, orderPrep, type InvoiceLite, type PrepItem } from "@/lib/prep-bom"
import { isBulkItem, stockLabel, stockUnit, VEG_IDS } from "@/lib/pantry"
import { committedDetail, reserveForOrders, settleDueReservations } from "@/lib/prep-reservations"
import type { SetupSelection } from "@/config/table-themes"

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

  // 进门先把办完的派对结掉：占用变消耗，库存自动扣，不用人工划（老板 2026-09-29）。
  // 放在这里而不是定时任务——定时任务卡死过三天没人发现。
  await settleDueReservations(supabase).catch((e) => console.error("[prep] settle failed", e))

  const allItems: PrepItem[] = []
  // 每单各自的用量，用来写占用（合计那份是按品项汇总的，回不到单）。
  const perOrder: Array<{ orderId: string; items: Array<{ id: string; qty: number; unit: string }> }> = []
  const orders = rows.map((r) => {
    const prep = orderPrep(r.invoice_data, r.created_at, r.guest_adult_count ?? 0, r.guest_child_count ?? 0, r.setup_selection)
    const mine = prep.menuKnown ? prep.items : prep.items.filter((i) => i.group !== "protein")
    if (prep.menuKnown) allItems.push(...prep.items)
    else allItems.push(...prep.items.filter((i) => i.group !== "protein"))
    perOrder.push({ orderId: r.id, items: reservableItems(mine) })
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
    }
  })

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

  // 勾了单来算缺口 = 这几单的料被占住了。幂等，随便重算。
  if (byOrders && perOrder.length > 0) {
    await reserveForOrders(supabase, perOrder).catch((e) => console.error("[prep] reserve failed", e))
  }
  // 别的还占着料的单，按现在的菜单和配方重算一遍：菜单改了、配方改了（09-30 面改按干重、
  // DIY 的虾鸡并进总量、大宗不占用），占用跟着变，不留旧数。
  // 只跳过刚占过的那几单（按日期看的模式没占，不跳）。
  await refreshOtherReservations(supabase, new Set(byOrders ? rows.map((r) => r.id) : [])).catch((e) => console.error("[prep] refresh failed", e))
  // 别的单还占着多少——可用 = 在库 − 这个。不含正在算的这几单，否则自己扣自己。
  const detail = await committedDetail(supabase, rows.map((r) => r.id)).catch(() => ({ totals: {} as Record<string, number>, byItem: {} as Record<string, Array<{ orderId: string; qty: number }>> }))
  const committed = detail.totals
  // 蔬菜的占用记在 mixed_vege 上（和清单同一行），四样分开记的库存那边另算；原来这里用四样
  // 分开的占用之和把它盖掉了，而那个和永远是 0——蔬菜的"别的单占了"就一直显示没有。
  committed.mixed_vege = Math.round(((committed.mixed_vege ?? 0) + VEG_IDS.reduce((n, k) => n + (committed[k] ?? 0), 0)) * 100) / 100

  // 占着的是哪几单：带上名字和日子，页面上点"别的单占了"就能看到（老板 2026-09-30）
  const holderIds = Array.from(new Set(Object.values(detail.byItem).flatMap((l) => l.map((x) => x.orderId))))
  const { data: holderRows } = holderIds.length
    ? await supabase.from("orders").select("id, customer_name, event_start").in("id", holderIds)
    : { data: [] as Array<{ id: string; customer_name: string | null; event_start: string | null }> }
  const holderOf = new Map(
    ((holderRows ?? []) as Array<{ id: string; customer_name: string | null; event_start: string | null }>).map((o) => [
      o.id,
      {
        name: (o.customer_name ?? "").trim() || "未留名",
        date: (o.event_start ?? "").slice(5, 10),
        time: o.event_start ? new Date(o.event_start).toLocaleTimeString("en-US", { timeZone: "UTC", hour: "numeric", minute: "2-digit" }) : "",
        sort: o.event_start ?? "",
      },
    ]),
  )
  const committedBy: Record<string, Array<{ orderId: string; name: string; date: string; time: string; qty: number }>> = {}
  for (const [item, list] of Object.entries(detail.byItem)) {
    committedBy[item] = list
      .map((x) => ({ orderId: x.orderId, qty: x.qty, ...(holderOf.get(x.orderId) ?? { name: "（订单已删）", date: "", time: "", sort: "" }) }))
      .sort((a, b) => a.sort.localeCompare(b.sort))
      .map(({ sort: _sort, ...h }) => h)
  }
  committedBy.mixed_vege = [...(committedBy.mixed_vege ?? []), ...VEG_IDS.flatMap((k) => committedBy[k] ?? [])]

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
      totals: aggregatePrep(allItems).map((i) => ({ ...i, pack: BUY_UNITS[i.id] ?? null })),
      stock: stock ?? [],
      pantry,
      // 别的单占着的量：页面上「可用 = 在库 − 占用」，缺口按可用算。
      committed,
      // 占着的是哪几单、各占多少
      committedBy,
      pantryDetail: pantryRows ?? [],
      consumed: (consumed ?? []).length > 0,
      warnings: unknown.map((o) => `${o.timeLabel} ${o.name}（${o.adults + o.kids} 人）菜单未定——蛋白质没算进合计，买前先把菜单问回来`),
    },
    { headers: { "cache-control": "no-store" } },
  )
}

/**
 * 一单的用料 → 占用行。装车的桌椅是周转品，不是吃掉的东西，不进占用；
 * 米、油、酱油是大宗，缺了直接买，也不进（老板 2026-09-30）。
 */
function reservableItems(items: PrepItem[]): Array<{ id: string; qty: number; unit: string }> {
  return aggregatePrep(items)
    .filter((i) => i.group !== "setup" && !isBulkItem(i.id))
    .map((i) => ({ id: i.id, qty: i.qty, unit: i.unit }))
}

type Supabase = NonNullable<ReturnType<typeof createServerSupabaseClient>>

/** 还占着料、但这次没勾的单：按现在的配方重算它们的占用。 */
async function refreshOtherReservations(supabase: Supabase, skip: Set<string>) {
  const { data: open } = await supabase.from("prep_reservations").select("order_id").is("settled_at", null)
  const ids = Array.from(new Set(((open ?? []) as Array<{ order_id: string }>).map((r) => r.order_id))).filter((id) => !skip.has(id))
  if (ids.length === 0) return
  const { data } = await supabase
    .from("orders")
    .select("id, order_no, customer_name, event_start, event_address, guest_adult_count, guest_child_count, order_status, created_at, invoice_data, setup_selection")
    .in("id", ids)
  // 只动还没办的单：办过的归 settleDueReservations 结转；这里要是重写了它的行，
  // upsert 会把已结转的行翻回"占着"，下次就扣两遍库存。
  const today = ptDay(new Date())
  const live = ((data ?? []) as Row[]).filter((r) => !/cancel|void|refund/i.test(r.order_status ?? "") && (r.event_start ?? "").slice(0, 10) >= today)
  const perOrder = live.map((r) => {
    const prep = orderPrep(r.invoice_data, r.created_at, r.guest_adult_count ?? 0, r.guest_child_count ?? 0, r.setup_selection)
    return { orderId: r.id, items: reservableItems(prep.menuKnown ? prep.items : prep.items.filter((i) => i.group !== "protein")) }
  })
  if (perOrder.length) await reserveForOrders(supabase, perOrder)
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

  // 释放一单的占用（老板 2026-09-30："我的备货明明没有够到他"）：这单没备，就别占着料。
  // 只删还没结转的行；以后再勾上这单算缺口，会重新占。
  if (body.action === "release") {
    const orderId = typeof body.order_id === "string" && /^[0-9a-f-]{36}$/i.test(body.order_id) ? body.order_id : ""
    if (!orderId) return NextResponse.json({ error: "order_id required" }, { status: 400 })
    const { data, error } = await supabase.from("prep_reservations").delete().eq("order_id", orderId).is("settled_at", null).select("item_key")
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, released: (data ?? []).length })
  }

  if (body.action === "set_pantry") {
    const key = typeof body.item_key === "string" ? body.item_key.trim().slice(0, 40) : ""
    const qty = Number(body.qty)
    if (!key || !Number.isFinite(qty) || qty < 0) return NextResponse.json({ error: "item_key / qty 不对" }, { status: 400 })
    const rounded = Math.round(qty * 100) / 100
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
