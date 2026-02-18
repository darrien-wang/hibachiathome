"use client"

type TrackingEventName =
  | "lead_start"
  | "lead_submit"
  | "contact_whatsapp_click"
  | "contact_sms_click"
  | "contact_call_click"
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

type TrackEventParams = AttributionFields & {
  value?: number
  currency?: string
  transaction_id?: string
  event_id?: string
  debug_mode?: boolean
}

type DataLayerPayload = AttributionFields & {
  event: TrackingEventName
  page_path: string
  page_title: string
  value?: number
  currency?: string
  transaction_id?: string
  event_id?: string
  debug_mode?: boolean
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
  const pagePath = window.location.pathname + window.location.search
  const pageTitle = document.title || ""

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

  window.dataLayer = window.dataLayer || []
  window.dataLayer.push(payload)
}
