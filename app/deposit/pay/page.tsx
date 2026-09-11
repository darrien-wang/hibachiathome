"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { AlertCircle, Check, Loader2, Lock, MessageSquare } from "lucide-react"
import { getBookingDetails } from "@/app/actions/booking"
import { getDepositAmount } from "@/config/deposit"
import { phone, smsHref } from "@/config/site"
import { normalizeRhBookingNumber, shouldUseRhBookingNumbers } from "@/lib/booking-number"
import { formatUiDate } from "@/lib/date-display"
import { trackEvent } from "@/lib/tracking"

type BookingPreview = {
  id: string
  full_name?: string
  email?: string
  event_date?: string
  event_time?: string
  location?: string
  guest_adults?: number
  guest_kids?: number
  tent_10x10?: boolean
  estimate_low?: number
  estimate_high?: number
  total_cost?: number
  price_adult?: number
  price_kid?: number
  travel_fee?: number
  premium_proteins?: Array<{ quantity: number; unit_price: number }>
  add_ons?: Array<{ quantity: number; unit_price: number }>
}

function parseNumber(input: string | null): number | undefined {
  if (!input) return undefined
  const parsed = Number(input)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseBoolean(input: string | null): boolean | undefined {
  if (!input) return undefined
  const normalized = input.toLowerCase()
  if (normalized === "true" || normalized === "yes" || normalized === "1") return true
  if (normalized === "false" || normalized === "no" || normalized === "0") return false
  return undefined
}

function formatRange(low: number, high: number): string {
  const l = low.toFixed(0)
  const h = high.toFixed(0)
  return l === h ? `$${l}` : `$${l} - $${h}`
}

/** "21:00" -> "9:00 PM"; anything else (incl. "TBD") passes through. */
function formatClockTime(value: string | undefined): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec((value ?? "").trim())
  if (!match) return value || "Time TBD"
  const hour24 = Number(match[1])
  if (!Number.isFinite(hour24) || hour24 > 23) return value as string
  const suffix = hour24 >= 12 ? "PM" : "AM"
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return `${hour12}:${match[2]} ${suffix}`
}

// Same four reassurances as the /quote confirmation dialog (Claude Design
// "Realhibachi Booking Confirmed Modal"): the questions people ask right
// before they decide whether to put money down.
const CHIPS = ["Pick proteins later", "Headcount stays flexible", "1.5–2 hr show", "Allergies handled free"] as const
const QUESTION_SMS = "Hi Real Hibachi! Quick question about my booking deposit."


function normalizeExternalBookingId(input: string | null): string {
  if (!input) return ""
  const trimmed = input.trim()
  if (!trimmed) return ""
  return normalizeRhBookingNumber(trimmed) ?? trimmed
}

function shouldSuppressLegacyRhId(params: { source: string; rawBookingId: string }): boolean {
  if (!shouldUseRhBookingNumbers(params.source)) {
    return false
  }
  return Boolean(normalizeRhBookingNumber(params.rawBookingId))
}

function calculateTotalAmount(booking: BookingPreview): number {
  if (typeof booking.total_cost === "number") {
    return booking.total_cost
  }

  const adults = booking.guest_adults ?? 0
  const kids = booking.guest_kids ?? 0
  const adultPrice = booking.price_adult ?? 0
  const kidPrice = booking.price_kid ?? 0

  let total = adults * adultPrice + kids * kidPrice

  if (typeof booking.travel_fee === "number") {
    total += booking.travel_fee
  }

  if (Array.isArray(booking.premium_proteins)) {
    for (const item of booking.premium_proteins) {
      total += item.quantity * item.unit_price
    }
  }

  if (Array.isArray(booking.add_ons)) {
    for (const item of booking.add_ons) {
      total += item.quantity * item.unit_price
    }
  }

  return total
}

export default function DepositPaymentPage() {
  return (
    <Suspense fallback={null}>
      <DepositPaymentPageInner />
    </Suspense>
  )
}

function DepositPaymentPageInner() {
  const searchParams = useSearchParams()
  const rawBookingId = searchParams.get("id") || ""
  const source = searchParams.get("source") || ""
  const isPrefillSource = shouldUseRhBookingNumbers(source)
  const suppressLegacyRhId = useMemo(
    () => shouldSuppressLegacyRhId({ source, rawBookingId }),
    [rawBookingId, source],
  )
  const bookingId = useMemo(() => {
    if (suppressLegacyRhId) {
      return ""
    }
    return normalizeExternalBookingId(rawBookingId)
  }, [rawBookingId, suppressLegacyRhId])
  const customerNameParam = searchParams.get("customer_name")?.trim() || ""
  const customerEmailParam = searchParams.get("customer_email")?.trim() || ""
  const leadIdParam = searchParams.get("lead_id")?.trim() || ""
  const eventDateParam = searchParams.get("event_date") || ""
  const eventTimeParam = searchParams.get("event_time") || ""
  const locationParam = searchParams.get("location") || ""
  const adultsParam = parseNumber(searchParams.get("adults"))
  const kidsParam = parseNumber(searchParams.get("kids"))
  const tentParam = parseBoolean(searchParams.get("tent_10x10"))
  const estimateLowParam = parseNumber(searchParams.get("estimate_low"))
  const estimateHighParam = parseNumber(searchParams.get("estimate_high"))

  const contextBooking: BookingPreview = useMemo(
    () => ({
      id: bookingId,
      full_name: customerNameParam || undefined,
      email: customerEmailParam || undefined,
      event_date: eventDateParam || undefined,
      event_time: eventTimeParam || undefined,
      location: locationParam || undefined,
      guest_adults: adultsParam,
      guest_kids: kidsParam,
      tent_10x10: tentParam,
      estimate_low: estimateLowParam,
      estimate_high: estimateHighParam,
    }),
    [
      adultsParam,
      bookingId,
      customerEmailParam,
      customerNameParam,
      estimateHighParam,
      estimateLowParam,
      eventDateParam,
      eventTimeParam,
      kidsParam,
      locationParam,
      tentParam,
    ],
  )

  const [booking, setBooking] = useState<BookingPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkoutStarting, setCheckoutStarting] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  useEffect(() => {
    if (!suppressLegacyRhId) {
      return
    }

    const url = new URL(window.location.href)
    url.searchParams.delete("id")
    url.searchParams.delete("booking_id")
    window.history.replaceState(null, "", `${url.pathname}${url.search}`)
  }, [suppressLegacyRhId])

  useEffect(() => {
    async function fetchBookingDetails() {
      if (!bookingId && !isPrefillSource) {
        setError("Booking number is missing. Please check if your link is complete.")
        setLoading(false)
        return
      }

      if (isPrefillSource) {
        setBooking({
          id: bookingId,
          full_name: contextBooking.full_name || "Guest",
          email: contextBooking.email,
          event_date: contextBooking.event_date || "TBD",
          event_time: contextBooking.event_time || "TBD",
          location: contextBooking.location,
          guest_adults: contextBooking.guest_adults ?? 0,
          guest_kids: contextBooking.guest_kids ?? 0,
          tent_10x10: contextBooking.tent_10x10,
          estimate_low: contextBooking.estimate_low,
          estimate_high: contextBooking.estimate_high,
        })
        setLoading(false)
        return
      }

      try {
        const result = await getBookingDetails(bookingId)
        if (result.success && result.data) {
          setBooking(result.data as BookingPreview)
          setLoading(false)
          return
        }

        // Keep legacy deep-links usable even when booking lookup fails.
        setBooking({
          id: bookingId,
          full_name: contextBooking.full_name || "Guest",
          email: contextBooking.email,
          event_date: contextBooking.event_date || "TBD",
          event_time: contextBooking.event_time || "TBD",
          location: contextBooking.location,
          guest_adults: contextBooking.guest_adults ?? 0,
          guest_kids: contextBooking.guest_kids ?? 0,
          tent_10x10: contextBooking.tent_10x10,
          estimate_low: contextBooking.estimate_low,
          estimate_high: contextBooking.estimate_high,
        })
      } catch (fetchError) {
        console.error(fetchError)
        setError("Unable to load booking details. Please contact us and we can help complete your deposit.")
      } finally {
        setLoading(false)
      }
    }

    fetchBookingDetails()
  }, [bookingId, contextBooking, isPrefillSource])

  const totalAmount = useMemo(() => (booking ? calculateTotalAmount(booking) : 0), [booking])
  const hasBookingEstimateRange =
    booking &&
    typeof booking.estimate_low === "number" &&
    typeof booking.estimate_high === "number" &&
    booking.estimate_low > 0 &&
    booking.estimate_high >= booking.estimate_low

  const depositAmount = getDepositAmount(hasBookingEstimateRange ? booking?.estimate_high : totalAmount)
  const totalEstimateText = hasBookingEstimateRange
    ? formatRange(Number(booking?.estimate_low), Number(booking?.estimate_high))
    : `$${totalAmount.toFixed(2)}`

  const handleDepositCtaClick = async () => {
    if (!booking) return

    trackEvent("deposit_started", {
      booking_id: booking.id,
      value: depositAmount,
      currency: "USD",
      deposit_source: source || "deposit_pay",
    })

    if ((window as any).__REALHIBACHI_DISABLE_NAVIGATION__) {
      return
    }

    setCheckoutStarting(true)
    setCheckoutError(null)

    try {
      const response = await fetch("/api/deposit/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookingId: booking.id,
          leadId: leadIdParam || undefined,
          source: source || "deposit_pay",
          customerName: booking.full_name,
          customerEmail: booking.email,
          eventDate: booking.event_date,
          eventTime: booking.event_time,
          location: booking.location,
          adults: booking.guest_adults,
          kids: booking.guest_kids,
          tent10x10: booking.tent_10x10,
          estimateLow: booking.estimate_low,
          estimateHigh: booking.estimate_high,
          totalAmount,
          depositAmount,
          currency: "USD",
        }),
      })

      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean
        checkoutUrl?: string
        error?: string
        opsNotification?: {
          attempted?: boolean
          delivered?: boolean
          skippedReason?: string
          error?: string
        }
      }

      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.error || "Unable to start secure checkout. Please try again.")
      }

      if (payload.opsNotification && !payload.opsNotification.delivered) {
        console.warn("[deposit/pay] Support notification not confirmed during checkout start.", payload.opsNotification)
      }

      window.location.href = payload.checkoutUrl
    } catch (checkoutStartError) {
      console.error(checkoutStartError)
      setCheckoutError(
        checkoutStartError instanceof Error
          ? checkoutStartError.message
          : "Unable to start secure checkout. Please contact us if this keeps happening.",
      )
      setCheckoutStarting(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-[70vh] bg-cream px-4 py-10 sm:py-16">
        <div className="mx-auto w-full max-w-[560px] animate-pulse rounded-[32px] bg-surface p-9 shadow-organic-lg" aria-busy="true">
          <div className="mx-auto h-16 w-16 rounded-full bg-cream" />
          <div className="mx-auto mt-5 h-8 w-2/3 rounded-full bg-cream" />
          <div className="mx-auto mt-3 h-4 w-3/4 rounded-full bg-cream" />
          <div className="mt-7 h-14 rounded-[28px] bg-cream" />
          <div className="mt-6 h-14 rounded-full bg-cream" />
        </div>
      </main>
    )
  }

  if (error || !booking) {
    return (
      <main className="min-h-[70vh] bg-cream px-4 py-10 sm:py-16">
        <div className="mx-auto w-full max-w-[560px] rounded-[32px] bg-surface px-6 py-10 text-center shadow-organic-lg sm:px-9">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-flame-100 text-flame-700">
            <AlertCircle className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="font-serif text-[28px] font-extrabold leading-tight text-ink">We couldn&apos;t open this booking</h1>
          <p className="mt-2 text-base text-clay-700">{error || "Unable to load booking details."}</p>
          <a
            href={smsHref("Hi Real Hibachi! My deposit link isn't working - can you help?")}
            className="mt-6 flex h-14 items-center justify-center gap-2 rounded-full bg-flame text-lg font-semibold text-white transition hover:bg-flame-600"
          >
            <MessageSquare className="h-5 w-5" aria-hidden="true" />
            Text us at {phone.sms.dashed}
          </a>
          <Link href="/contact" className="mt-4 inline-block text-sm text-clay-700 underline underline-offset-[3px] hover:text-ink">
            Or use the contact form
          </Link>
        </div>
      </main>
    )
  }

  const dateLine = `${formatUiDate(booking.event_date, "Date TBD")} · ${formatClockTime(booking.event_time)}`
  const guestsLine =
    (booking.guest_kids ?? 0) > 0
      ? `${booking.guest_adults ?? 0} adults, ${booking.guest_kids} kids`
      : `${booking.guest_adults ?? 0} guests`
  const depositLabel = `$${depositAmount.toFixed(2)}`

  return (
    <main className="min-h-[70vh] bg-cream px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-[560px] rounded-[32px] bg-surface px-6 pb-7 pt-10 text-center shadow-organic-lg sm:px-9">
        <div className="mx-auto mb-[18px] grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-700">
          <Lock className="h-7 w-7" strokeWidth={2.5} aria-hidden="true" />
        </div>
        <h1 className="font-serif text-[28px] font-extrabold leading-[1.1] text-ink sm:text-[34px]">Lock your date</h1>
        <p className="mt-2 text-base text-clay-700">
          A {depositLabel} deposit holds your chef. It comes off your final balance.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-[18px] gap-y-2 rounded-[28px] bg-cream px-5 py-4 text-base text-ink">
          <span className="font-semibold">{dateLine}</span>
          {booking.location ? (
            <>
              <span className="text-clay-600" aria-hidden="true">·</span>
              <span>{booking.location}</span>
            </>
          ) : null}
          <span className="text-clay-600" aria-hidden="true">·</span>
          <span>{guestsLine}</span>
          <span className="text-clay-600" aria-hidden="true">·</span>
          <span className="font-serif text-xl font-extrabold text-flame-700">{totalEstimateText}</span>
        </div>
        {booking.full_name || booking.id ? (
          <p className="mt-2 text-[13px] text-clay-600">
            {booking.full_name && booking.full_name !== "Guest" ? booking.full_name : null}
            {booking.full_name && booking.full_name !== "Guest" && booking.id ? " · " : null}
            {booking.id ? `Booking ${booking.id}` : null}
          </p>
        ) : null}

        <div className="mt-[22px] flex flex-wrap justify-center gap-2">
          {CHIPS.map((chip) => (
            <span
              key={chip}
              className="inline-flex items-center gap-1.5 rounded-full bg-flame-100 px-3.5 py-[7px] text-sm font-medium text-flame-800"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2.75} aria-hidden="true" />
              {chip}
            </span>
          ))}
        </div>

        <button
          type="button"
          onClick={handleDepositCtaClick}
          disabled={checkoutStarting}
          className="mt-[26px] flex h-14 w-full items-center justify-center gap-2 rounded-full bg-flame text-lg font-semibold text-white transition hover:bg-flame-600 active:bg-flame-700 disabled:cursor-wait disabled:opacity-80"
        >
          {checkoutStarting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Opening secure checkout…
            </>
          ) : (
            `Pay ${depositLabel} deposit · lock the date`
          )}
        </button>
        <p className="mt-3 text-sm text-clay-700">
          Fully refundable up to 72h before.{" "}
          <a href={smsHref(QUESTION_SMS)} className="font-semibold text-flame-700 underline-offset-[3px] hover:underline">
            Questions? Text {phone.sms.dashed}
          </a>
        </p>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-[13px] text-clay-600">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          Secure checkout by Stripe
        </p>

        {checkoutError ? (
          <div role="alert" className="mt-5 flex items-start gap-2 rounded-2xl bg-flame-100 px-4 py-3 text-left text-sm text-flame-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{checkoutError}</span>
          </div>
        ) : null}

        <details className="mt-7 text-left text-[13px] leading-5 text-clay-700">
          <summary className="cursor-pointer text-center font-medium text-clay-700 hover:text-ink">
            By paying you agree to our terms and cancellation policy — read the fine print
          </summary>
          <div className="mt-3 space-y-2 rounded-2xl bg-cream p-4">
            <p>
              <span className="font-semibold text-ink">Cancellation:</span> tell us at least 72 hours before your event to
              cancel or reschedule for a full deposit refund. Changes inside 72 hours may make the deposit non-refundable.
            </p>
            <p>
              <span className="font-semibold text-ink">Weather:</span> cooking is outdoors. If rain is in the forecast we
              recommend a 10&apos;x10&apos; pop-up tent over the chef&apos;s station — we do not supply tents. Weather
              cancellations with 72+ hours notice are refunded in full.
            </p>
            <p>
              <span className="font-semibold text-ink">Liability:</span> Real Hibachi, Inc. is not liable for property
              damage during events; the host waives claims against Real Hibachi for loss, damage or destruction of
              property.
            </p>
            <p>
              <span className="font-semibold text-ink">Texts:</span> by proceeding you agree to receive text messages
              about your booking. Reply STOP to opt out.
            </p>
          </div>
        </details>
      </div>
    </main>
  )
}
