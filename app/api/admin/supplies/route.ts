import { type NextRequest, NextResponse } from "next/server"
import { can, resolveAdminActor } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// 食材成本分摊：采购流水（Walmart / Instacart / 仓库大宗）÷ 实际接待人数
// = 每人平均食材成本。用户 09-22 定的口径：不逐单称重（师傅多拿少拿属正常
// 波动），只看现金口径的滚动平均是否在正常区间。大宗（米/酱油/油/清酒）
// 天然被时间窗摊薄，所以看 30 天滚动比看单月更稳。
//
//   GET                  -> { purchases(近90天), stats: {month, prevMonth, rolling30 各含 spend/guests/perGuest/byCategory} }
//   POST add / delete    -> 记一笔 / 删一笔（只有老板）

const PT = "America/Los_Angeles"
const ptDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: PT })
const CATS = new Set(["fresh", "frozen", "pantry", "sake", "other"])

type Purchase = { id: string; purchased_on: string; channel: string; category: string; amount_cents: number; note: string | null }
type OrderLite = { event_start: string | null; guest_adult_count: number | null; guest_child_count: number | null; order_status: string | null }

function statsFor(purchases: Purchase[], orders: Array<{ day: string; guests: number }>, from: string, to: string) {
  const spend = purchases.filter((p) => p.purchased_on >= from && p.purchased_on <= to)
  const total = spend.reduce((n, p) => n + p.amount_cents, 0)
  const byCategory: Record<string, number> = {}
  for (const p of spend) byCategory[p.category] = (byCategory[p.category] ?? 0) + p.amount_cents
  const guests = orders.filter((o) => o.day >= from && o.day <= to).reduce((n, o) => n + o.guests, 0)
  return { from, to, spendCents: total, guests, perGuestCents: guests > 0 ? Math.round(total / guests) : null, byCategory }
}

export async function GET(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (!can(actor, "board")) return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "supabase not configured" }, { status: 500 })

  const today = ptDay(new Date())
  const d90 = new Date(Date.now() - 90 * 86400_000)
  const [{ data: purchases, error }, { data: orderRows, error: oerr }] = await Promise.all([
    supabase.from("supply_purchases").select("id, purchased_on, channel, category, amount_cents, note").gte("purchased_on", ptDay(d90)).order("purchased_on", { ascending: false }).limit(400),
    supabase.from("orders").select("event_start, guest_adult_count, guest_child_count, order_status").gte("event_start", d90.toISOString()).lte("event_start", new Date().toISOString()),
  ])
  if (error || oerr) return NextResponse.json({ error: (error ?? oerr)!.message }, { status: 500 })

  // 已经办完的场次才算人头（未来的派对还没吃掉食材）。
  const served = ((orderRows ?? []) as OrderLite[])
    .filter((o) => o.event_start && !/cancel|void|refund/i.test(o.order_status ?? ""))
    .map((o) => ({ day: ptDay(new Date(o.event_start as string)), guests: (o.guest_adult_count ?? 0) + (o.guest_child_count ?? 0) }))

  const monthStart = `${today.slice(0, 8)}01`
  const prevMonthEnd = ptDay(new Date(Date.parse(`${monthStart}T12:00:00Z`) - 86400_000 * 1.5))
  const prevMonthStart = `${prevMonthEnd.slice(0, 8)}01`
  const rolling30From = ptDay(new Date(Date.now() - 29 * 86400_000))

  return NextResponse.json(
    {
      ok: true,
      purchases: purchases ?? [],
      stats: {
        month: statsFor((purchases ?? []) as Purchase[], served, monthStart, today),
        prevMonth: statsFor((purchases ?? []) as Purchase[], served, prevMonthStart, prevMonthEnd),
        rolling30: statsFor((purchases ?? []) as Purchase[], served, rolling30From, today),
      },
    },
    { headers: { "cache-control": "no-store" } },
  )
}

export async function POST(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (actor.role !== "owner") return NextResponse.json({ error: "只有老板能记成本" }, { status: 403 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "supabase not configured" }, { status: 500 })
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  if (body.action === "add") {
    const on = typeof body.purchased_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.purchased_on) ? body.purchased_on : ptDay(new Date())
    const amount = Math.round(Number(body.amount) * 100)
    if (!Number.isFinite(amount) || amount <= 0 || amount > 20000_00) return NextResponse.json({ error: "金额不对" }, { status: 400 })
    const category = typeof body.category === "string" && CATS.has(body.category) ? body.category : "fresh"
    const channel = typeof body.channel === "string" ? body.channel.slice(0, 30) : "walmart"
    const note = typeof body.note === "string" ? body.note.slice(0, 200) : null
    const { data, error } = await supabase
      .from("supply_purchases")
      .insert({ purchased_on: on, channel, category, amount_cents: amount, note, created_by: actor.alias })
      .select("id")
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, id: data.id })
  }

  if (body.action === "delete") {
    if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) return NextResponse.json({ error: "id required" }, { status: 400 })
    const { error } = await supabase.from("supply_purchases").delete().eq("id", body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 })
}
