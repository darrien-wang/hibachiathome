import type { SupabaseClient } from "@supabase/supabase-js"
import {
  applyPromise,
  normalizeDispatchPlan,
  parseStaffingPromise,
  PROMISE_TOUCHPOINT_SOURCE,
  PROMISE_TOUCHPOINT_TYPE,
  type ParsedPromise,
  type StaffingPromise,
} from "@/lib/dispatch-plan"
import { orderPaidHeads } from "@/lib/dispatch-plan-order"

// Promise capture (2026-10-18). What the desk tells a customer about staffing -
// "2 chefs and 2 grills for 30", "each chef cooks from an open end", "we'll set
// the two stations by the pool" - is a commitment the chefs have to see. Until
// now it lived only in the SMS thread (Eileen Heng, RH-20260919-0223: promised
// on 10-04 and 10-07, cooked on one grill on 10-17). Every outbound text and
// email passes through here: the promise is written on the lead's timeline
// (lead_touchpoints, type "promise") so order creation copies it, and onto any
// upcoming order of that customer right away.

export type CaptureInput = {
  text: string
  /** Twilio message SID or email provider id; the idempotency key. */
  sid: string | null
  via: "sms" | "email"
  leadId: string | null
  /** E.164; used to find the customer's upcoming orders when the lead carries none. */
  phone?: string | null
  email?: string | null
  /** When the message went out (ISO); defaults to now. */
  at?: string
  actor?: string
}

export type CaptureResult = {
  promise: ParsedPromise
  touchpointWritten: boolean
  /** Orders whose dispatch_plan now carries the promise. */
  ordersPatched: Array<{ id: string; order_no: string | null; chefs: number; grills: number }>
}

type OrderLite = {
  id: string
  order_no: string | null
  event_start: string | null
  guest_adult_count: number | null
  guest_child_count: number | null
  invoice_data: unknown
  dispatch_plan: unknown
  source_metadata: Record<string, unknown> | null
  customer_phone: string | null
}

const ORDER_COLUMNS = "id, order_no, event_start, guest_adult_count, guest_child_count, invoice_data, dispatch_plan, source_metadata, customer_phone, order_status"

/** Upcoming, not cancelled orders of this lead and/or phone. */
export async function upcomingOrdersFor(supabase: SupabaseClient, who: { leadId?: string | null; phone?: string | null }): Promise<OrderLite[]> {
  const nowWall = new Date().toISOString().slice(0, 19)
  const seen = new Map<string, OrderLite>()
  const take = (rows: unknown) => {
    for (const r of (rows ?? []) as Array<OrderLite & { order_status: string | null }>) {
      if (/cancel|void|refund/i.test(r.order_status ?? "")) continue
      seen.set(r.id, r)
    }
  }
  if (who.leadId && /^[0-9a-f-]{36}$/i.test(who.leadId)) {
    const { data } = await supabase.from("orders").select(ORDER_COLUMNS).eq("source_metadata->>lead_id", who.leadId).gte("event_start", nowWall).limit(10)
    take(data)
  }
  const digits = (who.phone ?? "").replace(/\D/g, "").slice(-10)
  if (digits.length === 10) {
    const { data } = await supabase.from("orders").select(ORDER_COLUMNS).ilike("customer_phone", `%${digits}`).gte("event_start", nowWall).limit(10)
    take(data)
  }
  return [...seen.values()]
}

/** Write the promise on the order's plan (lib/dispatch-plan applyPromise) and log it. */
export async function patchOrderPlan(supabase: SupabaseClient, order: OrderLite, promise: StaffingPromise, actor: string): Promise<{ chefs: number; grills: number } | null> {
  const existing = normalizeDispatchPlan(order.dispatch_plan)
  const at = new Date().toISOString()
  const plan = applyPromise(existing, promise, orderPaidHeads(order), at)
  // Same promise already on the order: nothing to write.
  if (existing?.promise?.sid && promise.sid && existing.promise.sid === promise.sid && existing.chefs === plan.chefs && existing.grills === plan.grills) return null
  const { error } = await supabase.from("orders").update({ dispatch_plan: plan, required_staff_count: plan.chefs, updated_at: at }).eq("id", order.id)
  if (error) throw new Error(`dispatch_plan update failed: ${error.message}`)
  await supabase.from("order_events").insert({
    order_id: order.id,
    actor,
    action: "dispatch_plan_set",
    metadata: { source: plan.source, chefs: plan.chefs, grills: plan.grills, stations_note: plan.stations_note ?? null, promise: { chefs: promise.chefs, grills: promise.grills, sid: promise.sid, at: promise.at, via: promise.via ?? null }, was: existing ? { source: existing.source, chefs: existing.chefs, grills: existing.grills } : null },
  })
  return { chefs: plan.chefs, grills: plan.grills }
}

/**
 * Read one outbound message for a staffing promise; when it makes one, record
 * it on the lead and on the customer's upcoming orders. Never throws for a
 * message that makes no promise. Idempotent on the message id.
 */
export async function captureStaffingPromise(supabase: SupabaseClient, input: CaptureInput): Promise<CaptureResult | null> {
  const parsed = parseStaffingPromise(input.text)
  if (!parsed) return null
  const at = input.at ?? new Date().toISOString()
  const actor = input.actor ?? "promise_capture"
  const promise: StaffingPromise = {
    chefs: parsed.chefs,
    grills: parsed.grills,
    text: parsed.text,
    sid: input.sid,
    at,
    via: input.via,
    lead_id: input.leadId ?? null,
    ...(parsed.stations_note ? { stations_note: parsed.stations_note } : {}),
  }

  let touchpointWritten = false
  if (input.leadId && /^[0-9a-f-]{36}$/i.test(input.leadId)) {
    const { error } = await supabase.from("lead_touchpoints").insert({
      lead_id: input.leadId,
      touchpoint_type: PROMISE_TOUCHPOINT_TYPE,
      touchpoint_source: PROMISE_TOUCHPOINT_SOURCE,
      // The message id keys the unique index (source, external id): a second
      // pass over the same text writes nothing.
      external_touchpoint_id: input.sid ? `${input.via}:${input.sid}` : null,
      occurred_at: at,
      raw_payload_json: {
        kind: "staffing",
        chefs: promise.chefs,
        grills: promise.grills,
        text: promise.text,
        sid: input.sid,
        at,
        via: input.via,
        ...(promise.stations_note ? { stations_note: promise.stations_note } : {}),
        actor,
      },
    })
    if (!error) touchpointWritten = true
    else if (!/duplicate|unique|23505/i.test(`${error.code ?? ""} ${error.message}`)) console.error("[promise-capture] touchpoint insert failed", error.message)
  }

  const ordersPatched: CaptureResult["ordersPatched"] = []
  for (const order of await upcomingOrdersFor(supabase, { leadId: input.leadId, phone: input.phone })) {
    const r = await patchOrderPlan(supabase, order, promise, actor)
    if (r) ordersPatched.push({ id: order.id, order_no: order.order_no, ...r })
  }
  return { promise: parsed, touchpointWritten, ordersPatched }
}
