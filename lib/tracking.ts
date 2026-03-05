"use client"

type TrackingEventName =
  | "page_view"
  | "quote_started"
  | "quote_completed"
  | "ab_test_exposure"
  | "ab_test_conversion"
  | "booking_funnel_start"
  | "booking_submit"
  | "location_selected"
  | "package_selected"
  | "promotion_click"
  | "social_video_engagement"
  | "phone_click"
  | "sms_click"
  | "estimate_completed"
  | "lead_start"
  | "lead_submit"
  | "contact_whatsapp_click"
  | "contact_sms_click"
  | "contact_call_click"
  | "contact_email_click"
  | "menu_view"
  | "faq_view"
  | "deposit_started"
  | "deposit_completed"

type AttributionFields = {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  gclid?: string
  wbraid?: string
  gbraid?: string
}

type TrackingParamValue = string | number | boolean

type TrackEventParams = AttributionFields & {
  value?: number
  currency?: string
  transaction_id?: string
  event_id?: string
  debug_mode?: boolean
} & Record<string, TrackingParamValue | undefined>

type DataLayerPayload = AttributionFields & {
  event: TrackingEventName
  page_path: string
  page_title: string
  value?: number
  currency?: string
  transaction_id?: string
  event_id?: string
  debug_mode?: boolean
} & Record<string, TrackingParamValue | undefined>

type DepositCompletedTrackResult = {
  tracked: boolean
  reason?: "invalid_transaction_id" | "duplicate_transaction_id"
}

const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "wbraid",
  "gbraid",
] as const

const COOKIE_NAME = "realhibachi_attribution"
const COOKIE_TTL_DAYS = 90
const DEPOSIT_COMPLETED_DEDUPE_KEY = "realhibachi_deposit_completed_tx_ids"
const MAX_DEPOSIT_COMPLETED_DEDUPE_IDS = 200
const depositCompletedInMemorySet = new Set<string>()

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[]
  }
}

function parseCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const entries = document.cookie.split(";").map((item) => item.trim())
  for (const entry of entries) {
    if (entry.startsWith(`${name}=`)) {
      return decodeURIComponent(entry.slice(name.length + 1))
    }
  }
  return null
}

function writeCookie(name: string, value: string, ttlDays: number): void {
  if (typeof document === "undefined") return
  const expires = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000)
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`
}

function safeParseAttribution(raw: string | null): AttributionFields {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, string>
    const result: AttributionFields = {}
    for (const key of ATTRIBUTION_KEYS) {
      const value = parsed[key]
      if (typeof value === "string" && value.length > 0) {
        result[key] = value
      }
    }
    return result
  } catch {
    return {}
  }
}

function readStoredAttribution(): AttributionFields {
  if (typeof window === "undefined") return {}
  const cookieValue = parseCookie(COOKIE_NAME)
  const fromCookie = safeParseAttribution(cookieValue)
  if (Object.keys(fromCookie).length > 0) {
    return fromCookie
  }
  try {
    const fromLocalStorage = window.localStorage.getItem(COOKIE_NAME)
    return safeParseAttribution(fromLocalStorage)
  } catch {
    return {}
  }
}

function normalizePagePath(pathname: string | undefined): string {
  if (!pathname) return "/"
  return pathname.startsWith("/") ? pathname : `/${pathname}`
}

function resolvePageTitle(title: string | undefined): string {
  const normalizedTitle = title?.trim() ?? ""
  return normalizedTitle.length > 0 ? normalizedTitle : "Real Hibachi"
}

function removeUndefinedFields<T extends Record<string, unknown>>(input: T): T {
  const entries = Object.entries(input).filter(([, value]) => value !== undefined)
  return Object.fromEntries(entries) as T
}

function normalizeTransactionId(value: string): string {
  return value.trim()
}

function readTrackedDepositTransactionIds(): string[] {
  if (typeof window === "undefined") return []

  try {
    const raw = window.localStorage.getItem(DEPOSIT_COMPLETED_DEDUPE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, MAX_DEPOSIT_COMPLETED_DEDUPE_IDS)
  } catch {
    return []
  }
}

function writeTrackedDepositTransactionIds(transactionIds: string[]): void {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(DEPOSIT_COMPLETED_DEDUPE_KEY, JSON.stringify(transactionIds))
  } catch {
    // Ignore localStorage write failures in private/incognito modes.
  }
}

function hasTrackedDepositTransaction(transactionId: string): boolean {
  if (depositCompletedInMemorySet.has(transactionId)) {
    return true
  }

  const fromStorage = readTrackedDepositTransactionIds()
  if (!fromStorage.includes(transactionId)) {
    return false
  }

  for (const id of fromStorage) {
    depositCompletedInMemorySet.add(id)
  }
  return true
}

function rememberTrackedDepositTransaction(transactionId: string): void {
  depositCompletedInMemorySet.add(transactionId)

  const fromStorage = readTrackedDepositTransactionIds()
  const merged = [transactionId, ...fromStorage.filter((id) => id !== transactionId)].slice(0, MAX_DEPOSIT_COMPLETED_DEDUPE_IDS)
  writeTrackedDepositTransactionIds(merged)
}

export function captureAttributionOnLanding(search: string): void {
  if (typeof window === "undefined") return

  const query = new URLSearchParams(search)
  const existing = readStoredAttribution()
  const merged: AttributionFields = { ...existing }

  for (const key of ATTRIBUTION_KEYS) {
    const value = query.get(key)
    if (!merged[key] && value) {
      merged[key] = value
    }
  }

  if (Object.keys(merged).length === 0) return

  const serialized = JSON.stringify(merged)
  writeCookie(COOKIE_NAME, serialized, COOKIE_TTL_DAYS)
  try {
    window.localStorage.setItem(COOKIE_NAME, serialized)
  } catch {
    // Ignore localStorage write failures in private/incognito modes.
  }
}

export function trackEvent(name: TrackingEventName, params: TrackEventParams = {}): void {
  if (typeof window === "undefined") return

  const storedAttribution = readStoredAttribution()
  const pagePath = normalizePagePath(window.location.pathname)
  const pageTitle = resolvePageTitle(document.title)

  const payload: DataLayerPayload = {
    event: name,
    page_path: pagePath,
    page_title: pageTitle,
    ...storedAttribution,
    ...params,
  }

  if (payload.value !== undefined && !payload.currency) {
    payload.currency = "USD"
  }

  if (name === "deposit_completed" && !payload.transaction_id) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("trackEvent(deposit_completed) requires transaction_id")
    }
    return
  }

  if (process.env.NEXT_PUBLIC_TRACKING_DEBUG === "true" && payload.debug_mode === undefined) {
    payload.debug_mode = true
  }

  const normalizedPayload = removeUndefinedFields(payload)

  if (!Array.isArray(window.dataLayer)) {
    window.dataLayer = []
  }

  window.dataLayer.push(normalizedPayload)
}

export function trackDepositCompletedOnce(
  params: TrackEventParams & { transaction_id: string },
): DepositCompletedTrackResult {
  if (typeof window === "undefined") {
    return { tracked: false, reason: "invalid_transaction_id" }
  }

  const transactionId = normalizeTransactionId(params.transaction_id)
  if (!transactionId) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("trackDepositCompletedOnce requires transaction_id")
    }
    return { tracked: false, reason: "invalid_transaction_id" }
  }

  if (hasTrackedDepositTransaction(transactionId)) {
    return { tracked: false, reason: "duplicate_transaction_id" }
  }

  trackEvent("deposit_completed", {
    ...params,
    transaction_id: transactionId,
  })

  rememberTrackedDepositTransaction(transactionId)
  return { tracked: true }
}
