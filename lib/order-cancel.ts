import type { SupabaseClient } from "@supabase/supabase-js"
import { notifyRemovedChefs, partyLabelZh, type ChefNoticeResult } from "@/lib/chef-notify"
import { instantToWallIso, wallToInstant } from "@/lib/first-response"
import type { SendSmsResult } from "@/lib/sms-thread"

// Cancel an order (order-flow rebuild 2026-11-11, D-1111-03).
//
// There was no cancel action: 11-07 and 11-11 were done by hand in SQL, six
// steps each, and the chef heard only because someone remembered to text him.
// One call now does all of it, in this order:
//
//   1. the order   order_status cancelled, date_lock_status not_locked,
//                  calendar_status not_synced - the same three columns as the
//                  invoice app's processOrderCancelled (lib/integration-service.ts)
//   2. the chefs   every chef and helper on the party is texted in Chinese and
//                  his prep-sheet link revoked (lib/chef-notify.ts), then the
//                  assignments are cancelled
//   3. the record  an order_cancelled event with the reason and who was told,
//                  and a pending cancel_calendar job, as the reference queues
//   4. the lead    marked lost with the reason ([lost] … [why] …) - unless the
//                  customer has another party coming up
//
// It never charges anything. Inside 48 hours the policy allows a $99 fee
// (D-1006-04): the result says so and leaves the decision to the owner.
// Nothing is refunded either; money already taken is named for him to settle.
//
// `dryRun` reads and plans: no write, no text. An order that is already
// cancelled is finished rather than refused - chefs still on it are told and
// taken off - so a cancellation that came in another way (a refund, SQL) can be
// completed with the same command.

const ACTIVE_ASSIGNMENT = ["tentative", "confirmed", "completed"]
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ORDER_NO = /^RH-\d{8}-\d{4}$/
export const LATE_CANCEL_HOURS = 48

type OrderRow = {
  id: string
  order_no: string | null
  customer_name: string | null
  customer_phone: string | null
  event_start: string | null
  event_address: string | null
  order_status: string | null
  amount_paid_total_cents: number | null
  source_metadata: Record<string, unknown> | null
}
type AssignmentRow = { id: string; staff_member_id: string; assignment_role: string | null; pay_settled_at: string | null; settled_at: string | null }
type LeadRow = { id: string; status: string | null; full_name: string | null }

export type CancelOutcome = {
  ok: true
  dryRun: boolean
  /** The order was cancelled before this call. */
  already: boolean
  /** Already cancelled, nobody left to tell, lead already closed. */
  nothingToDo: boolean
  orderId: string
  orderNo: string | null
  customerName: string | null
  eventStart: string | null
  /** "11月14日下午5:30 Irvine（Joyce）" */
  party: string
  reason: string
  hoursToParty: number | null
  within48h: boolean
  /** Set inside 48 hours: the $99 is the owner's call, the system charges nothing. */
  lateFeeNote: string | null
  assignmentsCancelled: number
  chefs: ChefNoticeResult[]
  lead: { id: string; was: string | null; markedLost: boolean; kept?: string } | null
  warnings: string[]
}
export type CancelFailure = { ok: false; status: number; error: string }

const digits10 = (phone: string | null | undefined) => String(phone ?? "").replace(/\D/g, "").slice(-10)
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`

export async function cancelOrder(
  supabase: SupabaseClient,
  input: {
    orderId?: string | null
    orderNo?: string | null
    reason: string
    /** Who did it, as the audit trail names them: "workbench:Darrien", "desk:owner". */
    actor: string
    dryRun?: boolean
    now?: number
    send?: (phone: string, body: string) => Promise<SendSmsResult>
  },
): Promise<CancelOutcome | CancelFailure> {
  const now = input.now ?? Date.now()
  const dryRun = input.dryRun === true
  const reason = (input.reason ?? "").replace(/\s+/g, " ").trim().slice(0, 500)
  if (reason.length < 2) return { ok: false, status: 400, error: "取消原因必填：会记在订单和线索上" }
  const orderId = (input.orderId ?? "").trim()
  const orderNo = (input.orderNo ?? "").trim()
  if (!UUID.test(orderId) && !ORDER_NO.test(orderNo)) return { ok: false, status: 400, error: "orderId or orderNo required" }

  const columns = "id, order_no, customer_name, customer_phone, event_start, event_address, order_status, amount_paid_total_cents, source_metadata"
  const found = UUID.test(orderId)
    ? await supabase.from("orders").select(columns).eq("id", orderId).maybeSingle()
    : await supabase.from("orders").select(columns).eq("order_no", orderNo).maybeSingle()
  if (found.error) return { ok: false, status: 500, error: found.error.message }
  const order = found.data as OrderRow | null
  if (!order) return { ok: false, status: 404, error: "订单不存在" }
  const already = order.order_status === "cancelled"

  const { data: asgRows, error: asgError } = await supabase
    .from("order_staff_assignments")
    .select("id, staff_member_id, assignment_role, pay_settled_at, settled_at")
    .eq("order_id", order.id)
    .in("assignment_status", ACTIVE_ASSIGNMENT)
  if (asgError) return { ok: false, status: 500, error: asgError.message }
  const assignments = (asgRows ?? []) as AssignmentRow[]

  // event_start is the PT wall clock stored as UTC: turn it into the real instant before comparing with now.
  const start = order.event_start ? wallToInstant(order.event_start) : NaN
  const hoursToParty = Number.isFinite(start) ? Math.round(((start - now) / 3600_000) * 10) / 10 : null
  const within48h = hoursToParty !== null && hoursToParty < LATE_CANCEL_HOURS
  const lateFeeNote = within48h
    ? `${hoursToParty! >= 0 ? `离派对只有 ${Math.round(hoursToParty!)} 小时` : `派对时间已经过了 ${Math.round(-hoursToParty!)} 小时`}（不到 ${LATE_CANCEL_HOURS} 小时）：按政策可以收 $99 取消费，系统没有扣，收不收由老板定。`
    : null

  const warnings: string[] = []
  const paid = Math.max(0, Number(order.amount_paid_total_cents ?? 0))
  if (paid > 0) warnings.push(`这单已经收过 ${money(paid)}，系统不会自动退，退不退由老板定。`)
  const paidEarly = assignments.filter((a) => a.pay_settled_at || a.settled_at)
  if (paidEarly.length) warnings.push(`有 ${paidEarly.length} 位师傅这场的工钱已经结过（提前结算），取消后要在下一期结算里扣回。`)

  // ---- the lead ---------------------------------------------------------------
  const meta = order.source_metadata ?? {}
  const leadId = typeof meta.lead_id === "string" && UUID.test(meta.lead_id) ? meta.lead_id : null
  let lead: LeadRow | null = null
  if (leadId) {
    const { data } = await supabase.from("leads").select("id, status, full_name").eq("id", leadId).maybeSingle()
    lead = (data as LeadRow | null) ?? null
  }
  let leadPlan: CancelOutcome["lead"] = null
  if (lead) {
    const closed = lead.status === "lost" || lead.status === "disqualified"
    let kept: string | undefined
    if (closed) kept = `线索已经是 ${lead.status}`
    else {
      // Another party of theirs still to come = still a customer; "lost" would be wrong.
      const { data: others } = await supabase
        .from("orders")
        .select("id, order_no, event_start, order_status, customer_phone, source_metadata")
        .eq("deposit_status", "paid_verified")
        .neq("id", order.id)
        .or("order_status.is.null,order_status.neq.cancelled")
        .or(`event_start.is.null,event_start.gte.${instantToWallIso(now)}`)
        .limit(500)
      const mine = digits10(order.customer_phone)
      const upcoming = ((others ?? []) as Array<{ id: string; order_no: string | null; event_start: string | null; order_status: string | null; customer_phone: string | null; source_metadata: Record<string, unknown> | null }>).find((o) => {
        if (o.id === order.id || o.order_status === "cancelled") return false
        const sameLead = (o.source_metadata ?? {}).lead_id === lead!.id
        const samePhone = mine.length === 10 && digits10(o.customer_phone) === mine
        if (!sameLead && !samePhone) return false
        return !o.event_start || wallToInstant(o.event_start) > now
      })
      if (upcoming) kept = `客人还有一场没办的派对（${upcoming.order_no ?? upcoming.id}），线索不标流失`
    }
    leadPlan = { id: lead.id, was: lead.status, markedLost: !kept, ...(kept ? { kept } : {}) }
  } else {
    warnings.push("订单上没有挂线索（lead_id），线索状态没动，自己看一下。")
  }

  const party = partyLabelZh(order)
  const base = {
    ok: true as const,
    dryRun,
    already,
    orderId: order.id,
    orderNo: order.order_no,
    customerName: order.customer_name,
    eventStart: order.event_start,
    party,
    reason,
    hoursToParty,
    within48h,
    lateFeeNote,
    assignmentsCancelled: assignments.length,
    lead: leadPlan,
    warnings,
  }
  const nothingToDo = already && assignments.length === 0 && !(leadPlan?.markedLost ?? false)
  const staffIds = assignments.map((a) => a.staff_member_id)

  if (dryRun || nothingToDo) {
    const chefs = nothingToDo ? [] : await notifyRemovedChefs(supabase, { order, staffIds, reason: "cancelled", now, dryRun: true })
    return { ...base, nothingToDo, chefs }
  }

  const nowIso = new Date(now).toISOString()
  // 1. the order
  if (!already) {
    const { error } = await supabase
      .from("orders")
      .update({ order_status: "cancelled", date_lock_status: "not_locked", calendar_status: "not_synced", updated_at: nowIso })
      .eq("id", order.id)
    if (error) return { ok: false, status: 500, error: `订单没取消成：${error.message}` }
  }
  // 2. the chefs: told first, then taken off (a crash in between repeats a text; the other order leaves him untold)
  const chefs = await notifyRemovedChefs(supabase, { order, staffIds, reason: "cancelled", now, send: input.send })
  if (assignments.length) {
    const { error } = await supabase.from("order_staff_assignments").update({ assignment_status: "cancelled", updated_at: nowIso }).in("id", assignments.map((a) => a.id))
    if (error) warnings.push(`派工没撤成（${error.message}），到员工页手动撤。`)
  }
  // 3. the record
  const told = chefs.map((c) => ({ staff_member_id: c.staffId, name: c.name, to: c.phone, sms: c.texted ? { sid: c.sid ?? null } : { error: c.error ?? c.skipped ?? "not_sent" }, links_revoked: c.linksRevoked, text: c.text }))
  const { error: eventError } = await supabase.from("order_events").insert({
    order_id: order.id,
    actor: input.actor,
    action: "order_cancelled",
    metadata: {
      reason,
      ...(already ? { followup: true } : {}),
      hours_to_party: hoursToParty,
      within_48h: within48h,
      late_fee: within48h ? "not_charged_owner_decides" : null,
      assignments_cancelled: assignments.length,
      chefs: told,
      lead_id: leadPlan?.id ?? null,
      lead_marked_lost: leadPlan?.markedLost ?? false,
    },
  })
  if (eventError) warnings.push(`订单事件没记上（${eventError.message}）。`)
  if (!already) {
    // The reference queues the calendar cancel; one pending job per order is enough.
    try {
      const { data: pending } = await supabase.from("integration_jobs").select("id").eq("order_id", order.id).eq("job_type", "cancel_calendar").eq("status", "pending").limit(1)
      if (!(pending ?? []).length) {
        await supabase.from("integration_jobs").insert({ order_id: order.id, job_type: "cancel_calendar", status: "pending", payload: { trigger: "workbench.order_cancel", reason, actor: input.actor } })
      }
    } catch {
      // the calendar job is best effort: nothing reads the queue today
    }
  }
  // 4. the lead
  if (leadPlan?.markedLost) {
    const alias = input.actor.split(":").pop() || input.actor
    const { error } = await supabase.from("leads").update({ status: "lost", acked_until: nowIso, updated_at: nowIso }).eq("id", leadPlan.id)
    if (error) {
      warnings.push(`线索没标成流失（${error.message}），手动标一下。`)
      leadPlan = { ...leadPlan, markedLost: false, kept: "写库失败" }
    } else {
      await supabase.from("lead_touchpoints").insert([
        { lead_id: leadPlan.id, touchpoint_type: "agent_status_change", touchpoint_source: "admin_dashboard", raw_payload_json: { status: "lost", actor: alias, via: "order_cancel", order_no: order.order_no } },
        { lead_id: leadPlan.id, touchpoint_type: "agent_note", touchpoint_source: "admin_dashboard", raw_payload_json: { note: `[lost] 订单 ${order.order_no ?? order.id} 已取消。[why] ${reason}`.slice(0, 2000), actor: alias } },
      ])
    }
  }
  return { ...base, lead: leadPlan, nothingToDo: false, chefs, warnings }
}
