type Ga4ServerTrackResult = {
  attempted: boolean
  delivered: boolean
  skippedReason?: string
  statusCode?: number
  error?: string
}

export type TrackDepositCompletedServerParams = {
  stripeEventId: string
  checkoutSessionId?: string | null
  transactionId?: string | null
  bookingId?: string | null
  value?: number
  currency?: string | null
  depositSource?: string | null
}

export type TrackBookingSubmitServerParams = {
  eventId?: string | null
  leadId?: string | null
  bookingId?: string | null
  leadSource?: string | null
  sourcePage?: string | null
  cityOrZip?: string | null
  guestCount?: number
  adults?: number
  kids?: number
  eventDate?: string | null
  eventTime?: string | null
  pricingTier?: string | null
  estimateLow?: number
  estimateHigh?: number
  value?: number
  currency?: string | null
  tablewareRental?: boolean
  tent10x10?: boolean
  premiumUpgradeCount?: number
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function removeUndefinedFields<T extends Record<string, unknown>>(input: T): T {
  const entries = Object.entries(input).filter(([, value]) => value !== undefined)
  return Object.fromEntries(entries) as T
}

function normalizeCurrency(value: string | null | undefined): string {
  const raw = asNonEmptyString(value)
  return (raw ?? "USD").toUpperCase()
}

function normalizeAmount(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined
  }
  return Number(value.toFixed(2))
}

function fnv1a(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function buildClientId(seed: string): string {
  const primary = fnv1a(seed)
  const secondary = fnv1a(`realhibachi:${seed}`)
  return `${primary}.${secondary}`
}

function buildDepositEventId(params: TrackDepositCompletedServerParams): string {
  return (
    asNonEmptyString(params.checkoutSessionId) ??
    asNonEmptyString(params.transactionId) ??
    asNonEmptyString(params.bookingId) ??
    asNonEmptyString(params.stripeEventId) ??
    "unknown"
  )
}

function buildBookingSubmitEventId(params: TrackBookingSubmitServerParams): string {
  return (
    asNonEmptyString(params.eventId) ??
    asNonEmptyString(params.leadId) ??
    asNonEmptyString(params.bookingId) ??
    `booking_submit_${Date.now()}`
  )
}

function resolveGa4MeasurementConfig(): {
  measurementId?: string
  apiSecret?: string
  endpoint: string
} {
  return {
    measurementId:
      asNonEmptyString(process.env.GA4_MEASUREMENT_ID) ?? asNonEmptyString(process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID),
    apiSecret: asNonEmptyString(process.env.GA4_MP_API_SECRET),
    endpoint: asNonEmptyString(process.env.GA4_MP_ENDPOINT) ?? "https://www.google-analytics.com/mp/collect",
  }
}

async function sendGa4MeasurementEvent(params: {
  clientId: string
  userId?: string
  name: string
  eventParams: Record<string, unknown>
}): Promise<Ga4ServerTrackResult> {
  const { measurementId, apiSecret, endpoint } = resolveGa4MeasurementConfig()

  if (!measurementId) {
    return {
      attempted: false,
      delivered: false,
      skippedReason: "missing_ga4_measurement_id",
    }
  }

  if (!apiSecret) {
    return {
      attempted: false,
      delivered: false,
      skippedReason: "missing_ga4_mp_api_secret",
    }
  }

  const body = {
    client_id: params.clientId,
    user_id: params.userId,
    events: [
      {
        name: params.name,
        params: removeUndefinedFields(params.eventParams),
      },
    ],
  }

  const url = `${endpoint}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    })

    if (!response.ok) {
      const responseText = await response.text().catch(() => "")
      return {
        attempted: true,
        delivered: false,
        statusCode: response.status,
        error: responseText || `ga4_mp_http_${response.status}`,
      }
    }

    return {
      attempted: true,
      delivered: true,
      statusCode: response.status,
    }
  } catch (error) {
    return {
      attempted: true,
      delivered: false,
      error: error instanceof Error ? error.message : "ga4_mp_request_failed",
    }
  }
}

export async function trackBookingSubmitServer(
  params: TrackBookingSubmitServerParams,
): Promise<Ga4ServerTrackResult> {
  const dedupeEventId = buildBookingSubmitEventId(params)
  const clientId = buildClientId(dedupeEventId)
  const leadId = asNonEmptyString(params.leadId)
  const bookingId = asNonEmptyString(params.bookingId)
  const currency = normalizeCurrency(params.currency)
  const value = normalizeAmount(params.value ?? params.estimateLow)

  return sendGa4MeasurementEvent({
    clientId,
    userId: leadId ?? bookingId,
    name: "booking_submit",
    eventParams: {
      event_id: dedupeEventId,
      lead_id: leadId,
      booking_id: bookingId,
      lead_source: asNonEmptyString(params.leadSource) ?? "quote_builder",
      lead_channel: "website_booking_request",
      lead_type: "booking_request",
      booking_request: true,
      contact_surface: asNonEmptyString(params.leadSource) ?? "quote_builder",
      quote_surface: asNonEmptyString(params.leadSource) ?? "quote_builder",
      source_page: asNonEmptyString(params.sourcePage),
      city_or_zip: asNonEmptyString(params.cityOrZip),
      guest_count: normalizeAmount(params.guestCount),
      adults: normalizeAmount(params.adults),
      kids: normalizeAmount(params.kids),
      event_date: asNonEmptyString(params.eventDate),
      event_time: asNonEmptyString(params.eventTime),
      quote_tier: asNonEmptyString(params.pricingTier),
      estimate_low: normalizeAmount(params.estimateLow),
      estimate_high: normalizeAmount(params.estimateHigh),
      value,
      currency,
      tableware_rental: params.tablewareRental,
      tent_10x10: params.tent10x10,
      premium_upgrade_count: normalizeAmount(params.premiumUpgradeCount),
      conversion_surface: "booking_request_api",
      tracking_origin: "server_measurement_protocol",
      engagement_time_msec: 1,
    },
  })
}

export async function trackDepositCompletedServer(
  params: TrackDepositCompletedServerParams,
): Promise<Ga4ServerTrackResult> {
  const dedupeEventId = buildDepositEventId(params)
  const clientId = buildClientId(dedupeEventId)
  const bookingId = asNonEmptyString(params.bookingId)
  const transactionId = asNonEmptyString(params.transactionId)
  const checkoutSessionId = asNonEmptyString(params.checkoutSessionId)
  const currency = normalizeCurrency(params.currency)
  const value = normalizeAmount(params.value)
  const depositSource = asNonEmptyString(params.depositSource) ?? "stripe_webhook"

  return sendGa4MeasurementEvent({
    clientId,
    userId: bookingId,
    name: "deposit_completed",
    eventParams: {
      transaction_id: transactionId,
      event_id: dedupeEventId,
      checkout_session_id: checkoutSessionId,
      booking_id: bookingId,
      value,
      currency,
      deposit_source: depositSource,
      conversion_surface: "deposit_webhook",
      tracking_origin: "server_measurement_protocol",
      engagement_time_msec: 1,
    },
  })
}
