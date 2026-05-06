import { createHmac, randomUUID } from "node:crypto"
import type Stripe from "stripe"
import { normalizeRhBookingNumber } from "@/lib/booking-number"
import { getRuntimeEnvironmentTag } from "@/lib/runtime-env"

export type CrmBookingSnapshot = {
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

export type CrmDepositPaidEventEnvelope = {
  event_id: string
  event_type: "order.deposit_paid"
  occurred_at: string
  source: string
  order: {
    external_order_id: string
    order_number?: string
    customer_name: string
    customer_phone?: string
    customer_email?: string
    event_start: string
    event_timezone: "America/Los_Angeles"
    event_address?: string
    guest_adult_count?: number
    guest_child_count?: number
    invoice_details?: {
      total_cost?: number
      travel_fee?: number
    }
    notes?: string
  }
  payment: {
    external_payment_id: string
    type: "deposit"
    status: "paid"
    amount_cents: number
    currency: "USD"
    provider: "stripe"
    paid_at: string
    transaction_ref?: string
    receipt_url?: string
  }
  metadata: {
    stripe_event_id: string
    checkout_session_id: string
    livemode: boolean
    event_category: "deposit_primary"
    deployment_environment: "pre" | "production"
    stripe_mode: "test" | "live"
    notification_mode: "suppressed" | "live"
  }
}

export type CrmPaymentRefundedEventEnvelope = {
  event_id: string
  event_type: "payment.refunded"
  occurred_at: string
  source: string
  order: {
    external_order_id: string
    order_number?: string
    customer_name: string
    customer_phone?: string
    customer_email?: string
    event_timezone: "America/Los_Angeles"
    event_address?: string
    guest_adult_count?: number
    guest_child_count?: number
    invoice_details?: {
      total_cost?: number
      travel_fee?: number
    }
    notes?: string
  }
  payment: {
    external_payment_id: string
    type: "deposit"
    status: "refunded"
    amount_cents: number
    currency: "USD"
    provider: "stripe"
    refunded_at: string
    transaction_ref?: string
    receipt_url?: string
  }
  metadata: {
    stripe_event_id: string
    charge_id: string
    payment_intent_id?: string
    livemode: boolean
    event_category: "deposit_refund"
    deployment_environment: "pre" | "production"
    stripe_mode: "test" | "live"
    notification_mode: "suppressed" | "live"
  }
}

export type CrmEventEnvelope = CrmDepositPaidEventEnvelope | CrmPaymentRefundedEventEnvelope

type BuildCrmEnvelopeResult<TEnvelope extends CrmEventEnvelope = CrmEventEnvelope> =
  | {
      ok: true
      envelope: TEnvelope
    }
  | {
      ok: false
      reason: "missing_required_fields"
      detail: string
    }

export type CrmIntegrationResult =
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

type CrmIntegrationConfig = {
  baseUrl: string
  sharedSecret: string
  partnerId: string
}

const CRM_EVENT_PATH = "/api/integrations/v1/events"
const DEFAULT_PARTNER_ID = "official_website"
const DEFAULT_SOURCE = "official_website"
const DEFAULT_EVENT_TIME = "18:00"
const REQUEST_TIMEOUT_MS = 8_000
const RETRY_DELAYS_MS = [0, 1_000, 3_000]
const PRE_TEST_NOTE_PREFIX = "[PRE TEST]"

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function parseExternalBookingIdMarker(value: string | null | undefined): string | undefined {
  const text = asString(value)
  if (!text) return undefined
  const match = text.match(/(?:^|\|)\s*external_booking_id\s*=\s*([A-Za-z0-9-]+)\s*(?:\||$)/i)
  if (!match) return undefined
  return asString(match[1])
}

function prefixPreTestNote(note: string | undefined, stripeMode: "test" | "live"): string {
  const suffix = note ?? `Stripe ${stripeMode} payment created from the pre deployment.`
  if (suffix.startsWith(PRE_TEST_NOTE_PREFIX)) {
    return suffix
  }
  return `${PRE_TEST_NOTE_PREFIX} ${suffix}`
}

function resolveRhBookingId(params: {
  bookingId?: string | null
  sessionBookingId?: string | null
  clientReferenceId?: string | null
  specialRequests?: string | null
}): string | undefined {
  const fromSession = normalizeRhBookingNumber(params.sessionBookingId)
  if (fromSession) return fromSession

  const fromMarker = normalizeRhBookingNumber(parseExternalBookingIdMarker(params.specialRequests))
  if (fromMarker) return fromMarker

  const fromClientReference = normalizeRhBookingNumber(params.clientReferenceId)
  if (fromClientReference) return fromClientReference

  const fromBooking = normalizeRhBookingNumber(params.bookingId)
  if (fromBooking) return fromBooking

  return undefined
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

function amountFromStripeCharge(charge: Stripe.Charge): number | undefined {
  const amountMinor = charge.amount_refunded > 0 ? charge.amount_refunded : charge.amount
  if (typeof amountMinor !== "number" || !Number.isFinite(amountMinor) || amountMinor <= 0) {
    return undefined
  }
  return Number((amountMinor / 100).toFixed(2))
}

function toIsoStringFromUnixSeconds(value: number | null | undefined): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined
  }
  return new Date(value * 1000).toISOString()
}

function paymentIntentIdFromCharge(value: Stripe.Charge["payment_intent"]): string | undefined {
  if (typeof value === "string") {
    return asString(value)
  }

  if (value && typeof value === "object" && "id" in value) {
    return asString((value as { id?: unknown }).id)
  }

  return undefined
}

function refundedAtFromCharge(charge: Stripe.Charge): string | undefined {
  const refunds = Array.isArray(charge.refunds?.data) ? charge.refunds.data : []
  const latestRefund = refunds.reduce<Stripe.Refund | null>((latest, candidate) => {
    if (!latest) return candidate
    return candidate.created > latest.created ? candidate : latest
  }, null)

  return toIsoStringFromUnixSeconds(latestRefund?.created) ?? toIsoStringFromUnixSeconds(charge.created)
}

function resolveSource(source?: string): string {
  return asString(source) ?? asString(process.env.CRM_INTEGRATION_SOURCE) ?? DEFAULT_SOURCE
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

function getCrmConfig(): CrmIntegrationConfig | null {
  const baseUrl = asString(process.env.CRM_INTEGRATION_BASE_URL)
  const sharedSecret = asString(process.env.CRM_INTEGRATION_SHARED_SECRET)
  if (!baseUrl || !sharedSecret) {
    return null
  }

  const partnerId = asString(process.env.CRM_INTEGRATION_PARTNER_ID) ?? DEFAULT_PARTNER_ID
  return {
    baseUrl: normalizeBaseUrl(baseUrl),
    sharedSecret,
    partnerId,
  }
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

export function buildDepositPaidEventEnvelope(params: {
  stripeEventId: string
  session: Stripe.Checkout.Session
  booking: CrmBookingSnapshot | null
  paymentIntentId?: string
  depositAmount?: number
  source?: string
}): BuildCrmEnvelopeResult<CrmDepositPaidEventEnvelope> {
  const source = resolveSource(params.source)
  const deploymentEnvironment = getRuntimeEnvironmentTag()
  const stripeMode = params.session.livemode ? "live" : "test"
  const notificationMode = deploymentEnvironment === "pre" ? "suppressed" : "live"
  const preferredRhBookingId = resolveRhBookingId({
    bookingId: params.booking?.id,
    sessionBookingId: params.session.metadata?.booking_id,
    clientReferenceId: params.session.client_reference_id,
    specialRequests: params.booking?.special_requests,
  })
  const externalOrderId =
    preferredRhBookingId ??
    asString(params.session.metadata?.booking_id) ??
    asString(params.booking?.id) ??
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
      ok: false,
      reason: "missing_required_fields",
      detail: "external_order_id, external_payment_id, or amount_cents is missing.",
    }
  }

  return {
    ok: true,
    envelope: {
      event_id: `evt_stripe_${params.stripeEventId}`,
      event_type: "order.deposit_paid",
      occurred_at: fallbackOccurredAt,
      source,
      order: {
        external_order_id: externalOrderId,
        order_number: preferredRhBookingId,
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
        notes:
          deploymentEnvironment === "pre"
            ? prefixPreTestNote(asString(params.booking?.special_requests), stripeMode)
            : asString(params.booking?.special_requests) ?? "Deposit paid via Stripe Checkout on website.",
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
        receipt_url: undefined,
      },
      metadata: {
        stripe_event_id: params.stripeEventId,
        checkout_session_id: params.session.id,
        livemode: params.session.livemode,
        event_category: "deposit_primary",
        deployment_environment: deploymentEnvironment,
        stripe_mode: stripeMode,
        notification_mode: notificationMode,
      },
    },
  }
}

export function buildPaymentRefundedEventEnvelope(params: {
  stripeEventId: string
  charge: Stripe.Charge
  booking: CrmBookingSnapshot | null
  paymentIntentId?: string
  refundedAmount?: number
  refundedAt?: string
  source?: string
}): BuildCrmEnvelopeResult<CrmPaymentRefundedEventEnvelope> {
  const source = resolveSource(params.source)
  const deploymentEnvironment = getRuntimeEnvironmentTag()
  const stripeMode = params.charge.livemode ? "live" : "test"
  const notificationMode = deploymentEnvironment === "pre" ? "suppressed" : "live"
  const preferredRhBookingId = resolveRhBookingId({
    bookingId: params.booking?.id,
    sessionBookingId: params.charge.metadata?.booking_id,
    specialRequests: params.booking?.special_requests,
  })
  const externalOrderId =
    preferredRhBookingId ??
    asString(params.charge.metadata?.booking_id) ??
    asString(params.booking?.id)
  const externalPaymentId =
    asString(params.paymentIntentId) ?? paymentIntentIdFromCharge(params.charge.payment_intent) ?? params.charge.id

  const customerName = asString(params.booking?.full_name) ?? "Website Customer"
  const refundedAmount =
    params.refundedAmount ??
    amountFromStripeCharge(params.charge) ??
    (typeof params.booking?.deposit_amount === "number" ? params.booking.deposit_amount : undefined)
  const amountCents = toAmountCents(refundedAmount)
  const refundedAt = asString(params.refundedAt) ?? refundedAtFromCharge(params.charge)

  if (!externalOrderId || !externalPaymentId || !amountCents || !refundedAt) {
    return {
      ok: false,
      reason: "missing_required_fields",
      detail: "external_order_id, external_payment_id, amount_cents, or refunded_at is missing.",
    }
  }

  return {
    ok: true,
    envelope: {
      event_id: `evt_stripe_${params.stripeEventId}`,
      event_type: "payment.refunded",
      occurred_at: refundedAt,
      source,
      order: {
        external_order_id: externalOrderId,
        order_number: preferredRhBookingId,
        customer_name: customerName,
        customer_phone: asString(params.booking?.phone),
        customer_email: asString(params.booking?.email),
        event_timezone: "America/Los_Angeles",
        event_address: asString(params.booking?.address),
        guest_adult_count: typeof params.booking?.guest_adults === "number" ? params.booking.guest_adults : undefined,
        guest_child_count: typeof params.booking?.guest_kids === "number" ? params.booking.guest_kids : undefined,
        invoice_details:
          typeof params.booking?.total_cost === "number" || typeof params.booking?.travel_fee === "number"
            ? {
                total_cost: params.booking?.total_cost ?? undefined,
                travel_fee: params.booking?.travel_fee ?? undefined,
              }
            : undefined,
        notes:
          deploymentEnvironment === "pre"
            ? prefixPreTestNote(asString(params.booking?.special_requests), stripeMode)
            : asString(params.booking?.special_requests) ?? "Deposit refunded via Stripe on website.",
      },
      payment: {
        external_payment_id: externalPaymentId,
        type: "deposit",
        status: "refunded",
        amount_cents: amountCents,
        currency: "USD",
        provider: "stripe",
        refunded_at: refundedAt,
        transaction_ref: asString(params.paymentIntentId) ?? paymentIntentIdFromCharge(params.charge.payment_intent),
        receipt_url: asString(params.charge.receipt_url),
      },
      metadata: {
        stripe_event_id: params.stripeEventId,
        charge_id: params.charge.id,
        payment_intent_id: asString(params.paymentIntentId) ?? paymentIntentIdFromCharge(params.charge.payment_intent),
        livemode: params.charge.livemode,
        event_category: "deposit_refund",
        deployment_environment: deploymentEnvironment,
        stripe_mode: stripeMode,
        notification_mode: notificationMode,
      },
    },
  }
}

export async function sendCrmEventEnvelope(params: {
  envelope: CrmEventEnvelope
  requestId?: string
}): Promise<CrmIntegrationResult> {
  const config = getCrmConfig()
  if (!config) {
    return {
      attempted: false,
      delivered: false,
      reason: "not_configured",
      detail: "CRM_INTEGRATION_BASE_URL or CRM_INTEGRATION_SHARED_SECRET is missing.",
    }
  }

  const requestId = params.requestId ?? `req_mkt_${randomUUID()}`
  const endpoint = `${config.baseUrl}${CRM_EVENT_PATH}`
  const rawBody = JSON.stringify(params.envelope)

  const delivery = await sendWithRetry({
    endpoint,
    partnerId: config.partnerId,
    sharedSecret: config.sharedSecret,
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

export async function sendDepositPaidEventToCrm(params: {
  stripeEventId: string
  session: Stripe.Checkout.Session
  booking: CrmBookingSnapshot | null
  paymentIntentId?: string
  depositAmount?: number
}): Promise<CrmIntegrationResult> {
  const built = buildDepositPaidEventEnvelope(params)
  if (!built.ok) {
    return {
      attempted: false,
      delivered: false,
      reason: "missing_required_fields",
      detail: built.detail,
    }
  }

  return sendCrmEventEnvelope({
    envelope: built.envelope,
  })
}
