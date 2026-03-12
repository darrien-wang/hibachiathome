import { createHmac, randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { normalizeRhBookingNumber } from "@/lib/booking-number"
import { createServerSupabaseClient } from "@/lib/supabase"

export const runtime = "nodejs"

type CanonicalDepositStatus = "pending" | "paid" | "refunded"

type VerifyResponse = {
  success: boolean
  paid: boolean
  session_id: string | null
  status: CanonicalDepositStatus | "not_found" | "invalid_request"
  value?: number
  currency?: string
  transaction_id?: string
  booking_id?: string
  email?: string
  phone?: string
  customer_name?: string
  event_date?: string
  event_time?: string
  location?: string
  adults?: number
  kids?: number
  error?: string
}

function jsonNoStore(body: VerifyResponse, status = 200) {
  const response = NextResponse.json(body, { status })
  response.headers.set("Cache-Control", "no-store")
  return response
}

function normalizeSessionId(value: string | null): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeAmount(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined
  }

  return Number(value.toFixed(2))
}

function normalizeCanonicalStatus(value: unknown): CanonicalDepositStatus {
  if (value === "paid" || value === "refunded" || value === "pending") {
    return value
  }
  return "pending"
}

function normalizeTransactionId(input: { payment_intent_id?: unknown; stripe_session_id?: unknown; fallbackSessionId: string }) {
  if (typeof input.payment_intent_id === "string" && input.payment_intent_id.trim()) {
    return input.payment_intent_id
  }

  if (typeof input.stripe_session_id === "string" && input.stripe_session_id.trim()) {
    return input.stripe_session_id
  }

  return input.fallbackSessionId
}

function normalizePrefillEmail(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const normalized = value.trim().toLowerCase()
  if (!normalized || normalized === "unknown@example.com" || normalized === "n/a") {
    return undefined
  }

  return normalized
}

function normalizePrefillPhone(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const normalized = value.trim()
  if (!normalized) {
    return undefined
  }

  const lowered = normalized.toLowerCase()
  if (lowered === "tbd" || lowered === "n/a" || lowered === "na" || lowered === "unknown") {
    return undefined
  }

  return normalized
}

function normalizePrefillText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const normalized = value.trim()
  return normalized ? normalized : undefined
}

function normalizeGuestCount(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value))
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.trunc(parsed))
    }
  }

  return undefined
}

function normalizeNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function extractExternalBookingIdFromSpecialRequests(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined
  }

  const match = value.match(/(?:^|\|)\s*external_booking_id\s*=\s*([A-Za-z0-9-]+)\s*(?:\||$)/i)
  if (!match || !match[1]) {
    return undefined
  }

  return normalizeNonEmptyString(match[1])
}

function resolvePublicBookingNumber(params: {
  queryBookingId: string | null
  bookingPrimaryKey: unknown
  specialRequests: unknown
}): string | undefined {
  const fromQuery = normalizeRhBookingNumber(params.queryBookingId)
  if (fromQuery) {
    return fromQuery
  }

  const fromSpecialRequests = normalizeRhBookingNumber(extractExternalBookingIdFromSpecialRequests(params.specialRequests))
  if (fromSpecialRequests) {
    return fromSpecialRequests
  }

  if (typeof params.bookingPrimaryKey === "string") {
    return normalizeRhBookingNumber(params.bookingPrimaryKey) ?? undefined
  }

  return undefined
}

function resolveExternalOrderId(params: {
  queryBookingId: string | null
  bookingPrimaryKey: unknown
  specialRequests: unknown
}): string | undefined {
  const fromMarker = extractExternalBookingIdFromSpecialRequests(params.specialRequests)
  if (fromMarker) return fromMarker

  const fromQuery = normalizeNonEmptyString(params.queryBookingId)
  if (fromQuery) return fromQuery

  if (typeof params.bookingPrimaryKey === "string" && params.bookingPrimaryKey.trim()) {
    return params.bookingPrimaryKey
  }

  return undefined
}

function resolveIntegrationBaseUrl(): string | undefined {
  const baseUrl =
    normalizeNonEmptyString(process.env.INVOICE_INTEGRATION_BASE_URL) ??
    normalizeNonEmptyString(process.env.CRM_INTEGRATION_BASE_URL)
  if (!baseUrl) return undefined
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
}

function resolveIntegrationPartnerId(): string {
  return (
    normalizeNonEmptyString(process.env.INTEGRATION_PARTNER_ID) ??
    normalizeNonEmptyString(process.env.CRM_INTEGRATION_PARTNER_ID) ??
    "official_website"
  )
}

function resolveIntegrationSharedSecret(): string | undefined {
  return (
    normalizeNonEmptyString(process.env.INTEGRATION_SHARED_SECRET) ??
    normalizeNonEmptyString(process.env.CRM_INTEGRATION_SHARED_SECRET)
  )
}

function buildIntegrationAuthHeaders(partnerId: string, sharedSecret: string): HeadersInit {
  const timestamp = String(Math.floor(Date.now() / 1000))
  const payload = `${timestamp}.`
  const signature = createHmac("sha256", sharedSecret).update(payload, "utf8").digest("hex")

  return {
    "X-Partner-Id": partnerId,
    "X-Timestamp": timestamp,
    "X-Signature": `v1=${signature}`,
    "X-Request-Id": `req_verify_${randomUUID()}`,
    Accept: "application/json",
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined
  }
  return value as Record<string, unknown>
}

function extractOrderNoFromIntegrationResponse(value: unknown): string | undefined {
  const record = asRecord(value)
  if (!record) return undefined

  const fromTopLevel = normalizeRhBookingNumber(normalizeNonEmptyString(record.order_no))
  if (fromTopLevel) return fromTopLevel

  const data = asRecord(record.data)
  const fromData = normalizeRhBookingNumber(normalizeNonEmptyString(data?.order_no))
  if (fromData) return fromData

  return undefined
}

async function resolvePaidOrderNoByExternalOrderId(externalOrderId: string | undefined): Promise<string | undefined> {
  const normalizedExternalOrderId = normalizeNonEmptyString(externalOrderId)
  if (!normalizedExternalOrderId) return undefined

  const baseUrl = resolveIntegrationBaseUrl()
  const sharedSecret = resolveIntegrationSharedSecret()
  if (!baseUrl || !sharedSecret) {
    return undefined
  }

  const partnerId = resolveIntegrationPartnerId()
  const endpoint = `${baseUrl}/api/integrations/v1/orders/${encodeURIComponent(normalizedExternalOrderId)}`

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: buildIntegrationAuthHeaders(partnerId, sharedSecret),
      cache: "no-store",
    })

    if (!response.ok) {
      return undefined
    }

    const payload = (await response.json().catch(() => null)) as unknown
    return extractOrderNoFromIntegrationResponse(payload)
  } catch (error) {
    console.warn("[deposit/verify] Failed to resolve paid order_no from integration endpoint:", {
      externalOrderId: normalizedExternalOrderId,
      error: error instanceof Error ? error.message : "unknown_error",
    })
    return undefined
  }
}

export async function GET(request: NextRequest) {
  const sessionId = normalizeSessionId(request.nextUrl.searchParams.get("session_id"))
  const queryBookingId = request.nextUrl.searchParams.get("booking_id")
  if (!sessionId) {
    return jsonNoStore(
      {
        success: false,
        paid: false,
        session_id: null,
        status: "invalid_request",
        error: "Missing session_id query parameter.",
      },
      400,
    )
  }

  const supabase = createServerSupabaseClient()
  if (!supabase) {
    return jsonNoStore(
      {
        success: false,
        paid: false,
        session_id: sessionId,
        status: "invalid_request",
        error: "Supabase server client is not configured.",
      },
      500,
    )
  }

  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, email, phone, full_name, event_date, event_time, address, guest_adults, guest_kids, special_requests, deposit_status, deposit_amount, payment_intent_id, stripe_session_id",
    )
    .eq("stripe_session_id", sessionId)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("[deposit/verify] Failed to load canonical deposit state:", error)
    return jsonNoStore(
      {
        success: false,
        paid: false,
        session_id: sessionId,
        status: "invalid_request",
        error: "Failed to verify deposit status.",
      },
      500,
    )
  }

  if (!data) {
    return jsonNoStore({
      success: true,
      paid: false,
      session_id: sessionId,
      status: "not_found",
      currency: "USD",
    })
  }

  const canonicalStatus = normalizeCanonicalStatus(data.deposit_status)
  const paid = canonicalStatus === "paid"
  const value = normalizeAmount(data.deposit_amount)
  const transactionId = normalizeTransactionId({
    payment_intent_id: data.payment_intent_id,
    stripe_session_id: data.stripe_session_id,
    fallbackSessionId: sessionId,
  })
  const bookingNumberFallback = resolvePublicBookingNumber({
    queryBookingId,
    bookingPrimaryKey: data.id,
    specialRequests: data.special_requests,
  })
  let bookingNumber = bookingNumberFallback

  if (!bookingNumber && paid) {
    const externalOrderId = resolveExternalOrderId({
      queryBookingId,
      bookingPrimaryKey: data.id,
      specialRequests: data.special_requests,
    })
    bookingNumber = await resolvePaidOrderNoByExternalOrderId(externalOrderId)
  }

  return jsonNoStore({
    success: true,
    paid,
    session_id: sessionId,
    status: canonicalStatus,
    value,
    currency: "USD",
    transaction_id: paid ? transactionId : undefined,
    booking_id: bookingNumber,
    email: normalizePrefillEmail(data.email),
    phone: normalizePrefillPhone(data.phone),
    customer_name: normalizePrefillText(data.full_name),
    event_date: normalizePrefillText(data.event_date),
    event_time: normalizePrefillText(data.event_time),
    location: normalizePrefillText(data.address),
    adults: normalizeGuestCount(data.guest_adults),
    kids: normalizeGuestCount(data.guest_kids),
  })
}
