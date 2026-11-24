import type { createServerSupabaseClient } from "@/lib/supabase"
import { DEFAULT_PARTNER_RATE_BPS } from "@/lib/partner-settlement"

// 外包单 → 合作公司的指派（order_partner_allocations 一单一行 role=contractor，没作废的只有一行，
// migrations/partner-settlement.sql）。服务器端用：工作台「外包」页和派单地图的「改成外包 / 改回直营」都走这里。

type Supa = NonNullable<ReturnType<typeof createServerSupabaseClient>>

export type AllocationRow = {
  id: string
  order_id: string
  partner_id: string
  rate_bps: number | null
  status: string
  direction: string | null
  amount_cents: number | null
  total_cents: number | null
  our_cut_cents: number | null
  collected_cents: number | null
  settled_at: string | null
  settled_by: string | null
  settle_method: string | null
  notes: string | null
}

export const ALLOCATION_COLS = "id, order_id, partner_id, rate_bps, status, direction, amount_cents, total_cents, our_cut_cents, collected_cents, settled_at, settled_by, settle_method, notes"

export const isSettled = (a: { status: string } | null | undefined) => a?.status === "paid" || a?.status === "received"

/** The order's live (not voided) contractor allocation, or null. */
export async function liveAllocation(supabase: Supa, orderId: string): Promise<AllocationRow | null> {
  const { data } = await supabase.from("order_partner_allocations").select(ALLOCATION_COLS).eq("order_id", orderId).eq("role", "contractor").neq("status", "voided").maybeSingle()
  return (data as AllocationRow | null) ?? null
}

export type AssignResult = { ok: true; changed: boolean; allocation: AllocationRow | null } | { ok: false; status: number; error: string }

/**
 * Point an outsourced order at a partner company (partnerId) or at none (null). A settled allocation is
 * never moved: the money already changed hands - undo the settlement first. The rate is the company's
 * default at the moment it is picked; switching company resets it to the new company's.
 */
export async function assignPartner(supabase: Supa, orderId: string, partnerId: string | null, actor: string): Promise<AssignResult> {
  const cur = await liveAllocation(supabase, orderId)
  if (cur && isSettled(cur)) return { ok: false, status: 409, error: "这单已经和合作公司结过账了，先在「外包」页撤销结清再换。" }
  const now = new Date().toISOString()
  if (!partnerId) {
    if (!cur) return { ok: true, changed: false, allocation: null }
    const { error } = await supabase.from("order_partner_allocations").update({ status: "voided", updated_at: now }).eq("id", cur.id)
    if (error) return { ok: false, status: 500, error: error.message }
    await supabase.from("order_events").insert({ order_id: orderId, actor, action: "outsource_partner_cleared", metadata: { partner_id: cur.partner_id } })
    return { ok: true, changed: true, allocation: null }
  }
  const { data: partner } = await supabase.from("partners").select("id, name, default_rate_bps").eq("id", partnerId).maybeSingle()
  if (!partner) return { ok: false, status: 404, error: "没有这家合作公司" }
  if (cur?.partner_id === partnerId) return { ok: true, changed: false, allocation: cur }
  const rate = typeof partner.default_rate_bps === "number" ? partner.default_rate_bps : DEFAULT_PARTNER_RATE_BPS
  let row: AllocationRow | null = null
  if (cur) {
    const { data, error } = await supabase.from("order_partner_allocations").update({ partner_id: partnerId, rate_bps: rate, updated_at: now }).eq("id", cur.id).select(ALLOCATION_COLS).single()
    if (error) return { ok: false, status: 500, error: error.message }
    row = data as AllocationRow
  } else {
    const { data, error } = await supabase
      .from("order_partner_allocations")
      .insert({ order_id: orderId, partner_id: partnerId, role: "contractor", direction: "receivable", settlement_model: "percentage", basis: "order_total_incl_travel", rate_bps: rate, status: "pending" })
      .select(ALLOCATION_COLS)
      .single()
    if (error) return { ok: false, status: 500, error: error.message }
    row = data as AllocationRow
  }
  await supabase.from("order_events").insert({ order_id: orderId, actor, action: "outsource_partner_set", metadata: { partner_id: partnerId, partner: partner.name, rate_bps: rate, ...(cur ? { was: cur.partner_id } : {}) } })
  return { ok: true, changed: true, allocation: row }
}
