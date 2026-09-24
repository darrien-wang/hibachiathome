import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"
import { sendSupportNotificationEmail } from "@/lib/ops-notifications"

// We were blind to declines until the customer told us.
//
// 2026-09-24: Caleb forwarded a Stripe Link email - "$19.90 to Real Hibachi
// declined, a backup will be charged in 24 hours" - for a deposit he had
// already paid three days earlier. His inbox knew before we did, because the
// only Stripe events we ever stored were the ones that succeeded. The same
// blindness hid five failed attempts from a Temecula customer the day before.
//
// This records every failure on the lead's timeline and on the order, and
// emails ops with the one thing that decides what to do next: whether this
// person has already paid. A decline on an unpaid deposit means help them pay.
// A decline on a PAID one means Link is retrying a duplicate - do nothing, and
// refund if the retry lands.
//
// Stripe only delivers these if the endpoint subscribes to them in the
// dashboard: payment_intent.payment_failed, charge.failed,
// checkout.session.async_payment_failed.

export const FAILURE_EVENT_TYPES = [
  "payment_intent.payment_failed",
  "charge.failed",
  "checkout.session.async_payment_failed",
] as const

export type FailureEventType = (typeof FAILURE_EVENT_TYPES)[number]

export function isPaymentFailureEvent(type: string): type is FailureEventType {
  return (FAILURE_EVENT_TYPES as readonly string[]).includes(type)
}

interface FailureFacts {
  amountCents: number | null
  currency: string | null
  /** What the customer's bank said, in their words when Stripe has them. */
  message: string | null
  code: string | null
  declineCode: string | null
  brand: string | null
  last4: string | null
  wallet: string | null
  email: string | null
  phone: string | null
  leadId: string | null
  orderId: string | null
  objectId: string
}

function str(value: unknown): string | null {
  const s = typeof value === "string" ? value.trim() : ""
  return s.length > 0 ? s : null
}

function digits10(raw: string | null): string | null {
  const d = (raw ?? "").replace(/\D/g, "").slice(-10)
  return d.length === 10 ? d : null
}

function prettyPhone(raw: string | null): string {
  const d = digits10(raw)
  return d ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : (raw ?? "unknown")
}

function money(cents: number | null, currency: string | null): string {
  if (cents == null) return "unknown amount"
  const symbol = (currency ?? "usd").toLowerCase() === "usd" ? "$" : `${(currency ?? "").toUpperCase()} `
  return `${symbol}${(cents / 100).toFixed(2)}`
}

/** Pull the same facts out of whichever failure shape Stripe sent. */
export function readFailure(event: Stripe.Event): FailureFacts | null {
  const object = event.data.object as unknown as Record<string, unknown>
  const metadata = (object.metadata ?? {}) as Record<string, unknown>

  if (event.type === "payment_intent.payment_failed") {
    const pi = object as unknown as Stripe.PaymentIntent
    const err = pi.last_payment_error
    const card = err?.payment_method?.card
    return {
      amountCents: typeof pi.amount === "number" ? pi.amount : null,
      currency: str(pi.currency),
      message: str(err?.message),
      code: str(err?.code),
      declineCode: str(err?.decline_code),
      brand: str(card?.brand),
      last4: str(card?.last4),
      wallet: str((card as { wallet?: { type?: string } } | undefined)?.wallet?.type),
      email: str(pi.receipt_email) ?? str(metadata.customer_email) ?? str(metadata.email),
      phone: str(metadata.customer_phone) ?? str(metadata.phone),
      leadId: str(metadata.lead_id),
      orderId: str(metadata.order_id),
      objectId: pi.id,
    }
  }

  if (event.type === "charge.failed") {
    const charge = object as unknown as Stripe.Charge
    const card = charge.payment_method_details?.card
    const outcome = charge.outcome
    return {
      amountCents: typeof charge.amount === "number" ? charge.amount : null,
      currency: str(charge.currency),
      message: str(charge.failure_message) ?? str(outcome?.seller_message),
      code: str(charge.failure_code),
      declineCode: str((charge as { failure_balance_transaction?: unknown; outcome?: { reason?: string } }).outcome?.reason),
      brand: str(card?.brand),
      last4: str(card?.last4),
      wallet: str((card as { wallet?: { type?: string } } | undefined)?.wallet?.type),
      email: str(charge.receipt_email) ?? str(charge.billing_details?.email) ?? str(metadata.customer_email),
      phone: str(charge.billing_details?.phone) ?? str(metadata.customer_phone),
      leadId: str(metadata.lead_id),
      orderId: str(metadata.order_id),
      objectId: charge.id,
    }
  }

  const session = object as unknown as Stripe.Checkout.Session
  return {
    amountCents: typeof session.amount_total === "number" ? session.amount_total : null,
    currency: str(session.currency),
    message: "Asynchronous payment failed (bank debit or voucher).",
    code: null,
    declineCode: null,
    brand: null,
    last4: null,
    wallet: null,
    email: str(session.customer_details?.email) ?? str(metadata.customer_email),
    phone: str(session.customer_details?.phone) ?? str(metadata.customer_phone),
    leadId: str(metadata.lead_id),
    orderId: str(metadata.order_id),
    objectId: session.id,
  }
}

type LeadRow = { id: string; full_name: string | null; phone: string | null; email: string | null }
type OrderRow = {
  id: string
  order_no: string | null
  customer_name: string | null
  deposit_status: string | null
  deposit_paid_total_cents: number | null
  balance_due_cents: number | null
  event_start: string | null
}

/** The lead this failure belongs to: metadata first, then phone, then email. */
async function findLead(supabase: SupabaseClient, facts: FailureFacts): Promise<LeadRow | null> {
  const select = "id, full_name, phone, email"
  if (facts.leadId && /^[0-9a-f-]{36}$/i.test(facts.leadId)) {
    const { data } = await supabase.from("leads").select(select).eq("id", facts.leadId).maybeSingle()
    if (data) return data as LeadRow
  }
  const phone = digits10(facts.phone)
  if (phone) {
    const { data } = await supabase
      .from("leads")
      .select(select)
      .eq("normalized_phone", phone)
      .order("created_at", { ascending: false })
      .limit(1)
    if (data?.[0]) return data[0] as LeadRow
  }
  if (facts.email) {
    const { data } = await supabase
      .from("leads")
      .select(select)
      .ilike("email", facts.email)
      .order("created_at", { ascending: false })
      .limit(1)
    if (data?.[0]) return data[0] as LeadRow
  }
  return null
}

/** The order this failure belongs to, so we can tell "unpaid" from "duplicate". */
async function findOrder(
  supabase: SupabaseClient,
  facts: FailureFacts,
  lead: LeadRow | null,
): Promise<OrderRow | null> {
  const select =
    "id, order_no, customer_name, deposit_status, deposit_paid_total_cents, balance_due_cents, event_start"
  if (facts.orderId && /^[0-9a-f-]{36}$/i.test(facts.orderId)) {
    const { data } = await supabase.from("orders").select(select).eq("id", facts.orderId).maybeSingle()
    if (data) return data as OrderRow
  }
  const phone = digits10(facts.phone) ?? digits10(lead?.phone ?? null)
  if (phone) {
    const { data } = await supabase
      .from("orders")
      .select(select)
      .ilike("customer_phone", `%${phone}`)
      .order("created_at", { ascending: false })
      .limit(1)
    if (data?.[0]) return data[0] as OrderRow
  }
  const email = facts.email ?? lead?.email ?? null
  if (email) {
    const { data } = await supabase
      .from("orders")
      .select(select)
      .ilike("customer_email", email)
      .order("created_at", { ascending: false })
      .limit(1)
    if (data?.[0]) return data[0] as OrderRow
  }
  return null
}

function describeCard(facts: FailureFacts): string {
  const bits = [facts.brand, facts.last4 ? `••••${facts.last4}` : null].filter(Boolean).join(" ")
  const wallet = facts.wallet ? ` via ${facts.wallet}` : ""
  return bits ? `${bits}${wallet}` : facts.wallet ? `wallet: ${facts.wallet}` : "card unknown"
}

/**
 * Record a Stripe failure and tell a person about it.
 * Best effort and always non-throwing: a webhook must not 500 over an alert.
 */
export async function handlePaymentFailure(
  supabase: SupabaseClient,
  event: Stripe.Event,
): Promise<{ recorded: boolean; leadId: string | null; orderNo: string | null; alreadyPaid: boolean }> {
  const base = { recorded: false, leadId: null, orderNo: null, alreadyPaid: false }
  try {
    const facts = readFailure(event)
    if (!facts) return base

    const lead = await findLead(supabase, facts)
    const order = await findOrder(supabase, facts, lead)

    // The single fact that decides what to do. A decline against an order that
    // already has its deposit is a retry of a payment we do not need.
    const alreadyPaid =
      (order?.deposit_paid_total_cents ?? 0) > 0 || (order?.deposit_status ?? "") === "paid_verified"

    const payload = {
      event_id: event.id,
      event_type: event.type,
      object_id: facts.objectId,
      amount_cents: facts.amountCents,
      currency: facts.currency,
      message: facts.message,
      code: facts.code,
      decline_code: facts.declineCode,
      card: describeCard(facts),
      order_no: order?.order_no ?? null,
      already_paid: alreadyPaid,
    }

    if (lead) {
      await supabase.from("lead_touchpoints").insert({
        lead_id: lead.id,
        touchpoint_type: "payment_failed",
        touchpoint_source: "stripe",
        external_touchpoint_id: event.id,
        raw_payload_json: payload,
      })
    }
    if (order) {
      await supabase.from("order_events").insert({
        order_id: order.id,
        actor: "integration",
        action: "payment_failed",
        metadata: payload,
      })
    }

    const who = (lead?.full_name ?? "").trim() || order?.customer_name || prettyPhone(facts.phone)
    const amount = money(facts.amountCents, facts.currency)
    const reason = facts.message ?? facts.declineCode ?? facts.code ?? "no reason given"
    const appBase = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.realhibachi.com"
    const link = lead ? `${appBase}/admin?tab=leads&lead=${lead.id}` : `${appBase}/admin?tab=orders`

    const verdict = alreadyPaid
      ? `ALREADY PAID - ${order?.order_no ?? "this order"} has its deposit. This is a retry of a payment we do not need. Do not send another payment link. Stripe Link retries a backup card within 24h; if a duplicate ${amount} lands, refund it.`
      : "NOT PAID - they were trying to pay and could not. Text them while they are still on the page and offer another way."

    await sendSupportNotificationEmail({
      subject: `Payment declined: ${who} · ${amount}${alreadyPaid ? " (already paid)" : ""}`,
      text: [
        `${who} had ${amount} declined.`,
        `Reason: ${reason}`,
        `Card: ${describeCard(facts)}`,
        `Phone: ${prettyPhone(facts.phone ?? lead?.phone ?? null)}`,
        `Email: ${facts.email ?? lead?.email ?? "unknown"}`,
        order?.order_no ? `Order: ${order.order_no}` : "No matching order",
        "",
        verdict,
        "",
        link,
      ].join("\n"),
      html: [
        `<p><strong>${who}</strong> had <strong>${amount}</strong> declined.</p>`,
        `<p>Reason: ${reason}<br/>Card: ${describeCard(facts)}<br/>`,
        `Phone: ${prettyPhone(facts.phone ?? lead?.phone ?? null)}<br/>`,
        `Email: ${facts.email ?? lead?.email ?? "unknown"}<br/>`,
        `${order?.order_no ? `Order: ${order.order_no}` : "No matching order"}</p>`,
        `<p><strong>${verdict}</strong></p>`,
        `<p><a href="${link}">Open in the workbench</a></p>`,
      ].join(""),
    })

    return { recorded: true, leadId: lead?.id ?? null, orderNo: order?.order_no ?? null, alreadyPaid }
  } catch (error) {
    console.error("[payment-failure] could not record or alert", error)
    return base
  }
}
