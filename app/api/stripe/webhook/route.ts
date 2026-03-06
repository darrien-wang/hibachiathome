import { NextRequest, NextResponse } from "next/server"
import type Stripe from "stripe"
import { Resend } from "resend"
import { createServerSupabaseClient } from "@/lib/supabase"
import { getStripeServerClient } from "@/lib/stripe-server"
import { buildDepositPaidEventEnvelope, buildPaymentRefundedEventEnvelope, type CrmBookingSnapshot } from "@/lib/crm-integration"
import { deliverCrmOutboxRecord, enqueueCrmOutboxEvent } from "@/lib/crm-outbox"

export const runtime = "nodejs"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

type NotificationDeliveryResult = {
  attempted: boolean
  delivered: boolean
  skippedReason?: string
  error?: string
  providerMessageId?: string
}

type SmsProviderPreference = "auto" | "sendly" | "twilio"

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function isLikelyEmail(value: string | undefined): value is string {
  if (!value) return false
  return EMAIL_PATTERN.test(value)
}

function normalizeSmsPhone(value: string | undefined): string | undefined {
  const raw = asNonEmptyString(value)
  if (!raw) {
    return undefined
  }

  if (raw.startsWith("+")) {
    const normalized = `+${raw.slice(1).replace(/\D+/g, "")}`
    return normalized.length > 1 ? normalized : undefined
  }

  const digits = raw.replace(/\D+/g, "")
  if (digits.length === 10) {
    return `+1${digits}`
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`
  }

  return undefined
}

function buildInvoiceSelfServiceLink(params: {
  baseUrl?: string
  bookingId?: string
  email?: string
  phone?: string
}): string | undefined {
  const baseUrl = asNonEmptyString(params.baseUrl)
  const bookingId = asNonEmptyString(params.bookingId)
  const email = asNonEmptyString(params.email)
  const phone = asNonEmptyString(params.phone)

  if (!baseUrl || (!bookingId && !email && !phone)) {
    return undefined
  }

  try {
    const url = new URL(baseUrl)
    if (bookingId) {
      url.searchParams.set("booking_id", bookingId)
    }
    if (email) {
      url.searchParams.set("email", email)
    }
    if (phone) {
      url.searchParams.set("phone", phone)
    }
    url.searchParams.set("surface", "deposit_webhook_notification")
    return url.toString()
  } catch (error) {
    console.warn("[stripe/webhook] Invalid INVOICE_SELF_SERVICE_BASE_URL; customer notification link skipped:", {
      error: error instanceof Error ? error.message : "invalid_invoice_base_url",
    })
    return undefined
  }
}

async function sendDepositConfirmationEmail(params: {
  recipientEmail?: string
  bookingId?: string
  selfServiceLink?: string
}): Promise<NotificationDeliveryResult> {
  const resendApiKey = asNonEmptyString(process.env.RESEND_API_KEY)
  if (!resendApiKey) {
    return {
      attempted: false,
      delivered: false,
      skippedReason: "resend_not_configured",
    }
  }

  const recipientEmail = asNonEmptyString(params.recipientEmail)
  if (!recipientEmail || !isLikelyEmail(recipientEmail)) {
    return {
      attempted: false,
      delivered: false,
      skippedReason: "missing_or_invalid_email",
    }
  }

  const bookingId = asNonEmptyString(params.bookingId)
  if (!bookingId) {
    return {
      attempted: false,
      delivered: false,
      skippedReason: "missing_booking_id",
    }
  }

  const selfServiceLink = asNonEmptyString(params.selfServiceLink)
  if (!selfServiceLink) {
    return {
      attempted: false,
      delivered: false,
      skippedReason: "missing_self_service_link",
    }
  }

  const resend = new Resend(resendApiKey)
  const subject = `Real Hibachi deposit confirmed for booking number ${bookingId}`
  const text = [
    "Thanks for your deposit payment with Real Hibachi.",
    `Booking Number: ${bookingId}`,
    `Update invoice details here: ${selfServiceLink}`,
    "Reply to this email if you need help.",
  ].join("\n")
  const html = [
    "<p>Thanks for your deposit payment with Real Hibachi.</p>",
    `<p><strong>Booking Number:</strong> ${bookingId}</p>`,
    `<p><a href=\"${selfServiceLink}\">Update invoice details</a></p>`,
    "<p>Reply to this email if you need help.</p>",
  ].join("")

  try {
    const { data, error } = await resend.emails.send({
      from: asNonEmptyString(process.env.EMAIL_FROM) ?? "support@realhibachi.com",
      to: [recipientEmail],
      subject,
      text,
      html,
    })

    if (error) {
      return {
        attempted: true,
        delivered: false,
        error: asNonEmptyString(error.message) ?? "email_send_failed",
      }
    }

    return {
      attempted: true,
      delivered: true,
      providerMessageId: asNonEmptyString(data?.id),
    }
  } catch (error) {
    return {
      attempted: true,
      delivered: false,
      error: error instanceof Error ? error.message : "email_send_failed",
    }
  }
}

async function sendDepositConfirmationSms(params: {
  recipientPhone?: string
  bookingId?: string
  selfServiceLink?: string
}): Promise<NotificationDeliveryResult> {
  const recipientPhone = normalizeSmsPhone(params.recipientPhone)
  if (!recipientPhone) {
    return {
      attempted: false,
      delivered: false,
      skippedReason: "missing_or_invalid_phone",
    }
  }

  const bookingId = asNonEmptyString(params.bookingId)
  if (!bookingId) {
    return {
      attempted: false,
      delivered: false,
      skippedReason: "missing_booking_id",
    }
  }

  const selfServiceLink = asNonEmptyString(params.selfServiceLink)
  if (!selfServiceLink) {
    return {
      attempted: false,
      delivered: false,
      skippedReason: "missing_self_service_link",
    }
  }

  const preference = getSmsProviderPreference()
  if (preference === "sendly") {
    return sendDepositConfirmationSmsViaSendly({ recipientPhone, bookingId, selfServiceLink })
  }
  if (preference === "twilio") {
    return sendDepositConfirmationSmsViaTwilio({ recipientPhone, bookingId, selfServiceLink })
  }

  const sendly = await sendDepositConfirmationSmsViaSendly({ recipientPhone, bookingId, selfServiceLink })
  if (sendly.delivered || sendly.attempted) {
    return sendly
  }

  const twilio = await sendDepositConfirmationSmsViaTwilio({ recipientPhone, bookingId, selfServiceLink })
  if (twilio.delivered || twilio.attempted) {
    return twilio
  }

  return {
    attempted: false,
    delivered: false,
    skippedReason: "no_sms_provider_configured",
  }
}

function getSmsProviderPreference(): SmsProviderPreference {
  const value = asNonEmptyString(process.env.SMS_PROVIDER)?.toLowerCase()
  if (value === "sendly" || value === "twilio" || value === "auto") {
    return value
  }
  return "auto"
}

async function sendDepositConfirmationSmsViaSendly(params: {
  recipientPhone: string
  bookingId: string
  selfServiceLink: string
}): Promise<NotificationDeliveryResult> {
  const apiKey = asNonEmptyString(process.env.SENDLY_API_KEY)
  const endpoint = asNonEmptyString(process.env.SENDLY_API_URL) ?? "https://sendly.live/api/v1/messages"

  if (!apiKey) {
    return {
      attempted: false,
      delivered: false,
      skippedReason: "sendly_not_configured",
    }
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: params.recipientPhone,
        text: `Real Hibachi: deposit confirmed for booking number ${params.bookingId}. Update invoice details: ${params.selfServiceLink}`,
      }),
      cache: "no-store",
    })

    const payload = (await response.json().catch(() => null)) as { id?: unknown; message?: unknown; error?: unknown } | null
    if (!response.ok) {
      return {
        attempted: true,
        delivered: false,
        error:
          asNonEmptyString(payload?.message) ??
          asNonEmptyString(payload?.error) ??
          `sendly_http_${response.status}`,
      }
    }

    return {
      attempted: true,
      delivered: true,
      providerMessageId: asNonEmptyString(payload?.id),
    }
  } catch (error) {
    return {
      attempted: true,
      delivered: false,
      error: error instanceof Error ? error.message : "sendly_sms_send_failed",
    }
  }
}

async function sendDepositConfirmationSmsViaTwilio(params: {
  recipientPhone: string
  bookingId: string
  selfServiceLink: string
}): Promise<NotificationDeliveryResult> {
  const accountSid = asNonEmptyString(process.env.TWILIO_ACCOUNT_SID)
  const authToken = asNonEmptyString(process.env.TWILIO_AUTH_TOKEN)
  const fromNumber = asNonEmptyString(process.env.TWILIO_FROM_NUMBER)

  if (!accountSid || !authToken || !fromNumber) {
    return {
      attempted: false,
      delivered: false,
      skippedReason: "twilio_not_configured",
    }
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64")
  const body = new URLSearchParams({
    To: params.recipientPhone,
    From: fromNumber,
    Body: `Real Hibachi: deposit confirmed for booking number ${params.bookingId}. Update invoice details: ${params.selfServiceLink}`,
  })

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      cache: "no-store",
    })

    const payload = (await response.json().catch(() => null)) as { sid?: unknown; message?: unknown } | null
    if (!response.ok) {
      return {
        attempted: true,
        delivered: false,
        error: asNonEmptyString(payload?.message) ?? `twilio_http_${response.status}`,
      }
    }

    return {
      attempted: true,
      delivered: true,
      providerMessageId: asNonEmptyString(payload?.sid),
    }
  } catch (error) {
    return {
      attempted: true,
      delivered: false,
      error: error instanceof Error ? error.message : "sms_send_failed",
    }
  }
}

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

async function loadBookingCrmSnapshot(
  supabase: NonNullable<ReturnType<typeof createServerSupabaseClient>>,
  bookingId: string | null,
): Promise<CrmBookingSnapshot | null> {
  if (!bookingId) {
    return null
  }

  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, full_name, phone, email, event_date, event_time, address, guest_adults, guest_kids, total_cost, travel_fee, special_requests, deposit_amount",
    )
    .eq("id", bookingId)
    .maybeSingle()

  if (error) {
    console.error("[stripe/webhook] Failed to load booking snapshot for CRM sync:", error)
    return null
  }

  if (!data) {
    return null
  }

  return data as CrmBookingSnapshot
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

  const bookingSnapshot = await loadBookingCrmSnapshot(supabase, updatedBookingId)

  return {
    ok: true as const,
    updatedBookingId,
    paymentIntentId,
    depositAmount,
    bookingSnapshot,
  }
}

async function handleChargeRefunded(
  supabase: NonNullable<ReturnType<typeof createServerSupabaseClient>>,
  charge: Stripe.Charge,
) {
  const paymentIntentId = normalizePaymentIntentId(charge.payment_intent)
  const refundedAmount = amountFromMinorUnits(charge.amount_refunded || charge.amount)

  if (!paymentIntentId) {
    return {
      ok: true as const,
      updated: false,
      updatedBookingId: null,
      paymentIntentId: undefined,
      refundedAmount,
      bookingSnapshot: null,
      reason: "missing_payment_intent",
    }
  }

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

  const updatedBookingId = data?.id ?? null
  if (!updatedBookingId) {
    console.warn("[stripe/webhook] charge.refunded did not match any booking by payment_intent_id.", {
      chargeId: charge.id,
      paymentIntentId,
    })
  }

  const bookingSnapshot = await loadBookingCrmSnapshot(supabase, updatedBookingId)

  return {
    ok: true as const,
    updated: Boolean(updatedBookingId),
    updatedBookingId,
    paymentIntentId,
    refundedAmount,
    bookingSnapshot,
  }
}

async function sendCustomerDepositNotifications(params: {
  session: Stripe.Checkout.Session
  updatedBookingId: string | null
  bookingSnapshot: CrmBookingSnapshot | null
}): Promise<{
  bookingId?: string
  selfServiceLinkReady: boolean
  email: NotificationDeliveryResult
  sms: NotificationDeliveryResult
}> {
  const bookingId =
    asNonEmptyString(params.updatedBookingId) ??
    asNonEmptyString(params.bookingSnapshot?.id) ??
    asNonEmptyString(params.session.metadata?.booking_id) ??
    asNonEmptyString(params.session.client_reference_id)
  const customerEmail =
    asNonEmptyString(params.bookingSnapshot?.email) ??
    asNonEmptyString(params.session.customer_details?.email) ??
    asNonEmptyString(params.session.customer_email) ??
    asNonEmptyString(params.session.metadata?.customer_email)
  const customerPhone =
    asNonEmptyString(params.bookingSnapshot?.phone) ??
    asNonEmptyString(params.session.customer_details?.phone) ??
    asNonEmptyString(params.session.metadata?.customer_phone)
  const selfServiceLink = buildInvoiceSelfServiceLink({
    baseUrl:
      asNonEmptyString(process.env.INVOICE_SELF_SERVICE_BASE_URL) ??
      asNonEmptyString(process.env.NEXT_PUBLIC_INVOICE_SELF_SERVICE_BASE_URL),
    bookingId,
    email: customerEmail,
    phone: customerPhone,
  })

  const [email, sms] = await Promise.all([
    sendDepositConfirmationEmail({
      recipientEmail: customerEmail,
      bookingId,
      selfServiceLink,
    }),
    sendDepositConfirmationSms({
      recipientPhone: customerPhone,
      bookingId,
      selfServiceLink,
    }),
  ])

  return {
    bookingId,
    selfServiceLinkReady: Boolean(selfServiceLink),
    email,
    sms,
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
      const session = event.data.object as Stripe.Checkout.Session
      const result = await handleCheckoutSessionCompleted(supabase, session)
      if (!result.ok) {
        return NextResponse.json({ received: false, error: result.error }, { status: 500 })
      }

      const crmEnvelopeResult = buildDepositPaidEventEnvelope({
        stripeEventId: event.id,
        session,
        booking: result.bookingSnapshot,
        paymentIntentId: result.paymentIntentId,
        depositAmount: result.depositAmount,
      })

      let crmForwarded = false
      let crmRequestId: string | undefined
      let crmOutboxEventId: string | undefined
      let crmOutboxState: string | undefined
      let crmSkippedReason: string | undefined
      let crmError: string | undefined

      if (!crmEnvelopeResult.ok) {
        console.warn("[stripe/webhook] CRM forward was skipped:", {
          eventId: event.id,
          reason: crmEnvelopeResult.reason,
          detail: crmEnvelopeResult.detail,
        })
        crmSkippedReason = crmEnvelopeResult.reason
      } else {
        const enqueueResult = await enqueueCrmOutboxEvent(supabase, {
          eventId: crmEnvelopeResult.envelope.event_id,
          eventType: crmEnvelopeResult.envelope.event_type,
          payload: crmEnvelopeResult.envelope,
        })

        if (!enqueueResult.ok) {
          crmOutboxEventId = crmEnvelopeResult.envelope.event_id
          crmError = enqueueResult.error
          crmOutboxState = enqueueResult.conflict ? "conflict" : "enqueue_failed"
          console.error("[stripe/webhook] Failed to enqueue CRM outbox event:", {
            eventId: event.id,
            crmEventId: crmEnvelopeResult.envelope.event_id,
            conflict: enqueueResult.conflict,
            error: enqueueResult.error,
          })
        } else {
          crmOutboxEventId = enqueueResult.record.event_id
          const deliveryResult = await deliverCrmOutboxRecord(supabase, enqueueResult.record)
          if (!deliveryResult.ok) {
            crmError = deliveryResult.error
            crmOutboxState = "deliver_failed"
            console.error("[stripe/webhook] Failed to deliver CRM outbox event:", {
              eventId: event.id,
              crmEventId: enqueueResult.record.event_id,
              error: deliveryResult.error,
            })
          } else {
            crmOutboxState = deliveryResult.state
            crmRequestId = deliveryResult.requestId
            crmForwarded = deliveryResult.delivered
            if (!deliveryResult.delivered) {
              console.warn("[stripe/webhook] CRM outbox delivery not completed in webhook path:", {
                eventId: event.id,
                crmEventId: enqueueResult.record.event_id,
                state: deliveryResult.state,
                reason: deliveryResult.reason,
                status: deliveryResult.status,
                error: deliveryResult.error,
              })
            }
          }
        }
      }

      const customerNotification = await sendCustomerDepositNotifications({
        session,
        updatedBookingId: result.updatedBookingId,
        bookingSnapshot: result.bookingSnapshot,
      })

      if (!customerNotification.email.delivered && customerNotification.email.attempted) {
        console.error("[stripe/webhook] Failed to send deposit confirmation email to customer:", {
          eventId: event.id,
          bookingId: customerNotification.bookingId,
          error: customerNotification.email.error,
          skippedReason: customerNotification.email.skippedReason,
        })
      }

      if (!customerNotification.sms.delivered && customerNotification.sms.attempted) {
        console.error("[stripe/webhook] Failed to send deposit confirmation SMS to customer:", {
          eventId: event.id,
          bookingId: customerNotification.bookingId,
          error: customerNotification.sms.error,
          skippedReason: customerNotification.sms.skippedReason,
        })
      }

      return NextResponse.json(
        {
          received: true,
          eventType: event.type,
          updatedBookingId: result.updatedBookingId,
          paymentIntentId: result.paymentIntentId,
          depositAmount: result.depositAmount,
          crmForwarded,
          crmRequestId,
          crmOutboxEventId,
          crmOutboxState,
          crmSkippedReason,
          crmError,
          customerNotification,
        },
        { status: 200 },
      )
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge
      const result = await handleChargeRefunded(supabase, charge)
      if (!result.ok) {
        return NextResponse.json({ received: false, error: result.error }, { status: 500 })
      }

      const crmEnvelopeResult = buildPaymentRefundedEventEnvelope({
        stripeEventId: event.id,
        charge,
        booking: result.bookingSnapshot,
        paymentIntentId: result.paymentIntentId,
        refundedAmount: result.refundedAmount,
      })

      let crmForwarded = false
      let crmRequestId: string | undefined
      let crmOutboxEventId: string | undefined
      let crmOutboxState: string | undefined
      let crmSkippedReason: string | undefined
      let crmError: string | undefined

      if (!crmEnvelopeResult.ok) {
        console.warn("[stripe/webhook] CRM refund forward was skipped:", {
          eventId: event.id,
          reason: crmEnvelopeResult.reason,
          detail: crmEnvelopeResult.detail,
        })
        crmSkippedReason = crmEnvelopeResult.reason
      } else {
        const enqueueResult = await enqueueCrmOutboxEvent(supabase, {
          eventId: crmEnvelopeResult.envelope.event_id,
          eventType: crmEnvelopeResult.envelope.event_type,
          payload: crmEnvelopeResult.envelope,
        })

        if (!enqueueResult.ok) {
          crmOutboxEventId = crmEnvelopeResult.envelope.event_id
          crmError = enqueueResult.error
          crmOutboxState = enqueueResult.conflict ? "conflict" : "enqueue_failed"
          console.error("[stripe/webhook] Failed to enqueue refunded CRM outbox event:", {
            eventId: event.id,
            crmEventId: crmEnvelopeResult.envelope.event_id,
            conflict: enqueueResult.conflict,
            error: enqueueResult.error,
          })
        } else {
          crmOutboxEventId = enqueueResult.record.event_id
          const deliveryResult = await deliverCrmOutboxRecord(supabase, enqueueResult.record)
          if (!deliveryResult.ok) {
            crmError = deliveryResult.error
            crmOutboxState = "deliver_failed"
            console.error("[stripe/webhook] Failed to deliver refunded CRM outbox event:", {
              eventId: event.id,
              crmEventId: enqueueResult.record.event_id,
              error: deliveryResult.error,
            })
          } else {
            crmOutboxState = deliveryResult.state
            crmRequestId = deliveryResult.requestId
            crmForwarded = deliveryResult.delivered
            if (!deliveryResult.delivered) {
              console.warn("[stripe/webhook] Refunded CRM outbox delivery not completed in webhook path:", {
                eventId: event.id,
                crmEventId: enqueueResult.record.event_id,
                state: deliveryResult.state,
                reason: deliveryResult.reason,
                status: deliveryResult.status,
                error: deliveryResult.error,
              })
            }
          }
        }
      }

      return NextResponse.json(
        {
          received: true,
          eventType: event.type,
          updated: result.updated,
          updatedBookingId: result.updatedBookingId,
          paymentIntentId: result.paymentIntentId,
          refundedAmount: result.refundedAmount,
          reason: "reason" in result ? result.reason : undefined,
          crmForwarded,
          crmRequestId,
          crmOutboxEventId,
          crmOutboxState,
          crmSkippedReason,
          crmError,
        },
        { status: 200 },
      )
    }

    default:
      return NextResponse.json({ received: true, eventType: event.type, ignored: true }, { status: 200 })
  }
}
