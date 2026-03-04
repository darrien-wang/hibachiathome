import { NextRequest, NextResponse } from "next/server"
import type Stripe from "stripe"
import { getDepositAmount } from "@/config/deposit"
import { getStripeServerClient } from "@/lib/stripe-server"

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

function buildNormalizedPayload(payload: DepositStartPayload): NormalizedDepositStartPayload {
  return {
    bookingId: normalizeString(payload.bookingId),
    source: normalizeString(payload.source),
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

function buildSuccessUrl(origin: string): string {
  return `${origin}${CHECKOUT_SUCCESS_PATH}?session_id={CHECKOUT_SESSION_ID}`
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

async function createCheckoutSession(
  request: NextRequest,
  payload: NormalizedDepositStartPayload,
): Promise<{ session: Stripe.Checkout.Session; checkoutUrl: string }> {
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
    success_url: buildSuccessUrl(origin),
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

  return { session, checkoutUrl: session.url }
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
    const { session, checkoutUrl } = await createCheckoutSession(request, payload)
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
    const { checkoutUrl } = await createCheckoutSession(request, payload)
    return NextResponse.redirect(checkoutUrl, 302)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start Stripe Checkout."
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
