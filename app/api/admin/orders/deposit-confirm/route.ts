import { randomUUID } from "node:crypto"
import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { sendCrmEventEnvelope, type CrmEventEnvelope } from "@/lib/crm-integration"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Staff-only: confirm an off-Stripe deposit (Venmo / Zelle / cash) and promote
// the lead to a real order. Deposit is THE promotion event regardless of
// channel, so this emits the same order.deposit_paid envelope the Stripe
// webhook emits — same ingest, same RH- number minting, same audit trail.
// Policy per design review: record operator + proof link now (audit-first),
// approval flow only if misuse ever shows up.
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

const CHANNELS = ["venmo", "zelle", "cash", "other"] as const
type Channel = (typeof CHANNELS)[number]

function asTrimmed(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const t = value.trim()
  return t ? t : undefined
}

function phoneDigits(value: string | undefined): string | undefined {
  if (!value) return undefined
  const digits = value.replace(/\D/g, "")
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1)
  return digits.length === 10 ? digits : undefined
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: {
    leadId?: string
    customerName?: string
    email?: string
    phone?: string
    eventDate?: string
    eventTime?: string
    eventAddress?: string
    adults?: number
    kids?: number
    amount?: number
    channel?: string
    proofUrl?: string
    operator?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const customerName = asTrimmed(body.customerName)
  const email = asTrimmed(body.email)
  const phone = asTrimmed(body.phone)
  const eventDate = asTrimmed(body.eventDate)
  const eventTime = asTrimmed(body.eventTime) ?? "18:00"
  const channel = (asTrimmed(body.channel)?.toLowerCase() ?? "") as Channel
  const amount = Number(body.amount)
  const operator = asTrimmed(body.operator) ?? "staff"
  const proofUrl = asTrimmed(body.proofUrl)

  if (!customerName) return NextResponse.json({ error: "customerName is required" }, { status: 400 })
  if (!email && !phone) return NextResponse.json({ error: "email or phone is required" }, { status: 400 })
  if (!eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    return NextResponse.json({ error: "eventDate must be YYYY-MM-DD" }, { status: 400 })
  }
  if (!/^\d{2}:\d{2}$/.test(eventTime)) {
    return NextResponse.json({ error: "eventTime must be HH:mm" }, { status: 400 })
  }
  if (!CHANNELS.includes(channel)) {
    return NextResponse.json({ error: `channel must be one of ${CHANNELS.join("/")}` }, { status: 400 })
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > 20000) {
    return NextResponse.json({ error: "amount must be between 0 and 20000" }, { status: 400 })
  }

  const amountCents = Math.round(amount * 100)
  const eventStart = new Date(`${eventDate}T${eventTime}:00`)
  if (Number.isNaN(eventStart.getTime())) {
    return NextResponse.json({ error: "invalid event date/time" }, { status: 400 })
  }

  const leadId = asTrimmed(body.leadId)
  const externalOrderId = leadId ?? `manual_${randomUUID()}`
  const nowIso = new Date().toISOString()
  // Deterministic payment id: an accidental double submit upserts the same
  // payment row on the invoice side instead of double-counting the deposit.
  const contactKey = phoneDigits(phone) ?? email ?? "unknown"
  const externalPaymentId = `manual_${channel}_${contactKey}_${eventDate}_${amountCents}`.slice(0, 80)

  const envelope = {
    event_id: `evt_manual_deposit_${randomUUID()}`,
    event_type: "order.deposit_paid",
    occurred_at: nowIso,
    source: "official_website",
    order: {
      external_order_id: externalOrderId,
      customer_name: customerName,
      customer_phone: phone,
      customer_email: email,
      event_start: eventStart.toISOString(),
      event_timezone: "America/Los_Angeles",
      event_address: asTrimmed(body.eventAddress),
      guest_adult_count: Number.isFinite(body.adults) ? Math.max(0, Math.trunc(body.adults as number)) : undefined,
      guest_child_count: Number.isFinite(body.kids) ? Math.max(0, Math.trunc(body.kids as number)) : undefined,
      notes: `Deposit confirmed manually via ${channel} in the order workbench.`,
    },
    payment: {
      external_payment_id: externalPaymentId,
      type: "deposit",
      status: "paid",
      amount_cents: amountCents,
      currency: "USD",
      provider: "other",
      paid_at: nowIso,
      transaction_ref: `manual:${channel}`,
    },
    metadata: {
      manual_entry: true,
      entry_surface: "orders_workbench",
      channel,
      operator,
      proof_url: proofUrl,
      lead_id: leadId,
    },
  }

  const delivery = await sendCrmEventEnvelope({ envelope: envelope as unknown as CrmEventEnvelope })
  if (!delivery.attempted || !delivery.delivered) {
    const detail = delivery.attempted ? delivery.error ?? `http_${delivery.status}` : delivery.detail ?? delivery.reason
    return NextResponse.json({ ok: false, error: `CRM ingest failed: ${detail}` }, { status: 502 })
  }

  const responseBody = delivery.body as { data?: { order_id?: string; order_no?: string } } | undefined
  const orderId = responseBody?.data?.order_id
  const orderNo = responseBody?.data?.order_no

  // Best-effort linkage + audit; the order itself is already created above.
  const supabase = createServerSupabaseClient()
  if (supabase && orderId) {
    const { data: existing } = await supabase.from("orders").select("source_metadata").eq("id", orderId).maybeSingle()
    const mergedMetadata = {
      ...((existing?.source_metadata as Record<string, unknown>) ?? {}),
      manual_deposit: true,
      deposit_channel: channel,
      operator,
      ...(proofUrl ? { deposit_proof_url: proofUrl } : {}),
      ...(leadId ? { lead_id: leadId, lead_link_method: "manual_deposit_confirm", lead_linked_at: nowIso } : {}),
    }
    await supabase.from("orders").update({ source_metadata: mergedMetadata }).eq("id", orderId)
    await supabase.from("order_events").insert({
      order_id: orderId,
      actor: `admin:${operator}`,
      action: "manual_deposit_confirmed",
      metadata: {
        channel,
        amount_cents: amountCents,
        proof_url: proofUrl ?? null,
        lead_id: leadId ?? null,
        external_payment_id: externalPaymentId,
      },
    })
    if (leadId) {
      await supabase.from("leads").update({ status: "won", updated_at: nowIso }).eq("id", leadId).neq("status", "won")
    }
  }

  return NextResponse.json({ ok: true, orderId, orderNo })
}
