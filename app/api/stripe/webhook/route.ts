import { NextRequest, NextResponse } from "next/server"
import type Stripe from "stripe"
import { createServerSupabaseClient } from "@/lib/supabase"
import { getStripeServerClient } from "@/lib/stripe-server"

export const runtime = "nodejs"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isLikelyUuid(value: string | undefined): value is string {
  if (!value) return false
  return UUID_PATTERN.test(value)
}

function getStripeObjectId(event: Stripe.Event): string | null {
  const object = event.data?.object as { id?: unknown } | undefined
  return typeof object?.id === "string" ? object.id : null
}

function normalizePaymentIntentId(
  value: Stripe.Checkout.Session["payment_intent"] | Stripe.Charge["payment_intent"],
): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value
  }
  if (value && typeof value === "object" && "id" in value) {
    const candidate = (value as { id?: unknown }).id
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate
    }
  }
  return undefined
}

function amountFromMinorUnits(amountMinor: number | null | undefined): number | undefined {
  if (typeof amountMinor !== "number" || !Number.isFinite(amountMinor)) {
    return undefined
  }
  return Number((amountMinor / 100).toFixed(2))
}

async function registerEventForIdempotency(
  supabase: NonNullable<ReturnType<typeof createServerSupabaseClient>>,
  event: Stripe.Event,
): Promise<"accepted" | "duplicate" | "error"> {
  const { error } = await supabase.from("stripe_webhook_events").insert({
    event_id: event.id,
    event_type: event.type,
    stripe_object_id: getStripeObjectId(event),
    livemode: event.livemode,
    received_at: new Date().toISOString(),
  })

  if (!error) {
    return "accepted"
  }

  if ((error as { code?: string }).code === "23505") {
    return "duplicate"
  }

  console.error("[stripe/webhook] Failed to register event idempotency key:", error)
  return "error"
}

async function handleCheckoutSessionCompleted(
  supabase: NonNullable<ReturnType<typeof createServerSupabaseClient>>,
  session: Stripe.Checkout.Session,
) {
  const paymentIntentId = normalizePaymentIntentId(session.payment_intent)
  const depositAmount = amountFromMinorUnits(session.amount_total)
  const bookingIdFromMetadata = session.metadata?.booking_id

  const bookingUpdate: Record<string, unknown> = {
    deposit_status: "paid",
    status: "confirmed",
    stripe_session_id: session.id,
    updated_at: new Date().toISOString(),
  }

  if (typeof depositAmount === "number") {
    bookingUpdate.deposit_amount = depositAmount
    bookingUpdate.deposit = Math.round(depositAmount)
  }
  if (paymentIntentId) {
    bookingUpdate.payment_intent_id = paymentIntentId
  }

  let updatedBookingId: string | null = null

  const { data: bySessionData, error: bySessionError } = await supabase
    .from("bookings")
    .update(bookingUpdate)
    .eq("stripe_session_id", session.id)
    .select("id")
    .maybeSingle()

  if (bySessionError) {
    console.error("[stripe/webhook] Failed to update booking by stripe_session_id:", bySessionError)
    return { ok: false as const, error: "Failed to update booking by stripe_session_id." }
  }

  if (bySessionData?.id) {
    updatedBookingId = bySessionData.id
  }

  if (!updatedBookingId && isLikelyUuid(bookingIdFromMetadata)) {
    const { data: byIdData, error: byIdError } = await supabase
      .from("bookings")
      .update(bookingUpdate)
      .eq("id", bookingIdFromMetadata)
      .select("id")
      .maybeSingle()

    if (byIdError) {
      console.error("[stripe/webhook] Failed to update booking by metadata booking_id:", byIdError)
      return { ok: false as const, error: "Failed to update booking by metadata booking_id." }
    }

    if (byIdData?.id) {
      updatedBookingId = byIdData.id
    }
  }

  if (!updatedBookingId) {
    console.warn("[stripe/webhook] checkout.session.completed did not match any booking.", {
      sessionId: session.id,
      bookingIdFromMetadata,
    })
  }

  return {
    ok: true as const,
    updatedBookingId,
    paymentIntentId,
    depositAmount,
  }
}

async function handleChargeRefunded(
  supabase: NonNullable<ReturnType<typeof createServerSupabaseClient>>,
  charge: Stripe.Charge,
) {
  const paymentIntentId = normalizePaymentIntentId(charge.payment_intent)
  if (!paymentIntentId) {
    return {
      ok: true as const,
      updated: false,
      reason: "missing_payment_intent",
    }
  }

  const refundedAmount = amountFromMinorUnits(charge.amount_refunded || charge.amount)
  const bookingUpdate: Record<string, unknown> = {
    deposit_status: "refunded",
    status: "pending",
    deposit: 0,
    updated_at: new Date().toISOString(),
  }

  if (typeof refundedAmount === "number") {
    bookingUpdate.deposit_amount = refundedAmount
  }

  const { data, error } = await supabase
    .from("bookings")
    .update(bookingUpdate)
    .eq("payment_intent_id", paymentIntentId)
    .select("id")
    .maybeSingle()

  if (error) {
    console.error("[stripe/webhook] Failed to mark booking refunded by payment_intent_id:", error)
    return { ok: false as const, error: "Failed to update refunded booking state." }
  }

  return {
    ok: true as const,
    updated: Boolean(data?.id),
    paymentIntentId,
  }
}

export async function POST(request: NextRequest) {
  const stripeSignature = request.headers.get("stripe-signature")
  if (!stripeSignature) {
    return NextResponse.json({ received: false, error: "Missing stripe-signature header." }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!webhookSecret) {
    return NextResponse.json(
      { received: false, error: "Missing STRIPE_WEBHOOK_SECRET environment variable." },
      { status: 500 },
    )
  }

  let stripe: Stripe
  try {
    stripe = getStripeServerClient()
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to initialize Stripe server client."
    return NextResponse.json({ received: false, error: message }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    const payload = await request.text()
    event = stripe.webhooks.constructEvent(payload, stripeSignature, webhookSecret)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook signature."
    return NextResponse.json({ received: false, error: message }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ received: false, error: "Supabase server client is not configured." }, { status: 500 })
  }

  const idempotencyResult = await registerEventForIdempotency(supabase, event)
  if (idempotencyResult === "duplicate") {
    return NextResponse.json({ received: true, duplicate: true, eventType: event.type }, { status: 200 })
  }
  if (idempotencyResult === "error") {
    return NextResponse.json({ received: false, error: "Failed to register webhook event idempotency." }, { status: 500 })
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const result = await handleCheckoutSessionCompleted(supabase, event.data.object as Stripe.Checkout.Session)
      if (!result.ok) {
        return NextResponse.json({ received: false, error: result.error }, { status: 500 })
      }

      return NextResponse.json(
        {
          received: true,
          eventType: event.type,
          updatedBookingId: result.updatedBookingId,
          paymentIntentId: result.paymentIntentId,
          depositAmount: result.depositAmount,
        },
        { status: 200 },
      )
    }

    case "charge.refunded": {
      const result = await handleChargeRefunded(supabase, event.data.object as Stripe.Charge)
      if (!result.ok) {
        return NextResponse.json({ received: false, error: result.error }, { status: 500 })
      }

      return NextResponse.json(
        {
          received: true,
          eventType: event.type,
          updated: result.updated,
          paymentIntentId: result.paymentIntentId,
          reason: "reason" in result ? result.reason : undefined,
        },
        { status: 200 },
      )
    }

    default:
      return NextResponse.json({ received: true, eventType: event.type, ignored: true }, { status: 200 })
  }
}
