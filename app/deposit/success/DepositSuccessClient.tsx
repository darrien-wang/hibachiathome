"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, CalendarCheck, Loader2, Lock, MessageSquare } from "lucide-react"
import { phone, smsHref } from "@/config/site"
import { formatUiDate } from "@/lib/date-display"
import { fireGoogleAdsDepositConversion, trackDepositCompletedOnce } from "@/lib/tracking"
import { writeDepositMarker } from "@/lib/deposit-marker"

type DepositVerifyStatus = "pending" | "paid" | "refunded" | "not_found" | "invalid_request"

type DepositVerifyResponse = {
  success: boolean
  paid: boolean
  session_id: string | null
  status: DepositVerifyStatus
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
  planner_url?: string
  error?: string
}

type DepositSuccessClientProps = {
  sessionId: string | null
  initialBookingId: string | null
  initialEmail: string | null
  initialPhone: string | null
  initialSource: string | null
  initialCustomerName: string | null
  initialEventDate: string | null
  initialEventTime: string | null
  initialLocation: string | null
  initialAdults: string | null
  initialKids: string | null
  initialLeadId: string | null
}

type VerifyState =
  | { stage: "idle" | "loading" }
  | { stage: "resolved"; payload: DepositVerifyResponse }
  | { stage: "failed"; message: string }

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/** "18:00" -> "6:00 PM"; anything else passes through. */
function formatClock(value: string | null | undefined): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec((value ?? "").trim())
  if (!match) return value && value.toUpperCase() !== "TBD" ? value : null
  const hour24 = Number(match[1])
  if (!Number.isFinite(hour24) || hour24 > 23) return value as string
  const suffix = hour24 >= 12 ? "PM" : "AM"
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return `${hour12}:${match[2]} ${suffix}`
}

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const RH_BOOKING_NUMBER_PATTERN = /^RH-\d{8}-\d{4}$/i

function normalizeRhBookingNumber(value: string | null | undefined): string | null {
  const normalized = normalizeText(value)?.toUpperCase() ?? null
  if (!normalized) {
    return null
  }

  return RH_BOOKING_NUMBER_PATTERN.test(normalized) ? normalized : null
}

function normalizePrefillEmail(value: string | null | undefined): string | null {
  const normalized = normalizeText(value)?.toLowerCase() ?? null
  if (!normalized || normalized === "unknown@example.com" || normalized === "n/a") {
    return null
  }
  return normalized
}

function normalizePrefillPhone(value: string | null | undefined): string | null {
  const normalized = normalizeText(value)
  if (!normalized) {
    return null
  }

  const lowered = normalized.toLowerCase()
  if (lowered === "tbd" || lowered === "n/a" || lowered === "na" || lowered === "unknown") {
    return null
  }
  return normalized
}

function normalizeCount(value: string | number | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value))
  }
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.trunc(parsed))
    }
  }
  return null
}

// Customers go to the /order party planner; staff tools keep using the
// invoice root, so the path is appended here rather than in the env value.
function withOrderPath(baseUrl: string | undefined): string | undefined {
  const value = normalizeText(baseUrl)
  if (!value) return undefined
  try {
    const url = new URL(value)
    if (!url.pathname.includes("/order")) {
      url.pathname = `${url.pathname.replace(/\/$/, "")}/order`
    }
    return url.toString()
  } catch {
    return value
  }
}

function buildInvoiceSelfServiceHref(params: {
  baseUrl: string | undefined
  bookingId: string | null
  email: string | null
  phone: string | null
  source: string | null
  customerName: string | null
  eventDate: string | null
  eventTime: string | null
  location: string | null
  adults: number | null
  kids: number | null
}): string | null {
  const baseUrl = normalizeText(params.baseUrl)
  const bookingId = normalizeText(params.bookingId)
  const email = normalizePrefillEmail(params.email)
  const phone = normalizePrefillPhone(params.phone)
  const source = normalizeText(params.source)
  const customerName = normalizeText(params.customerName)
  const eventDate = normalizeText(params.eventDate)
  const eventTime = normalizeText(params.eventTime)
  const location = normalizeText(params.location)

  if (!baseUrl || (!bookingId && !email && !phone && !customerName && !eventDate && !eventTime && !location)) {
    return null
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
    if (source) {
      url.searchParams.set("source", source)
    }
    if (customerName) {
      url.searchParams.set("customer_name", customerName)
    }
    if (eventDate) {
      url.searchParams.set("event_date", eventDate)
    }
    if (eventTime) {
      url.searchParams.set("event_time", eventTime)
    }
    if (location) {
      url.searchParams.set("location", location)
    }
    if (typeof params.adults === "number") {
      url.searchParams.set("adults", String(params.adults))
    }
    if (typeof params.kids === "number") {
      url.searchParams.set("kids", String(params.kids))
    }
    url.searchParams.set("surface", "deposit_success")
    return url.toString()
  } catch {
    return null
  }
}

export default function DepositSuccessClient({
  sessionId,
  initialBookingId,
  initialEmail,
  initialPhone,
  initialSource,
  initialCustomerName,
  initialEventDate,
  initialEventTime,
  initialLocation,
  initialAdults,
  initialKids,
  initialLeadId,
}: DepositSuccessClientProps) {
  const [state, setState] = useState<VerifyState>({ stage: "idle" })

  const canVerify = useMemo(() => typeof sessionId === "string" && sessionId.length > 0, [sessionId])
  const normalizedInitialBookingId = useMemo(() => normalizeRhBookingNumber(initialBookingId), [initialBookingId])
  const resolvedBookingId =
    state.stage === "resolved" ? normalizeRhBookingNumber(state.payload.booking_id) : null
  const displayBookingId = resolvedBookingId ?? normalizedInitialBookingId
  const resolvedEmail = state.stage === "resolved" ? normalizePrefillEmail(state.payload.email) : null
  const resolvedPhone = state.stage === "resolved" ? normalizePrefillPhone(state.payload.phone) : null
  const displayEmail = resolvedEmail ?? normalizePrefillEmail(initialEmail)
  const displayPhone = resolvedPhone ?? normalizePrefillPhone(initialPhone)
  const resolvedCustomerName = state.stage === "resolved" ? normalizeText(state.payload.customer_name) : null
  const resolvedEventDate = state.stage === "resolved" ? normalizeText(state.payload.event_date) : null
  const resolvedEventTime = state.stage === "resolved" ? normalizeText(state.payload.event_time) : null
  const resolvedLocation = state.stage === "resolved" ? normalizeText(state.payload.location) : null
  const resolvedAdults = state.stage === "resolved" ? normalizeCount(state.payload.adults) : null
  const resolvedKids = state.stage === "resolved" ? normalizeCount(state.payload.kids) : null
  const displayCustomerName = resolvedCustomerName ?? normalizeText(initialCustomerName)
  const displayEventDate = resolvedEventDate ?? normalizeText(initialEventDate)
  const displayEventTime = resolvedEventTime ?? normalizeText(initialEventTime)
  const displayLocation = resolvedLocation ?? normalizeText(initialLocation)
  const displayAdults = resolvedAdults ?? normalizeCount(initialAdults)
  const displayKids = resolvedKids ?? normalizeCount(initialKids)
  const isPaidState = state.stage === "resolved" && state.payload.paid
  // The keyed planner link from verify: party domain, nothing personal in the
  // address, the same link the deposit text carries. The parameter link below
  // is only the fallback when the key could not be minted.
  const plannerUrl = state.stage === "resolved" && state.payload.paid ? normalizeText(state.payload.planner_url) : null
  const invoiceSelfServiceHref = useMemo(
    () =>
      buildInvoiceSelfServiceHref({
        baseUrl: withOrderPath(process.env.NEXT_PUBLIC_INVOICE_SELF_SERVICE_BASE_URL),
        bookingId: displayBookingId,
        email: displayEmail,
        phone: displayPhone,
        source: initialSource,
        customerName: displayCustomerName,
        eventDate: displayEventDate,
        eventTime: displayEventTime,
        location: displayLocation,
        adults: displayAdults,
        kids: displayKids,
      }),
    [
      displayAdults,
      displayBookingId,
      displayCustomerName,
      displayEmail,
      displayEventDate,
      displayEventTime,
      displayKids,
      displayLocation,
      displayPhone,
      initialSource,
    ],
  )

  // Remember on this device that the party is paid, so a restored deposit
  // tab shows "date locked" instead of a live pay button (lib/deposit-marker).
  useEffect(() => {
    if (!isPaidState) return
    writeDepositMarker(
      { leadId: initialLeadId, email: displayEmail, eventDate: displayEventDate },
      {
        orderNo: displayBookingId,
        eventDate: displayEventDate,
        eventTime: displayEventTime,
        manageUrl: plannerUrl ?? invoiceSelfServiceHref ?? null,
        savedAt: Date.now(),
      },
    )
  }, [isPaidState, initialLeadId, displayEmail, displayEventDate, displayEventTime, displayBookingId, invoiceSelfServiceHref, plannerUrl])

  const verify = useCallback(async () => {
    if (!sessionId) {
      setState({
        stage: "failed",
        message: "Missing Stripe checkout session ID. Please contact support if you were charged.",
      })
      return
    }

    setState({ stage: "loading" })

    try {
      const query = new URLSearchParams({ session_id: sessionId })
      if (normalizedInitialBookingId) {
        query.set("booking_id", normalizedInitialBookingId)
      }

      const response = await fetch(`/api/deposit/verify?${query.toString()}`, {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      })

      const payload = (await response.json().catch(() => null)) as DepositVerifyResponse | null
      if (!payload) {
        throw new Error("Invalid verification response.")
      }

      if (!response.ok) {
        throw new Error(payload.error || "Unable to verify payment status right now.")
      }

      setState({ stage: "resolved", payload })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to verify payment status right now. Please try again."
      setState({ stage: "failed", message })
    }
  }, [sessionId, normalizedInitialBookingId])

  useEffect(() => {
    void verify()
  }, [verify])

  useEffect(() => {
    if (state.stage !== "resolved") {
      return
    }

    const result = state.payload
    if (!result.paid || !result.transaction_id) {
      return
    }

    const tracked = trackDepositCompletedOnce({
      transaction_id: result.transaction_id,
      value: typeof result.value === "number" ? result.value : undefined,
      currency: typeof result.currency === "string" ? result.currency : "USD",
      event_id: result.session_id || sessionId || undefined,
      booking_id: displayBookingId ?? undefined,
      checkout_session_id: result.session_id || undefined,
      deposit_status: result.status,
      conversion_surface: "deposit_success",
    })

    if (tracked.tracked) {
      fireGoogleAdsDepositConversion({
        transactionId: result.transaction_id,
        value: typeof result.value === "number" ? result.value : undefined,
        currency: typeof result.currency === "string" ? result.currency : "USD",
        email: displayEmail,
        phone: displayPhone,
      })
    }
  }, [displayBookingId, displayEmail, displayPhone, sessionId, state])

  const adults = normalizeCount(initialAdults)
  const kids = normalizeCount(initialKids)
  const guestsLine =
    adults !== null && adults > 0
      ? kids && kids > 0
        ? `${adults} adults, ${kids} kids`
        : `${adults} guests`
      : null
  const dateLine = initialEventDate ? formatUiDate(initialEventDate, "") : ""
  const clock = formatClock(initialEventTime)
  const partyLine = [dateLine, clock, guestsLine, normalizeText(initialLocation)].filter(Boolean)

  const heading =
    state.stage === "failed"
      ? "We couldn't confirm that"
      : state.stage === "resolved"
        ? state.payload.paid
          ? "Your date is locked"
          : "Almost there"
        : "Locking your date…"

  const content = (() => {
    if (state.stage === "failed") {
      return (
        <div role="alert" className="mt-5 flex items-start gap-2 rounded-2xl bg-flame-100 px-4 py-3 text-left text-sm text-flame-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{state.message}</span>
        </div>
      )
    }

    if (state.stage !== "resolved") {
      return (
        <p className="mt-3 inline-flex items-center gap-2 text-base text-clay-700">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Confirming with Stripe…
        </p>
      )
    }

    const result = state.payload
    if (result.paid) {
      return (
        <>
          <p className="mt-2 text-base text-clay-700">
            Your card is on file with Stripe and nothing was charged today. You pay on the day: cash or Zelle/Venmo to your chef, or the card on file after the party.
          </p>
          <div className="mt-6 rounded-[28px] bg-cream px-5 py-4 text-left text-sm text-ink">
            <p className="font-semibold">What happens next</p>
            <ul className="mt-2 space-y-1.5 text-clay-700">
              <li>We text you to confirm your chef by name.</li>
              <li>Pick proteins and party details whenever you like — the link below works on your phone.</li>
              <li>Two days before the party we text once more to confirm, then your chef shows up and cooks.</li>
            </ul>
            <p className="mt-3 text-xs text-clay-600">Change or cancel free up to 48 hours before; $99 inside 48 hours.</p>
          </div>
          {displayBookingId ? <p className="mt-3 text-[13px] text-clay-600">Booking {displayBookingId}</p> : null}
        </>
      )
    }

    return (
      <>
        <p className="mt-2 text-base text-clay-700">
          We haven&apos;t received Stripe&apos;s confirmation for this session yet. It usually arrives within a few seconds.
        </p>
        <p className="mt-2 text-[13px] text-clay-600">Status: {result.status}</p>
        <button
          type="button"
          onClick={() => void verify()}
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full border-2 border-flame px-6 text-base font-semibold text-flame-700 transition hover:bg-flame/5"
        >
          Check again
        </button>
      </>
    )
  })()

  const manageHref = isPaidState ? plannerUrl ?? invoiceSelfServiceHref ?? null : invoiceSelfServiceHref ?? null

  return (
    <main className="min-h-[70vh] bg-cream px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-[560px] rounded-[32px] bg-surface px-6 pb-7 pt-10 text-center shadow-organic-lg sm:px-9">
        <p className="mb-4 text-[13px] font-semibold uppercase tracking-[0.08em] text-clay-600">Real Hibachi · {phone.sms.dashed}</p>
        <div
          className={`mx-auto mb-[18px] grid h-16 w-16 place-items-center rounded-full ${
            state.stage === "failed" ? "bg-flame-100 text-flame-700" : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {state.stage === "failed" ? (
            <AlertCircle className="h-7 w-7" strokeWidth={2.5} aria-hidden="true" />
          ) : isPaidState ? (
            <CalendarCheck className="h-7 w-7" strokeWidth={2.5} aria-hidden="true" />
          ) : (
            <Lock className="h-7 w-7" strokeWidth={2.5} aria-hidden="true" />
          )}
        </div>
        <h1 className="font-serif text-[28px] font-extrabold leading-[1.1] text-ink sm:text-[34px]">{heading}</h1>

        {partyLine.length > 0 ? (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-[18px] gap-y-2 rounded-[28px] bg-cream px-5 py-4 text-base text-ink">
            {partyLine.map((part, index) => (
              <span key={`${part}-${index}`} className={index === 0 ? "font-semibold" : undefined}>
                {part}
              </span>
            ))}
          </div>
        ) : null}

        {content}

        <div className="mt-[26px] flex flex-col gap-3">
          {manageHref ? (
            <a
              href={manageHref}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-flame px-6 py-3 text-lg font-semibold leading-tight text-white transition hover:bg-flame-600 active:bg-flame-700"
            >
              <CalendarCheck className="h-5 w-5" aria-hidden="true" />
              Plan your party-day details
            </a>
          ) : null}
          <a
            href={smsHref("Hi Real Hibachi! I just locked my date - quick question.")}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-flame px-6 text-base font-semibold text-flame-700 transition hover:bg-flame/5"
          >
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            Text us {phone.sms.dashed}
          </a>
        </div>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[13px] text-clay-600">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          Card saved securely by Stripe · nothing charged today
        </p>
      </div>
    </main>
  )
}
