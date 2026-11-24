import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { resolveAdminActor } from "@/lib/admin-auth"
import { outsourcedMark, partnerInvoiceUrl } from "@/lib/outsourced"
import { cityOf } from "@/lib/customers"
import { instantToWallIso } from "@/lib/first-response"
import { paidToPartner, collectedByUs, DEFAULT_PARTNER_RATE_BPS, directionOf, parseRatePct, partnerLine, settledStatusOf, type PartnerPaymentRow } from "@/lib/partner-settlement"
import { ALLOCATION_COLS, assignPartner, isSettled, type AllocationRow } from "@/lib/partner-settlement-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 外包单结算（老板 2026-11-23）· 工作台「外包」页，只有老板能用。规则见 lib/partner-settlement.ts。
//   GET                                                    -> { partners, rows（每个外包单一行，带分账）}
//   POST { action: "add_partner", name, rate? }            -> 加一家合作公司（rate 是我们拿的百分比，默认 30）
//   POST { action: "update_partner", id, name?, rate?, active? }
//   POST { action: "assign", order_id, partner_id|null }   -> 这单给哪家（null = 未定）
//   POST { action: "set_rate", order_id, rate }            -> 单独改这一单我们拿的比例（没结的才能改）
//   POST { action: "settle", items:[{order_id, amount_cents?}], method, note? }
//                                                          -> 结清（同一家公司的几单一起）。amount_cents 是改过的净额，
//                                                             正数我们付对方、负数对方付我们；不填按算出来的
//   POST { action: "unsettle", order_id }                  -> 撤销结清，回到待结

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v)
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status })
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const cancelled = (s: string | null | undefined) => /cancel|void|refund/i.test(s ?? "")
const METHODS = new Set(["zelle", "cash", "check", "other"])

type Supa = NonNullable<ReturnType<typeof createServerSupabaseClient>>
type OrderRow = {
  id: string
  order_no: string
  customer_name: string | null
  event_start: string | null
  event_address: string | null
  guest_adult_count: number | null
  guest_child_count: number | null
  order_status: string | null
  quoted_total_cents: number | null
  balance_due_cents: number | null
  dispatch_plan: unknown
}
type PaymentRow = PartnerPaymentRow & { order_id: string }

async function owner(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return { error: fail("unauthorized", 401) }
  if (actor.role !== "owner") return { error: fail("只有老板能看外包结算", 403) }
  const supabase = createServerSupabaseClient()
  if (!supabase) return { error: fail("supabase not configured", 500) }
  return { actor, supabase }
}

const ORDER_COLS = "id, order_no, customer_name, event_start, event_address, guest_adult_count, guest_child_count, order_status, quoted_total_cents, balance_due_cents, dispatch_plan"

/** The numbers for one order as they stand now. */
async function liveNumbers(supabase: Supa, order: OrderRow, rateBps: number) {
  const { data } = await supabase.from("payments").select("order_id, provider, type, status, amount_cents, refunded_amount_cents, transaction_ref").eq("order_id", order.id)
  const pays = (data ?? []) as PaymentRow[]
  return partnerLine(order.quoted_total_cents ?? 0, rateBps, collectedByUs(pays))
}

export async function GET(request: NextRequest) {
  const o = await owner(request)
  if ("error" in o) return o.error
  const { supabase } = o
  const [{ data: partners }, { data: allocs }, { data: marked }] = await Promise.all([
    supabase.from("partners").select("id, name, default_rate_bps, active, notes").eq("partner_type", "contractor").order("created_at"),
    supabase.from("order_partner_allocations").select(ALLOCATION_COLS).eq("role", "contractor").neq("status", "voided"),
    supabase.from("orders").select(ORDER_COLS).not("dispatch_plan->outsourced", "is", null).order("event_start"),
  ])
  const allocByOrder = new Map(((allocs ?? []) as AllocationRow[]).map((a) => [a.order_id, a]))
  // Orders that are outsourced now, plus any that were settled with a partner and later changed (keep the record).
  const ids = new Set(((marked ?? []) as OrderRow[]).map((r) => r.id))
  const extraIds = Array.from(allocByOrder.keys()).filter((id) => !ids.has(id))
  const extra = extraIds.length ? (((await supabase.from("orders").select(ORDER_COLS).in("id", extraIds)).data ?? []) as OrderRow[]) : []
  const orders = [...((marked ?? []) as OrderRow[]), ...extra]
  const { data: payData } = orders.length
    ? await supabase.from("payments").select("order_id, provider, type, status, amount_cents, refunded_amount_cents, transaction_ref").in("order_id", orders.map((r) => r.id))
    : { data: [] }
  const paysBy = new Map<string, PaymentRow[]>()
  for (const p of (payData ?? []) as PaymentRow[]) paysBy.set(p.order_id, [...(paysBy.get(p.order_id) ?? []), p])
  const nowWall = instantToWallIso(Date.now())

  const rows = orders.map((r) => {
    const a = allocByOrder.get(r.id) ?? null
    const pays = paysBy.get(r.id) ?? []
    const rate = a?.rate_bps ?? DEFAULT_PARTNER_RATE_BPS
    const live = partnerLine(r.quoted_total_cents ?? 0, rate, collectedByUs(pays))
    const mark = outsourcedMark(r.dispatch_plan)
    const wall = r.event_start ? new Date(r.event_start).toISOString() : null
    return {
      orderId: r.id,
      orderNo: r.order_no,
      customer: (r.customer_name ?? "").trim() || "未留名",
      date: wall ? wall.slice(0, 10) : null,
      time: wall ? wall.slice(11, 16) : null,
      started: wall ? Date.parse(wall) <= Date.parse(nowWall) : false,
      city: cityOf(r.event_address) ?? "",
      adults: r.guest_adult_count ?? 0,
      kids: r.guest_child_count ?? 0,
      cancelled: cancelled(r.order_status),
      outsourced: !!mark,
      note: mark?.note ?? null,
      invoiceUrl: partnerInvoiceUrl(mark?.invoice_token),
      balanceDueCents: r.balance_due_cents ?? 0,
      offlineCents: paidToPartner(pays),
      live,
      allocation: a
        ? {
            partnerId: a.partner_id,
            rateBps: rate,
            status: a.status,
            settled: isSettled(a),
            settledAt: a.settled_at,
            settledBy: a.settled_by,
            method: a.settle_method,
            note: a.notes,
            // What changed hands when it was settled (signed like live.netCents: + we paid them, − they paid us).
            netCents: isSettled(a) ? (a.direction === "payable" ? 1 : -1) * (a.amount_cents ?? 0) : null,
            totalCents: a.total_cents,
            cutCents: a.our_cut_cents,
            collectedCents: a.collected_cents,
          }
        : null,
    }
  })
  return NextResponse.json({ ok: true, partners: partners ?? [], rows })
}

export async function POST(request: NextRequest) {
  const o = await owner(request)
  if ("error" in o) return o.error
  const { supabase, actor } = o
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return fail("invalid json")
  }
  const who = `workbench:${actor.alias}`
  const now = new Date().toISOString()
  try {
    switch (String(body.action ?? "")) {
      case "add_partner": {
        const name = str(body.name, 80)
        if (!name) return fail("公司名字要填")
        const rate = body.rate === undefined || body.rate === "" ? DEFAULT_PARTNER_RATE_BPS : parseRatePct(body.rate)
        if (rate === null) return fail("比例填 0–100 的数字，比如 30")
        const { data: dup } = await supabase.from("partners").select("id").ilike("name", name).maybeSingle()
        if (dup) return fail("已经有这家公司了", 409)
        const { data, error } = await supabase.from("partners").insert({ name, partner_type: "contractor", default_rate_bps: rate }).select("id, name, default_rate_bps, active").single()
        if (error) throw error
        return NextResponse.json({ ok: true, partner: data })
      }
      case "update_partner": {
        if (!isUuid(body.id)) return fail("id required")
        const patch: Record<string, unknown> = { updated_at: now }
        if (body.name !== undefined) {
          const name = str(body.name, 80)
          if (!name) return fail("公司名字不能空")
          patch.name = name
        }
        if (body.rate !== undefined) {
          const rate = parseRatePct(body.rate)
          if (rate === null) return fail("比例填 0–100 的数字，比如 30")
          patch.default_rate_bps = rate
        }
        if (typeof body.active === "boolean") patch.active = body.active
        const { data, error } = await supabase.from("partners").update(patch).eq("id", body.id).eq("partner_type", "contractor").select("id, name, default_rate_bps, active").maybeSingle()
        if (error) throw error
        if (!data) return fail("没有这家合作公司", 404)
        return NextResponse.json({ ok: true, partner: data })
      }
      case "assign": {
        if (!isUuid(body.order_id)) return fail("order_id required")
        const partnerId = body.partner_id === null || body.partner_id === "" ? null : isUuid(body.partner_id) ? body.partner_id : undefined
        if (partnerId === undefined) return fail("partner_id 要么是公司 id，要么 null（未定）")
        if (partnerId) {
          const { data: ord } = await supabase.from("orders").select("dispatch_plan").eq("id", body.order_id).maybeSingle()
          if (!ord) return fail("order not found", 404)
          if (!outsourcedMark((ord as { dispatch_plan?: unknown }).dispatch_plan)) return fail("这单不是外包单，先在当天的派单地图里点「外包」", 409)
        }
        const r = await assignPartner(supabase, body.order_id, partnerId, who)
        if (!r.ok) return fail(r.error, r.status)
        return NextResponse.json({ ok: true, changed: r.changed })
      }
      case "set_rate": {
        if (!isUuid(body.order_id)) return fail("order_id required")
        const rate = parseRatePct(body.rate)
        if (rate === null) return fail("比例填 0–100 的数字，比如 30")
        const { data: a } = await supabase.from("order_partner_allocations").select(ALLOCATION_COLS).eq("order_id", body.order_id).eq("role", "contractor").neq("status", "voided").maybeSingle()
        if (!a) return fail("这单还没选合作公司", 409)
        if (isSettled(a as AllocationRow)) return fail("已经结清了，先撤销结清再改", 409)
        const { error } = await supabase.from("order_partner_allocations").update({ rate_bps: rate, updated_at: now }).eq("id", (a as AllocationRow).id)
        if (error) throw error
        await supabase.from("order_events").insert({ order_id: body.order_id, actor: who, action: "outsource_rate_set", metadata: { rate_bps: rate, was: (a as AllocationRow).rate_bps } })
        return NextResponse.json({ ok: true })
      }
      case "settle": {
        const items = Array.isArray(body.items) ? (body.items as Array<Record<string, unknown>>) : []
        if (!items.length || items.some((i) => !isUuid(i.order_id))) return fail("items: [{ order_id, amount_cents? }]")
        const method = str(body.method, 20) || "zelle"
        if (!METHODS.has(method)) return fail("method: zelle / cash / check / other")
        const note = str(body.note, 300) || null
        const ids = items.map((i) => String(i.order_id))
        const [{ data: aRows }, { data: oRows }] = await Promise.all([
          supabase.from("order_partner_allocations").select(ALLOCATION_COLS).in("order_id", ids).eq("role", "contractor").neq("status", "voided"),
          supabase.from("orders").select(ORDER_COLS).in("id", ids),
        ])
        const aBy = new Map(((aRows ?? []) as AllocationRow[]).map((a) => [a.order_id, a]))
        const oBy = new Map(((oRows ?? []) as OrderRow[]).map((r) => [r.id, r]))
        const nowWall = instantToWallIso(Date.now())
        const partnerIds = new Set<string>()
        for (const id of ids) {
          const a = aBy.get(id)
          const ord = oBy.get(id)
          if (!ord) return fail("有一单找不到了，刷新再试", 404)
          if (!a) return fail(`${ord.order_no} 还没选合作公司`, 409)
          if (isSettled(a)) return fail(`${ord.order_no} 已经结清了`, 409)
          if (cancelled(ord.order_status)) return fail(`${ord.order_no} 已取消，不用结`, 409)
          if (!ord.event_start || Date.parse(new Date(ord.event_start).toISOString()) > Date.parse(nowWall)) return fail(`${ord.order_no} 还没办，办完再结`, 409)
          partnerIds.add(a.partner_id)
        }
        if (partnerIds.size !== 1) return fail("一次只结一家公司的单")
        const settled: Array<{ orderNo: string; netCents: number }> = []
        for (const it of items) {
          const id = String(it.order_id)
          const a = aBy.get(id)!
          const ord = oBy.get(id)!
          const line = await liveNumbers(supabase, ord, a.rate_bps ?? DEFAULT_PARTNER_RATE_BPS)
          const override = typeof it.amount_cents === "number" && Number.isFinite(it.amount_cents) ? Math.round(it.amount_cents) : null
          const net = override ?? line.netCents
          const { error } = await supabase
            .from("order_partner_allocations")
            .update({
              status: settledStatusOf(net),
              direction: directionOf(net),
              amount_cents: Math.abs(net),
              total_cents: line.totalCents,
              our_cut_cents: line.cutCents,
              collected_cents: line.collectedCents,
              settled_at: now,
              settled_by: who,
              settle_method: method,
              notes: note,
              updated_at: now,
            })
            .eq("id", a.id)
            .eq("status", a.status)
          if (error) throw error
          await supabase.from("order_events").insert({ order_id: id, actor: who, action: "outsource_settled", metadata: { partner_id: a.partner_id, net_cents: net, computed_cents: line.netCents, method, ...(note ? { note } : {}) } })
          settled.push({ orderNo: ord.order_no, netCents: net })
        }
        return NextResponse.json({ ok: true, settled, netCents: settled.reduce((s, x) => s + x.netCents, 0) })
      }
      case "unsettle": {
        if (!isUuid(body.order_id)) return fail("order_id required")
        const { data: a } = await supabase.from("order_partner_allocations").select(ALLOCATION_COLS).eq("order_id", body.order_id).eq("role", "contractor").neq("status", "voided").maybeSingle()
        if (!a || !isSettled(a as AllocationRow)) return fail("这单没有结清记录", 409)
        const { error } = await supabase
          .from("order_partner_allocations")
          .update({ status: "pending", direction: "receivable", amount_cents: null, total_cents: null, our_cut_cents: null, collected_cents: null, settled_at: null, settled_by: null, settle_method: null, notes: null, updated_at: now })
          .eq("id", (a as AllocationRow).id)
        if (error) throw error
        await supabase.from("order_events").insert({ order_id: body.order_id, actor: who, action: "outsource_unsettled", metadata: { was: { amount_cents: (a as AllocationRow).amount_cents, direction: (a as AllocationRow).direction, settled_at: (a as AllocationRow).settled_at } } })
        return NextResponse.json({ ok: true })
      }
      default:
        return fail("unknown action")
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : "出错了", 500)
  }
}
