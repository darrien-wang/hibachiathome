import { NextRequest, NextResponse } from "next/server"
import type Stripe from "stripe"
import { Resend } from "resend"
import { getDepositAmount } from "@/config/deposit"
import { generateRhBookingNumber, normalizeRhBookingNumber, shouldUseRhBookingNumbers } from "@/lib/booking-number"
import { getStripeServerClient } from "@/lib/stripe-server"
import { createServerSupabaseClient } from "@/lib/supabase"

export const runtime = "nodejs"

type DepositStartPayload = {
  bookingId?: string
  source?: string
  customerName?: string
  customerEmail?: string
  eventDate?: string
  eventTime?: string
  location?: string
  adults?: number
  kids?: number
  tent10x10?: boolean
  estimateLow?: number
  estimateHigh?: number
  totalAmount?: number
  depositAmount?: number
  currency?: string
}

type NormalizedDepositStartPayload = {
  bookingId?: string
  source?: string
  customerName?: string
  customerEmail?: string
  eventDate?: string
  eventTime?: string
  location?: string
  adults?: number
  kids?: number
  tent10x10?: boolean
  estimateLow?: number
  estimateHigh?: number
  totalAmount?: number
  depositAmount?: number
  currency: string
}

const CHECKOUT_SUCCESS_PATH = "/deposit/success"
const CHECKOUT_CANCEL_PATH = "/deposit/cancel"
const MAX_METADATA_LENGTH = 500
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }

  return trimmed
}

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return undefined
}

function normalizeBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (normalized === "true" || normalized === "yes" || normalized === "1") {
      return true
    }
    if (normalized === "false" || normalized === "no" || normalized === "0") {
      return false
    }
  }

  if (typeof value === "number") {
    if (value === 1) return true
    if (value === 0) return false
  }

  return undefined
}

function normalizeCurrency(value: unknown): string {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : ""
  return /^[a-z]{3}$/.test(normalized) ? normalized : "usd"
}

function resolveBookingId(input: { bookingId?: string; source?: string }): string | undefined {
  if (isLikelyUuid(input.bookingId)) {
    return input.bookingId
  }

  const normalizedRhBookingId = normalizeRhBookingNumber(input.bookingId)
  if (normalizedRhBookingId) {
    return normalizedRhBookingId
  }

  if (shouldUseRhBookingNumbers(input.source)) {
    return generateRhBookingNumber()
  }

  return input.bookingId
}

function buildNormalizedPayload(payload: DepositStartPayload): NormalizedDepositStartPayload {
  const source = normalizeString(payload.source)

  return {
    bookingId: resolveBookingId({
      bookingId: normalizeString(payload.bookingId),
      source,
    }),
    source,
    customerName: normalizeString(payload.customerName),
    customerEmail: normalizeString(payload.customerEmail),
    eventDate: normalizeString(payload.eventDate),
    eventTime: normalizeString(payload.eventTime),
    location: normalizeString(payload.location),
    adults: normalizeNumber(payload.adults),
    kids: normalizeNumber(payload.kids),
    tent10x10: normalizeBoolean(payload.tent10x10),
    estimateLow: normalizeNumber(payload.estimateLow),
    estimateHigh: normalizeNumber(payload.estimateHigh),
    totalAmount: normalizeNumber(payload.totalAmount),
    depositAmount: normalizeNumber(payload.depositAmount),
    currency: normalizeCurrency(payload.currency),
  }
}

function parseGetPayload(request: NextRequest): NormalizedDepositStartPayload {
  const params = request.nextUrl.searchParams

  return buildNormalizedPayload({
    bookingId: params.get("booking_id") ?? params.get("id") ?? undefined,
    source: params.get("source") ?? undefined,
    customerName: params.get("customer_name") ?? undefined,
    customerEmail: params.get("customer_email") ?? params.get("prefilled_email") ?? undefined,
    eventDate: params.get("event_date") ?? undefined,
    eventTime: params.get("event_time") ?? undefined,
    location: params.get("location") ?? undefined,
    adults: params.get("adults") ?? undefined,
    kids: params.get("kids") ?? undefined,
    tent10x10: params.get("tent_10x10") ?? undefined,
    estimateLow: params.get("estimate_low") ?? undefined,
    estimateHigh: params.get("estimate_high") ?? undefined,
    totalAmount: params.get("total_amount") ?? undefined,
    depositAmount: params.get("deposit_amount") ?? undefined,
    currency: params.get("currency") ?? undefined,
  })
}

function resolveOrigin(request: NextRequest): string {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim()
  if (configuredBaseUrl) {
    try {
      return new URL(configuredBaseUrl).origin
    } catch {
      // fall back to request origin
    }
  }

  return request.nextUrl.origin
}

function resolveDepositAmount(payload: NormalizedDepositStartPayload): number {
  const ruleBasedAmount = getDepositAmount(payload.estimateHigh ?? payload.totalAmount)

  if (payload.depositAmount === undefined || payload.depositAmount <= 0) {
    return ruleBasedAmount
  }

  // Trust the rule-based amount first; this also protects against client-side tampering.
  return ruleBasedAmount
}

function metadataField(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined
  }

  const text = String(value).trim()
  if (!text) {
    return undefined
  }

  return text.slice(0, MAX_METADATA_LENGTH)
}

function buildMetadata(payload: NormalizedDepositStartPayload, depositAmount: number, currency: string): Record<string, string> {
  const metadata: Record<string, string | undefined> = {
    booking_id: metadataField(payload.bookingId),
    deposit_source: metadataField(payload.source),
    customer_name: metadataField(payload.customerName),
    customer_email: metadataField(payload.customerEmail),
    event_date: metadataField(payload.eventDate),
    event_time: metadataField(payload.eventTime),
    location: metadataField(payload.location),
    adults: metadataField(payload.adults),
    kids: metadataField(payload.kids),
    tent_10x10: metadataField(payload.tent10x10),
    estimate_low: metadataField(payload.estimateLow),
    estimate_high: metadataField(payload.estimateHigh),
    total_amount: metadataField(payload.totalAmount),
    deposit_amount: metadataField(depositAmount.toFixed(2)),
    deposit_currency: metadataField(currency.toUpperCase()),
  }

  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined)) as Record<string, string>
}

function buildSuccessUrl(origin: string, payload: NormalizedDepositStartPayload): string {
  const base = `${origin}${CHECKOUT_SUCCESS_PATH}?session_id={CHECKOUT_SESSION_ID}`
  const params = new URLSearchParams()

  if (payload.bookingId) {
    params.set("booking_id", payload.bookingId)
  }
  if (payload.source) {
    params.set("source", payload.source)
  }

  const suffix = params.toString()
  return suffix ? `${base}&${suffix}` : base
}

function buildCancelUrl(origin: string, payload: NormalizedDepositStartPayload): string {
  const params = new URLSearchParams()

  if (payload.bookingId) {
    params.set("booking_id", payload.bookingId)
  }
  if (payload.source) {
    params.set("source", payload.source)
  }

  return params.toString() ? `${origin}${CHECKOUT_CANCEL_PATH}?${params.toString()}` : `${origin}${CHECKOUT_CANCEL_PATH}`
}

function normalizeCheckoutDescription(payload: NormalizedDepositStartPayload): string {
  if (payload.bookingId) {
    return `Deposit for booking ${payload.bookingId}`
  }
  return "Deposit to lock your event date"
}

function isLikelyEmail(email: string | undefined): email is string {
  if (!email) return false
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
}

function isLikelyUuid(value: string | undefined): value is string {
  if (!value) return false
  return UUID_PATTERN.test(value)
}

function normalizePaymentIntentId(paymentIntent: Stripe.Checkout.Session["payment_intent"]): string | undefined {
  if (typeof paymentIntent === "string" && paymentIntent.trim()) {
    return paymentIntent
  }

  if (paymentIntent && typeof paymentIntent === "object" && "id" in paymentIntent) {
    const candidate = (paymentIntent as { id?: unknown }).id
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate
    }
  }

  return undefined
}

async function persistPendingDepositState(params: {
  payload: NormalizedDepositStartPayload
  sessionId: string
  paymentIntentId?: string
  depositAmount: number
}) {
  const supabase = createServerSupabaseClient()
  if (!supabase) {
    console.warn("[deposit/start] Unable to persist canonical pending state: Supabase is not configured.")
    return
  }

  const canonicalDepositAmount = Number(params.depositAmount.toFixed(2))
  const bookingId = params.payload.bookingId
  const updatePayload = {
    deposit_status: "pending",
    deposit_amount: canonicalDepositAmount,
    stripe_session_id: params.sessionId,
    payment_intent_id: params.paymentIntentId ?? null,
    updated_at: new Date().toISOString(),
  }

  if (isLikelyUuid(bookingId)) {
    const { error } = await supabase.from("bookings").update(updatePayload).eq("id", bookingId)
    if (error) {
      console.error("[deposit/start] Failed to persist canonical pending deposit state:", error)
    }
    return
  }

  const eventDate =
    params.payload.eventDate && /^\d{4}-\d{2}-\d{2}$/.test(params.payload.eventDate)
      ? params.payload.eventDate
      : new Date().toISOString().slice(0, 10)
  const eventTime = params.payload.eventTime || "TBD"
  const customerName = params.payload.customerName || "Guest"
  const customerEmail = isLikelyEmail(params.payload.customerEmail) ? params.payload.customerEmail : "unknown@example.com"
  const guestAdults = Number.isFinite(params.payload.adults) ? Math.max(0, Math.round(params.payload.adults as number)) : 0
  const guestKids = Number.isFinite(params.payload.kids) ? Math.max(0, Math.round(params.payload.kids as number)) : 0
  const totalCostRaw = Number.isFinite(params.payload.totalAmount)
    ? Number(params.payload.totalAmount)
    : Number.isFinite(params.payload.estimateHigh)
      ? Number(params.payload.estimateHigh)
      : canonicalDepositAmount
  const totalCost = Number(Math.max(0, totalCostRaw).toFixed(2))

  const markerParts = [
    "Auto-generated booking for deposit checkout",
    params.payload.bookingId ? `external_booking_id=${params.payload.bookingId}` : undefined,
    params.payload.source ? `deposit_source=${params.payload.source}` : undefined,
  ].filter(Boolean)

  const placeholderBooking: Record<string, unknown> = {
    full_name: customerName,
    email: customerEmail,
    phone: "TBD",
    address: params.payload.location || "TBD",
    zip_code: "00000",
    event_date: eventDate,
    event_time: eventTime,
    guest_adults: guestAdults,
    guest_kids: guestKids,
    price_adult: 0,
    price_kid: 0,
    travel_fee: 0,
    premium_proteins: [],
    add_ons: [],
    special_requests: markerParts.join(" | "),
    total_cost: totalCost,
    status: "pending",
    deposit: Math.round(canonicalDepositAmount),
    deposit_amount: canonicalDepositAmount,
    deposit_status: "pending",
    stripe_session_id: params.sessionId,
    payment_intent_id: params.paymentIntentId ?? null,
  }

  const { error } = await supabase.from("bookings").insert(placeholderBooking)
  if (error) {
    console.error("[deposit/start] Failed to insert placeholder booking for non-UUID deposit flow:", error, {
      bookingIdFromPayload: bookingId,
      sessionId: params.sessionId,
    })
  }
}

function formatUsd(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "N/A"
  }
  return `$${value.toFixed(2)}`
}

async function sendOpsLeadNotification(params: {
  payload: NormalizedDepositStartPayload
  sessionId: string
  depositAmount: number
  checkoutUrl: string
}) {
  const resendApiKey = normalizeString(process.env.RESEND_API_KEY)
  if (!resendApiKey) {
    return
  }

  const from = normalizeString(process.env.EMAIL_FROM) ?? "support@realhibachi.com"
  const to = normalizeString(process.env.EMAIL_TO) ?? "support@realhibachi.com"
  const bookingRef = params.payload.bookingId ?? params.sessionId
  const source = params.payload.source ?? "deposit_pay"
  const estimateRange =
    typeof params.payload.estimateLow === "number" && typeof params.payload.estimateHigh === "number"
      ? `${formatUsd(params.payload.estimateLow)} - ${formatUsd(params.payload.estimateHigh)}`
      : "N/A"

  const text = [
    "New Real Hibachi lead reached deposit checkout.",
    `Booking Ref: ${bookingRef}`,
    `Stripe Session ID: ${params.sessionId}`,
    `Source: ${source}`,
    `Customer Name: ${params.payload.customerName ?? "N/A"}`,
    `Customer Email: ${params.payload.customerEmail ?? "N/A"}`,
    `Event Date: ${params.payload.eventDate ?? "N/A"}`,
    `Event Time: ${params.payload.eventTime ?? "N/A"}`,
    `Location: ${params.payload.location ?? "N/A"}`,
    `Guests: adults=${params.payload.adults ?? 0}, kids=${params.payload.kids ?? 0}`,
    `Estimate Range: ${estimateRange}`,
    `Deposit Amount: ${formatUsd(params.depositAmount)}`,
    `Checkout URL: ${params.checkoutUrl}`,
  ].join("\n")

  const html = [
    "<p>New Real Hibachi lead reached deposit checkout.</p>",
    `<p><strong>Booking Ref:</strong> ${bookingRef}</p>`,
    `<p><strong>Stripe Session ID:</strong> ${params.sessionId}</p>`,
    `<p><strong>Source:</strong> ${source}</p>`,
    `<p><strong>Customer Name:</strong> ${params.payload.customerName ?? "N/A"}</p>`,
    `<p><strong>Customer Email:</strong> ${params.payload.customerEmail ?? "N/A"}</p>`,
    `<p><strong>Event Date:</strong> ${params.payload.eventDate ?? "N/A"}</p>`,
    `<p><strong>Event Time:</strong> ${params.payload.eventTime ?? "N/A"}</p>`,
    `<p><strong>Location:</strong> ${params.payload.location ?? "N/A"}</p>`,
    `<p><strong>Guests:</strong> adults=${params.payload.adults ?? 0}, kids=${params.payload.kids ?? 0}</p>`,
    `<p><strong>Estimate Range:</strong> ${estimateRange}</p>`,
    `<p><strong>Deposit Amount:</strong> ${formatUsd(params.depositAmount)}</p>`,
    `<p><strong>Checkout URL:</strong> <a href="${params.checkoutUrl}">${params.checkoutUrl}</a></p>`,
  ].join("")

  try {
    const resend = new Resend(resendApiKey)
    const { error } = await resend.emails.send({
      from,
      to: [to],
      subject: `Lead Trigger: Deposit Checkout Started (${bookingRef})`,
      text,
      html,
    })

    if (error) {
      console.error("[deposit/start] Lead notification email failed:", {
        bookingRef,
        sessionId: params.sessionId,
        error: error.message,
      })
    }
  } catch (error) {
    console.error("[deposit/start] Lead notification email threw error:", {
      bookingRef,
      sessionId: params.sessionId,
      error: error instanceof Error ? error.message : "unknown_error",
    })
  }
}

async function createCheckoutSession(
  request: NextRequest,
  payload: NormalizedDepositStartPayload,
): Promise<{
  session: Stripe.Checkout.Session
  checkoutUrl: string
  depositAmount: number
  paymentIntentId?: string
}> {
  const stripe = getStripeServerClient()
  const origin = resolveOrigin(request)
  const currency = payload.currency
  const depositAmount = resolveDepositAmount(payload)
  const unitAmount = Math.round(depositAmount * 100)

  if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
    throw new Error("Invalid deposit amount.")
  }

  const metadata = buildMetadata(payload, depositAmount, currency)

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: isLikelyEmail(payload.customerEmail) ? payload.customerEmail : undefined,
    success_url: buildSuccessUrl(origin, payload),
    cancel_url: buildCancelUrl(origin, payload),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: unitAmount,
          product_data: {
            name: "Real Hibachi Date-Lock Deposit",
            description: normalizeCheckoutDescription(payload),
          },
        },
      },
    ],
    metadata,
    payment_intent_data: {
      metadata,
    },
  })

  if (!session.url) {
    throw new Error("Stripe Checkout session was created without a redirect URL.")
  }

  return {
    session,
    checkoutUrl: session.url,
    depositAmount,
    paymentIntentId: normalizePaymentIntentId(session.payment_intent),
  }
}

export async function POST(request: NextRequest) {
  let rawPayload: unknown

  try {
    rawPayload = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 })
  }

  const payload = buildNormalizedPayload((rawPayload ?? {}) as DepositStartPayload)

  try {
    const { session, checkoutUrl, depositAmount, paymentIntentId } = await createCheckoutSession(request, payload)
    await persistPendingDepositState({
      payload,
      sessionId: session.id,
      paymentIntentId,
      depositAmount,
    })
    await sendOpsLeadNotification({
      payload,
      sessionId: session.id,
      depositAmount,
      checkoutUrl,
    })

    return NextResponse.json({
      success: true,
      checkoutUrl,
      sessionId: session.id,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start Stripe Checkout."
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const payload = parseGetPayload(request)

  try {
    const { session, checkoutUrl, depositAmount, paymentIntentId } = await createCheckoutSession(request, payload)
    await persistPendingDepositState({
      payload,
      sessionId: session.id,
      paymentIntentId,
      depositAmount,
    })
    await sendOpsLeadNotification({
      payload,
      sessionId: session.id,
      depositAmount,
      checkoutUrl,
    })

    return NextResponse.redirect(checkoutUrl, 302)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start Stripe Checkout."
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
