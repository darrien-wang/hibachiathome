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

function buildEventId(params: TrackDepositCompletedServerParams): string {
  return (
    asNonEmptyString(params.checkoutSessionId) ??
    asNonEmptyString(params.transactionId) ??
    asNonEmptyString(params.bookingId) ??
    asNonEmptyString(params.stripeEventId) ??
    "unknown"
  )
}

export async function trackDepositCompletedServer(
  params: TrackDepositCompletedServerParams,
): Promise<Ga4ServerTrackResult> {
  const measurementId =
    asNonEmptyString(process.env.GA4_MEASUREMENT_ID) ?? asNonEmptyString(process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID)
  const apiSecret = asNonEmptyString(process.env.GA4_MP_API_SECRET)
  const endpoint = asNonEmptyString(process.env.GA4_MP_ENDPOINT) ?? "https://www.google-analytics.com/mp/collect"

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

  const dedupeEventId = buildEventId(params)
  const clientId = buildClientId(dedupeEventId)
  const bookingId = asNonEmptyString(params.bookingId)
  const transactionId = asNonEmptyString(params.transactionId)
  const checkoutSessionId = asNonEmptyString(params.checkoutSessionId)
  const currency = normalizeCurrency(params.currency)
  const value = normalizeAmount(params.value)
  const depositSource = asNonEmptyString(params.depositSource) ?? "stripe_webhook"

  const body = {
    client_id: clientId,
    user_id: bookingId,
    events: [
      {
        name: "deposit_completed",
        params: removeUndefinedFields({
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
        }),
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
