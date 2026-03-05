import { createHmac, randomUUID } from "node:crypto"
import type Stripe from "stripe"

type CrmBookingSnapshot = {
  id: string
  full_name?: string | null
  phone?: string | null
  email?: string | null
  event_date?: string | null
  event_time?: string | null
  address?: string | null
  guest_adults?: number | null
  guest_kids?: number | null
  total_cost?: number | null
  travel_fee?: number | null
  special_requests?: string | null
  deposit_amount?: number | null
}

type CrmIntegrationResult =
  | {
      attempted: false
      delivered: false
      reason: "not_configured" | "missing_required_fields"
      detail?: string
    }
  | {
      attempted: true
      delivered: boolean
      status?: number
      requestId: string
      body?: unknown
      error?: string
    }

type RetryAttemptResult = {
  delivered: boolean
  status?: number
  body?: unknown
  error?: string
}

const CRM_EVENT_PATH = "/api/integrations/v1/events"
const DEFAULT_PARTNER_ID = "official_website"
const DEFAULT_SOURCE = "official_website"
const DEFAULT_EVENT_TIME = "18:00"
const REQUEST_TIMEOUT_MS = 8_000
const RETRY_DELAYS_MS = [0, 1_000, 3_000]

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function toAmountCents(amount: number | null | undefined): number | undefined {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return undefined
  }
  return Math.round(amount * 100)
}

function amountFromStripeSession(session: Stripe.Checkout.Session): number | undefined {
  if (typeof session.amount_total !== "number" || !Number.isFinite(session.amount_total) || session.amount_total <= 0) {
    return undefined
  }
  return Number((session.amount_total / 100).toFixed(2))
}

function parseTimeTo24Hour(raw: string | undefined): string {
  const value = asString(raw)
  if (!value) return DEFAULT_EVENT_TIME

  const hhmm = value.match(/^([01]?\d|2[0-3]):([0-5]\d)$/)
  if (hhmm) {
    const hour = hhmm[1].padStart(2, "0")
    return `${hour}:${hhmm[2]}`
  }

  const ampm = value.match(/^(\d{1,2})(?::([0-5]\d))?\s*(AM|PM)$/i)
  if (!ampm) {
    return DEFAULT_EVENT_TIME
  }

  let hour = Number(ampm[1])
  const minute = ampm[2] ?? "00"
  const suffix = ampm[3].toUpperCase()

  if (suffix === "AM" && hour === 12) hour = 0
  if (suffix === "PM" && hour < 12) hour += 12

  return `${String(hour).padStart(2, "0")}:${minute}`
}

function buildEventStartIso(params: {
  eventDate?: string | null
  eventTime?: string | null
  fallbackIso: string
}): string {
  const eventDate = asString(params.eventDate)
  if (!eventDate) {
    return params.fallbackIso
  }

  const eventTime = parseTimeTo24Hour(params.eventTime ?? undefined)
  const candidate = new Date(`${eventDate}T${eventTime}:00`)
  if (Number.isNaN(candidate.getTime())) {
    return params.fallbackIso
  }

  return candidate.toISOString()
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

async function postSignedEvent(
  endpoint: string,
  partnerId: string,
  sharedSecret: string,
  rawBody: string,
  requestId: string,
): Promise<RetryAttemptResult> {
  const timestamp = String(Math.floor(Date.now() / 1000))
  const signature = createHmac("sha256", sharedSecret).update(`${timestamp}.${rawBody}`).digest("hex")
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Partner-Id": partnerId,
        "X-Timestamp": timestamp,
        "X-Signature": `v1=${signature}`,
        "X-Request-Id": requestId,
      },
      body: rawBody,
      signal: controller.signal,
      cache: "no-store",
    })

    const body = await response.json().catch(() => undefined)
    return {
      delivered: response.ok,
      status: response.status,
      body,
    }
  } catch (error) {
    return {
      delivered: false,
      error: error instanceof Error ? error.message : "unknown_error",
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function sendWithRetry(params: {
  endpoint: string
  partnerId: string
  sharedSecret: string
  rawBody: string
  requestId: string
}): Promise<RetryAttemptResult> {
  let last: RetryAttemptResult = { delivered: false, error: "unreachable" }

  for (let index = 0; index < RETRY_DELAYS_MS.length; index += 1) {
    const delay = RETRY_DELAYS_MS[index]
    if (delay > 0) {
      await sleep(delay)
    }

    last = await postSignedEvent(params.endpoint, params.partnerId, params.sharedSecret, params.rawBody, params.requestId)
    if (last.delivered) {
      return last
    }

    if (typeof last.status === "number" && !isRetryableStatus(last.status)) {
      return last
    }
  }

  return last
}

export async function sendDepositPaidEventToCrm(params: {
  stripeEventId: string
  session: Stripe.Checkout.Session
  booking: CrmBookingSnapshot | null
  paymentIntentId?: string
  depositAmount?: number
}): Promise<CrmIntegrationResult> {
  const baseUrl = asString(process.env.CRM_INTEGRATION_BASE_URL)
  const sharedSecret = asString(process.env.CRM_INTEGRATION_SHARED_SECRET)
  if (!baseUrl || !sharedSecret) {
    return {
      attempted: false,
      delivered: false,
      reason: "not_configured",
      detail: "CRM_INTEGRATION_BASE_URL or CRM_INTEGRATION_SHARED_SECRET is missing.",
    }
  }

  const partnerId = asString(process.env.CRM_INTEGRATION_PARTNER_ID) ?? DEFAULT_PARTNER_ID
  const source = asString(process.env.CRM_INTEGRATION_SOURCE) ?? DEFAULT_SOURCE

  const externalOrderId =
    asString(params.booking?.id) ??
    asString(params.session.metadata?.booking_id) ??
    asString(params.session.client_reference_id)

  const fallbackOccurredAt = new Date(
    typeof params.session.created === "number" ? params.session.created * 1000 : Date.now(),
  ).toISOString()

  const customerName =
    asString(params.booking?.full_name) ?? asString(params.session.metadata?.customer_name) ?? "Website Customer"

  const eventStart = buildEventStartIso({
    eventDate: params.booking?.event_date ?? params.session.metadata?.event_date ?? null,
    eventTime: params.booking?.event_time ?? params.session.metadata?.event_time ?? null,
    fallbackIso: fallbackOccurredAt,
  })

  const depositAmount =
    params.depositAmount ??
    amountFromStripeSession(params.session) ??
    (typeof params.booking?.deposit_amount === "number" ? params.booking.deposit_amount : undefined)
  const amountCents = toAmountCents(depositAmount ?? undefined)

  const externalPaymentId = asString(params.paymentIntentId) ?? params.session.id

  if (!externalOrderId || !amountCents || !externalPaymentId) {
    return {
      attempted: false,
      delivered: false,
      reason: "missing_required_fields",
      detail: "external_order_id, external_payment_id, or amount_cents is missing.",
    }
  }

  const eventEnvelope = {
    event_id: `evt_stripe_${params.stripeEventId}`,
    event_type: "order.deposit_paid",
    occurred_at: fallbackOccurredAt,
    source,
    order: {
      external_order_id: externalOrderId,
      order_number: asString(params.booking?.id),
      customer_name: customerName,
      customer_phone: asString(params.booking?.phone),
      customer_email:
        asString(params.booking?.email) ??
        asString(params.session.customer_details?.email) ??
        asString(params.session.customer_email),
      event_start: eventStart,
      event_timezone: "America/Los_Angeles",
      event_address: asString(params.booking?.address) ?? asString(params.session.metadata?.location),
      guest_adult_count: typeof params.booking?.guest_adults === "number" ? params.booking.guest_adults : undefined,
      guest_child_count: typeof params.booking?.guest_kids === "number" ? params.booking.guest_kids : undefined,
      invoice_details:
        typeof params.booking?.total_cost === "number" || typeof params.booking?.travel_fee === "number"
          ? {
              total_cost: params.booking?.total_cost ?? undefined,
              travel_fee: params.booking?.travel_fee ?? undefined,
            }
          : undefined,
      notes: asString(params.booking?.special_requests) ?? "Deposit paid via Stripe Checkout on website.",
    },
    payment: {
      external_payment_id: externalPaymentId,
      type: "deposit",
      status: "paid",
      amount_cents: amountCents,
      currency: "USD",
      provider: "stripe",
      paid_at: fallbackOccurredAt,
      transaction_ref: asString(params.paymentIntentId) ?? params.session.id,
      receipt_url: undefined as string | undefined,
    },
    metadata: {
      stripe_event_id: params.stripeEventId,
      checkout_session_id: params.session.id,
      livemode: params.session.livemode,
      event_category: "deposit_primary",
    },
  }

  const requestId = `req_mkt_${randomUUID()}`
  const endpoint = `${normalizeBaseUrl(baseUrl)}${CRM_EVENT_PATH}`
  const rawBody = JSON.stringify(eventEnvelope)

  const delivery = await sendWithRetry({
    endpoint,
    partnerId,
    sharedSecret,
    rawBody,
    requestId,
  })

  return {
    attempted: true,
    delivered: delivery.delivered,
    status: delivery.status,
    requestId,
    body: delivery.body,
    error: delivery.error,
  }
}
