import { randomUUID } from "node:crypto"
import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { buildBalancePaidEventEnvelope, sendCrmEventEnvelope } from "@/lib/crm-integration"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Staff-only: record a balance payment the pipeline did not book itself —
// cash / Venmo / Zelle taken at the party, or a card payment that needs
// entering by hand. The payment rides as type "final" onto the EXISTING order
// (matched by its source_ref), so the payments projection and balance snapshot
// settle and the order advances to 已办完. Audit-first: operator + proof
// recorded.
//
// The "stripe" channel exists because a card payment entered as "other" loses
// the one thing that makes it reconcilable — the payment intent id. Entered
// under this channel the row carries provider "stripe" and the real pi_ as
// both its identity and its transaction ref, so it lines up with the Stripe
// dashboard and with anything the webhook books for the same payment.
function isAuthorized(request: NextRequest): boolean {
  const provided = request.headers.get("x-admin-key") ?? ""
  if (!provided) return false
  const owner = process.env.ADMIN_DASH_KEY
  if (owner && provided === owner) return true
  for (const entry of (process.env.AGENT_DASH_KEYS ?? "").split(",")) {
    const [alias, key] = entry.split(":").map((s) => s?.trim())
    if (alias && key && provided === key) return true
  }
  return false
}

const CHANNELS = ["cash", "venmo", "zelle", "stripe", "other"] as const

// pi_ (payment intent), ch_/py_ (charge), cs_ (checkout session).
const STRIPE_REF_PATTERN = /^(pi|ch|py|cs)_[A-Za-z0-9_]{8,}$/

function asTrimmed(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const t = value.trim()
  return t ? t : undefined
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: {
    orderId?: string
    amount?: number
    channel?: string
    proofUrl?: string
    operator?: string
    paymentRef?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const orderId = asTrimmed(body.orderId)
  const channel = (asTrimmed(body.channel)?.toLowerCase() ?? "") as (typeof CHANNELS)[number]
  const amount = Number(body.amount)
  const operator = asTrimmed(body.operator) ?? "staff"
  const proofUrl = asTrimmed(body.proofUrl)
  const paymentRef = asTrimmed(body.paymentRef)

  if (!orderId) return NextResponse.json({ error: "orderId is required" }, { status: 400 })
  if (!CHANNELS.includes(channel)) {
    return NextResponse.json({ error: `channel must be one of ${CHANNELS.join("/")}` }, { status: 400 })
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > 20000) {
    return NextResponse.json({ error: "amount must be between 0 and 20000" }, { status: 400 })
  }
  if (channel === "stripe" && (!paymentRef || !STRIPE_REF_PATTERN.test(paymentRef))) {
    return NextResponse.json(
      { error: "stripe channel requires paymentRef like pi_… (the Stripe payment intent id)" },
      { status: 400 },
    )
  }

  const supabase = createServerSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 500 })
  }

  const { data: order, error: readError } = await supabase
    .from("orders")
    .select("id, order_no, source_ref, customer_name, customer_email, customer_phone, event_start, event_address")
    .eq("id", orderId)
    .maybeSingle()
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })
  if (!order) return NextResponse.json({ error: "order not found" }, { status: 404 })
  if (!order.source_ref) {
    return NextResponse.json({ error: "order has no source_ref; cannot address it through the integration channel" }, { status: 422 })
  }

  const amountCents = Math.round(amount * 100)
  const nowIso = new Date().toISOString()
  // Deterministic id: a double submit upserts the same payment row. A Stripe
  // entry is identified by the payment itself, so entering it here and having
  // the webhook book it later resolve to one row rather than two.
  const isStripe = channel === "stripe"
  const externalPaymentId = isStripe
    ? paymentRef!
    : `manual_final_${channel}_${order.order_no}_${amountCents}`.slice(0, 80)

  const built = buildBalancePaidEventEnvelope({
    eventId: `evt_manual_final_${randomUUID()}`,
    order: { ...order, source_ref: String(order.source_ref) },
    amountCents,
    externalPaymentId,
    provider: isStripe ? "stripe" : "other",
    paidAt: nowIso,
    transactionRef: isStripe ? paymentRef : `manual:${channel}`,
    metadata: {
      payment_kind: "final_balance",
      entry_surface: "orders_workbench",
      manual_entry: true,
      channel,
      operator,
      proof_url: proofUrl,
    },
  })
  if (!built.ok) {
    return NextResponse.json({ error: built.detail }, { status: 422 })
  }

  const delivery = await sendCrmEventEnvelope({ envelope: built.envelope })
  if (!delivery.attempted || !delivery.delivered) {
    const detail = delivery.attempted ? delivery.error ?? `http_${delivery.status}` : delivery.detail ?? delivery.reason
    return NextResponse.json({ ok: false, error: `CRM ingest failed: ${detail}` }, { status: 502 })
  }

  await supabase.from("order_events").insert({
    order_id: orderId,
    actor: `admin:${operator}`,
    action: "final_payment_confirmed",
    metadata: {
      channel,
      amount_cents: amountCents,
      proof_url: proofUrl ?? null,
      external_payment_id: externalPaymentId,
      stripe_payment_ref: paymentRef ?? null,
    },
  })

  return NextResponse.json({ ok: true, orderNo: order.order_no })
}
