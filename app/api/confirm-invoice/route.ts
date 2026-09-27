import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { orderPrep } from "@/lib/prep-bom"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// 客户确认发票。链接由工作台发出，带 ?o=<订单 id>（和 /pay 同一套口径：
// UUID 即钥匙，服务端现查，客户端不传任何金额或明细）。
//
//   GET  ?o=<id>   -> 这版单子的关键事实（日期/地址/人数/菜/桌椅/总价）+ 确认状态
//   POST {orderId} -> 记下"客户确认了第 N 版"；发票之后再改，版本号一涨，
//                     工作台自动变回"改后未确认"。幂等。

type OrderRow = {
  id: string
  order_no: string | null
  customer_name: string | null
  event_start: string | null
  event_address: string | null
  guest_adult_count: number | null
  guest_child_count: number | null
  order_status: string | null
  quoted_total_cents: number | null
  invoice_data: Record<string, unknown> | null
  created_at: string
  invoice_revision: number
  invoice_confirmed_at: string | null
  invoice_confirmed_revision: number | null
}

const COLS =
  "id, order_no, customer_name, event_start, event_address, guest_adult_count, guest_child_count, order_status, quoted_total_cents, invoice_data, created_at, invoice_revision, invoice_confirmed_at, invoice_confirmed_revision"

const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v)
const firstName = (n: string | null) => (n ?? "").trim().split(/\s+/)[0] || "there"

function summarize(o: OrderRow) {
  const inv = (o.invoice_data ?? {}) as Record<string, unknown>
  const prep = orderPrep(inv, o.created_at, o.guest_adult_count ?? 0, o.guest_child_count ?? 0, null)
  const guests = Array.isArray(inv.guests) ? (inv.guests as Array<Record<string, unknown>>) : []
  const littles = guests.filter((g) => g.isChild === true && g.isLittle === true).length
  const tableHeads =
    guests.length > 0
      ? guests.filter((g) => g.tablesChairs === true).length
      : Array.isArray(inv.partyWideAddons) && (inv.partyWideAddons as unknown[]).includes("tables_chairs")
        ? prep.adults + prep.kids
        : 0
  const utensilHeads = guests.length > 0 ? guests.filter((g) => g.utensils === true).length : 0
  const allergies = guests
    .map((g) => String(g.foodAllergy ?? "").trim())
    .filter(Boolean)
    .slice(0, 10)
  // event_start 是墙上时间存 UTC：直接按 UTC 读，别做时区换算。
  const ev = o.event_start ? new Date(o.event_start) : null
  return {
    ok: true as const,
    orderNo: o.order_no,
    firstName: firstName(o.customer_name),
    dateLabel: ev ? ev.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" }) : null,
    timeLabel: ev ? ev.toLocaleTimeString("en-US", { timeZone: "UTC", hour: "numeric", minute: "2-digit" }) : null,
    address: o.event_address,
    adults: prep.adults,
    kids: Math.max(0, prep.kids - littles),
    littles,
    menuKnown: prep.menuKnown,
    proteins: prep.proteinServings.map((p) => ({ label: p.label.split(" ")[0], servings: p.servings })),
    tableHeads,
    utensilHeads,
    allergies,
    totalCents: o.quoted_total_cents ?? null,
    state: o.invoice_confirmed_at ? (o.invoice_confirmed_revision === o.invoice_revision ? ("confirmed" as const) : ("stale" as const)) : ("pending" as const),
    confirmedAt: o.invoice_confirmed_at,
  }
}

async function loadOrder(orderId: string) {
  const supabase = createServerSupabaseClient()
  if (!supabase) return { supabase: null, order: null }
  const { data } = await supabase.from("orders").select(COLS).eq("id", orderId).maybeSingle()
  return { supabase, order: (data as OrderRow | null) ?? null }
}

export async function GET(request: NextRequest) {
  const orderId = (request.nextUrl.searchParams.get("o") ?? "").trim()
  if (!isUuid(orderId)) return NextResponse.json({ ok: false, error: "This link isn't valid." }, { status: 400 })
  const { order } = await loadOrder(orderId)
  if (!order || /cancel|void/i.test(order.order_status ?? "")) return NextResponse.json({ ok: false, error: "This link isn't valid anymore." }, { status: 404 })
  return NextResponse.json(summarize(order), { headers: { "cache-control": "no-store" } })
}

export async function POST(request: NextRequest) {
  let body: { orderId?: string }
  try {
    body = (await request.json()) as { orderId?: string }
  } catch {
    return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 })
  }
  if (!isUuid(body.orderId)) return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 })
  const { supabase, order } = await loadOrder(body.orderId)
  if (!supabase || !order || /cancel|void/i.test(order.order_status ?? "")) return NextResponse.json({ ok: false, error: "This link isn't valid anymore." }, { status: 404 })

  const now = new Date().toISOString()
  const already = order.invoice_confirmed_at && order.invoice_confirmed_revision === order.invoice_revision
  if (!already) {
    const { error } = await supabase
      .from("orders")
      .update({ invoice_confirmed_at: now, invoice_confirmed_revision: order.invoice_revision, invoice_confirmed_by: "customer", updated_at: now })
      .eq("id", order.id)
    if (error) return NextResponse.json({ ok: false, error: "Could not save — please text us instead." }, { status: 500 })
    await supabase.from("order_events").insert({
      order_id: order.id,
      actor: "customer:web",
      action: "invoice_confirmed",
      metadata: { revision: order.invoice_revision, via: "confirm_page" },
    })
  }
  return NextResponse.json({ ok: true, confirmedAt: already ? order.invoice_confirmed_at : now })
}
