import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { can, resolveAdminActor } from "@/lib/admin-auth"
import { monthlyStats, type MonthOrder, type MonthStat } from "@/lib/party-heads"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// 每月小结（2026-10-10）：场次、服务人数（大人 1 / 收费小孩 0.5 / 免费不计）、
// 营业额。日历页签的月份标题和看板的"每月服务人数"都读这里。
// 钱只给看得到看板的人（perms.board）；坐席拿到的 revenue 一律是 null。
// 订单表从 2026-09 才有；更早的月份只有客户主档里导入的场次（没有人数金额）。

const ptToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" })

export async function GET(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "supabase not configured" }, { status: 500 })
  const withMoney = can(actor, "board")

  const [{ data: orders, error }, { data: imported }] = await Promise.all([
    supabase
      .from("orders")
      .select("event_start, order_status, guest_adult_count, guest_child_count, invoice_data, quoted_total_cents, amount_paid_total_cents")
      .not("event_start", "is", null)
      .limit(5000),
    supabase.from("customer_events").select("event_date").is("order_id", null).limit(5000),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const today = ptToday()
  const months = monthlyStats((orders ?? []) as MonthOrder[], today, withMoney)
  const have = new Set(months.map((m) => m.month))
  const old = new Map<string, number>()
  for (const e of (imported ?? []) as Array<{ event_date: string | null }>) {
    const month = (e.event_date ?? "").slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(month) || have.has(month)) continue
    old.set(month, (old.get(month) ?? 0) + 1)
  }
  const history: MonthStat[] = Array.from(old.entries()).map(([month, parties]) => ({
    month,
    parties,
    done: parties,
    adults: 0,
    kids: 0,
    littles: 0,
    heads: 0,
    revenueCents: null,
    doneRevenueCents: null,
    paidCents: null,
    openParties: 0,
    openHeads: 0,
    openRevenueCents: null,
    countOnly: true,
  }))
  const all = [...history, ...months].sort((a, b) => a.month.localeCompare(b.month))
  return NextResponse.json({ ok: true, today, withMoney, months: all })
}
