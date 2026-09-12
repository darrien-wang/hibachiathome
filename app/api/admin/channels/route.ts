import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { resolveAdminActor } from "@/lib/admin-auth"
import { deriveScore, type ChannelGroup, type ChannelScore } from "@/lib/channels"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Channel scorecard: every channel on the same definition (decision log §1).
//   GET  ?from&to        per-channel totals + blended row + daily series
//   POST ?action=sweep   resolve acquisition_* on orders that have none
// Numbers come from the channel_scorecard_daily view, so this route and the
// daily report cannot disagree.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function ptDate(offsetDays: number): string {
  return new Date(Date.now() - offsetDays * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" })
}

type DailyRow = {
  date: string
  channel: string
  channel_group: ChannelGroup
  cost_cents: number
  clicks: number
  impressions: number
  platform_conversions: number
  leads: number
  leads_qualified: number
  deposits: number
  revenue_cents: number
}

export async function GET(request: NextRequest) {
  if (!resolveAdminActor(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })
  const p = request.nextUrl.searchParams
  const from = DATE_RE.test(p.get("from") ?? "") ? (p.get("from") as string) : ptDate(13)
  const to = DATE_RE.test(p.get("to") ?? "") ? (p.get("to") as string) : ptDate(0)

  const { data, error } = await supabase
    .from("channel_scorecard_daily")
    .select("*")
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true })
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  const daily = (data ?? []) as DailyRow[]

  const byChannel = new Map<string, Omit<ChannelScore, "cpcCents" | "cplCents" | "cpaCents" | "leadToDepositRate" | "thin">>()
  for (const r of daily) {
    const acc = byChannel.get(r.channel) ?? {
      channel: r.channel,
      group: r.channel_group,
      costCents: 0,
      clicks: 0,
      impressions: 0,
      platformConversions: 0,
      leads: 0,
      leadsQualified: 0,
      deposits: 0,
      revenueCents: 0,
    }
    acc.costCents += Number(r.cost_cents)
    acc.clicks += Number(r.clicks)
    acc.impressions += Number(r.impressions)
    acc.platformConversions += Number(r.platform_conversions)
    acc.leads += Number(r.leads)
    acc.leadsQualified += Number(r.leads_qualified)
    acc.deposits += Number(r.deposits)
    acc.revenueCents += Number(r.revenue_cents)
    byChannel.set(r.channel, acc)
  }
  const groupOrder: Record<ChannelGroup, number> = { paid: 0, referral: 1, organic: 2, direct: 3, unresolved: 4 }
  const channels = [...byChannel.values()].map(deriveScore).sort((a, b) => groupOrder[a.group] - groupOrder[b.group] || b.costCents - a.costCents || b.deposits - a.deposits)

  // Blended = all paid spend ÷ deposits from every channel. This is the
  // North-Star number (综合 CPA), the one the ≤$150 target is judged on.
  const totalSpend = channels.reduce((a, c) => a + c.costCents, 0)
  const totalDeposits = channels.reduce((a, c) => a + c.deposits, 0)
  const totalLeads = channels.reduce((a, c) => a + c.leads, 0)
  const totalRevenue = channels.reduce((a, c) => a + c.revenueCents, 0)
  const paidDeposits = channels.filter((c) => c.group === "paid").reduce((a, c) => a + c.deposits, 0)
  const blended = {
    costCents: totalSpend,
    deposits: totalDeposits,
    leads: totalLeads,
    revenueCents: totalRevenue,
    blendedCpaCents: totalSpend > 0 && totalDeposits > 0 ? Math.round(totalSpend / totalDeposits) : null,
    paidCpaCents: totalSpend > 0 && paidDeposits > 0 ? Math.round(totalSpend / paidDeposits) : null,
    freeDeposits: totalDeposits - paidDeposits,
    targetCpaCents: 15000,
    ultimateCpaCents: 8000,
  }

  // Unresolved orders in the window are the attribution debt to sweep.
  const { count: unresolved } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .is("acquisition_channel", null)
    .eq("deposit_status", "paid_verified")

  return NextResponse.json({ ok: true, from, to, channels, blended, daily, unresolvedOrders: unresolved ?? 0 })
}

export async function POST(request: NextRequest) {
  const actor = resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })
  const action = request.nextUrl.searchParams.get("action")
  if (action === "sweep") {
    const dryRun = request.nextUrl.searchParams.get("dry") === "1"
    const { data, error } = await supabase.rpc("rh_sweep_order_acquisition", { p_dry_run: dryRun })
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, dryRun, resolved: data ?? [] })
  }
  return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 })
}
