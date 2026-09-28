"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { AlertCircle, CalendarCheck, Check, Loader2, Lock, MessageSquare } from "lucide-react"
import { getBookingDetails } from "@/app/actions/booking"
import { getDepositAmount } from "@/config/deposit"
import { calcSimpleEstimate, checkWeekdayEligibility, partySizeDiscountLabel } from "@/config/pricing-rules"
import { phone, smsHref } from "@/config/site"
import { normalizeRhBookingNumber, shouldUseRhBookingNumbers } from "@/lib/booking-number"
import { formatUiDate } from "@/lib/date-display"
import { trackEvent } from "@/lib/tracking"
import { readDepositMarker, writeDepositMarker, type DepositMarker } from "@/lib/deposit-marker"

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

// A texted quote's location is often the page's default region, not a place.
const isPlaceholderLocation = (value: string) => {
  const v = value.trim()
  return !v || /^(southern california|socal|tbd|california)$/i.test(v)
}
const TIME_OPTIONS: ReadonlyArray<readonly [string, string]> = [
  ["", "Pick a start time"],
  ["17:00", "5:00 PM"],
  ["17:30", "5:30 PM"],
  ["18:00", "6:00 PM"],
  ["18:30", "6:30 PM"],
  ["19:00", "7:00 PM"],
  ["19:30", "7:30 PM"],
  ["20:00", "8:00 PM"],
  ["TBD", "Not sure yet"],
]
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
/** Tomorrow on the Pacific clock, the earliest date a deposit can lock. */
function tomorrowPT(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date(Date.now() + 86_400_000))
}


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
  // "Booking another party" door: the host said this is a second party, so
  // the already-paid check is skipped here and on the server.
  const anotherParam = searchParams.get("another") === "1"
  // Negotiated total, signed by staff; the server re-verifies it.
  const agreedTotalParam = searchParams.get("agreed_total")?.trim() || ""
  const agreedSigParam = searchParams.get("agreed_sig")?.trim() || ""
  const eventDateParam = searchParams.get("event_date") || ""
  const eventTimeParam = searchParams.get("event_time") || ""
  const locationParam = searchParams.get("location") || ""
  const adultsParam = parseNumber(searchParams.get("adults"))
  const kidsParam = parseNumber(searchParams.get("kids"))
  const tentParam = parseBoolean(searchParams.get("tent_10x10"))
  const estimateLowParam = parseNumber(searchParams.get("estimate_low"))
  const estimateHighParam = parseNumber(searchParams.get("estimate_high"))

  // ---- Details the link did not carry (2026-09-27) --------------------------
  // A texted quote often has no date ("Date TBD"), a placeholder city, or a
  // headcount the customer has since changed, and this page could not take
  // any of it. Esme paid while asking on the phone whether $19.90 with
  // "Date TBD" would hold *her* date; the server then filed the party under
  // today's date, which put a Mon-Thu discount on a Friday party. Prefilled
  // links now ask for what is missing, right above the button. Agreed-total
  // links stay read-only: the signed price belongs to the party as quoted.
  const detailsEditable = isPrefillSource && !agreedTotalParam
  // The lead's newest texted quote, when it differs from this link (a
  // customer who asked twice holds two links with two prices - Esme had a
  // 15-guest one and a 14-guest one and asked which was "real"). Whichever
  // link she opens, the page starts from what she told us last.
  const [latest, setLatest] = useState<{ adults: number; kids: number; location: string; date: string; total: number } | null>(null)
  const base = useMemo(
    () => ({
      adults: latest?.adults ?? adultsParam ?? 0,
      kids: latest?.kids ?? kidsParam ?? 0,
      date: latest?.date || eventDateParam,
      location: latest?.location || locationParam,
      estimate: latest?.total ?? estimateHighParam,
    }),
    [latest, adultsParam, kidsParam, eventDateParam, locationParam, estimateHighParam],
  )
  const needsDate = detailsEditable && !ISO_DATE.test(base.date)
  const needsTime = detailsEditable && !eventTimeParam
  const needsLocation = detailsEditable && isPlaceholderLocation(base.location)
  const [dateInput, setDateInput] = useState("")
  const [timeInput, setTimeInput] = useState("")
  const [locationInput, setLocationInput] = useState("")
  const [adultsInput, setAdultsInput] = useState<number>(adultsParam ?? 0)
  const [kidsInput, setKidsInput] = useState<number>(kidsParam ?? 0)
  const effectiveDate = needsDate ? dateInput : base.date
  const effectiveTime = needsTime ? timeInput : eventTimeParam
  const effectiveLocation = needsLocation ? locationInput.trim() : base.location
  const guestsChanged = detailsEditable && (adultsInput !== base.adults || kidsInput !== base.kids)
  const dateChanged = needsDate && ISO_DATE.test(dateInput)
  const detailsMissing =
    (needsDate && !ISO_DATE.test(dateInput)) || (needsTime && !timeInput) || (needsLocation && !locationInput.trim())
  // Re-price with the engine the quote used, so the number moves the way the
  // text explained it. The link's estimate may include travel; that part is
  // recovered by pricing the link's own party and taking the difference, so a
  // headcount or date change moves only the food and the tier discount.
  // (A dateless link priced at the Mon-Thu rate cannot be told apart from a
  // standard one, so its travel part reads as zero; the page still says travel
  // is confirmed from the address.)
  const repriced = useMemo(() => {
    if (!detailsEditable || (!guestsChanged && !dateChanged)) return null
    if (typeof base.estimate !== "number" || base.estimate <= 0) return null
    const baseWeekday = ISO_DATE.test(base.date)
      ? checkWeekdayEligibility(base.date, { adult: base.adults, child: base.kids, toddler: 0 }).isEligible
      : false
    const baseFood = calcSimpleEstimate({ adults: base.adults, kids: base.kids, weekdaySpecial: baseWeekday, travelFee: 0 }).total
    // The link carries a rounded estimate ($838.50 travels as 839); under
    // $1.50 of difference is that rounding, not a travel fee.
    const rawTravel = base.estimate - baseFood
    const travelPart = rawTravel >= 1.5 ? Math.round(rawTravel) : 0
    const weekday = ISO_DATE.test(effectiveDate)
      ? checkWeekdayEligibility(effectiveDate, { adult: adultsInput, child: kidsInput, toddler: 0 }).isEligible
      : baseWeekday
    const est = calcSimpleEstimate({ adults: adultsInput, kids: kidsInput, weekdaySpecial: weekday, travelFee: travelPart })
    return { total: est.total, weekday, travelPart }
  }, [detailsEditable, guestsChanged, dateChanged, base, effectiveDate, adultsInput, kidsInput])
  const tierLabel = detailsEditable ? partySizeDiscountLabel({ adults: adultsInput, kids: kidsInput }) : null
  // The estimate shown and sent: the newest quote's own number until the
  // customer changes something here, then the engine's.
  const shownEstimate = repriced ? Math.round(repriced.total) : latest ? Math.round(latest.total) : null

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

  // Already paid? Three layers: what this device remembers (instant), what
  // the server knows (durable), and the server's refusal when paying (last).
  // Fail open: a slow or failed check must not hide the pay button, the
  // server refusal still stands behind it.
  const [lock, setLock] = useState<{ status: "checking" | "clear" | "locked"; info?: DepositMarker }>({ status: "checking" })
  const [lockTimedOut, setLockTimedOut] = useState(false)
  const anotherHref = useMemo(() => {
    const q = new URLSearchParams(searchParams.toString())
    q.set("another", "1")
    return `/deposit/pay?${q.toString()}`
  }, [searchParams])

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

  useEffect(() => {
    const t = window.setTimeout(() => setLockTimedOut(true), 1500)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    if (anotherParam) {
      setLock({ status: "clear" })
      return
    }
    const identity = { leadId: leadIdParam, email: customerEmailParam, eventDate: eventDateParam }
    let cancelled = false
    const check = async () => {
      const marker = readDepositMarker(identity)
      if (marker) setLock({ status: "locked", info: marker })
      const canAsk = Boolean(leadIdParam) || Boolean(customerEmailParam && eventDateParam)
      if (!canAsk) {
        if (!marker) setLock({ status: "clear" })
        return
      }
      try {
        const q = new URLSearchParams()
        if (leadIdParam) q.set("lead_id", leadIdParam)
        if (customerEmailParam) q.set("email", customerEmailParam)
        if (eventDateParam) q.set("event_date", eventDateParam)
        const res = await fetch(`/api/deposit/status?${q.toString()}`, { cache: "no-store" })
        const data = (await res.json().catch(() => null)) as
          | {
              locked?: boolean
              order_no?: string
              event_date?: string
              event_time?: string
              manage_url?: string
              latest_quote?: { adults: number; kids: number; location: string; date: string; total: number }
            }
          | null
        if (cancelled) return
        // A texted-quote link opens on the lead's newest quote when that
        // differs from the link itself (two links, two headcounts).
        const lq = data?.latest_quote
        if (lq && source === "quote" && typeof lq.total === "number") {
          const differs =
            lq.adults !== (adultsParam ?? 0) ||
            lq.kids !== (kidsParam ?? 0) ||
            (Boolean(lq.location) && lq.location !== locationParam) ||
            (Boolean(lq.date) && lq.date !== eventDateParam) ||
            Math.round(lq.total) !== Math.round(estimateHighParam ?? 0)
          if (differs) {
            setLatest(lq)
            setAdultsInput(lq.adults)
            setKidsInput(lq.kids)
          }
        }
        if (data?.locked) {
          const info: DepositMarker = {
            orderNo: data.order_no ?? marker?.orderNo ?? null,
            eventDate: data.event_date ?? marker?.eventDate ?? null,
            eventTime: data.event_time ?? marker?.eventTime ?? null,
            manageUrl: data.manage_url ?? marker?.manageUrl ?? null,
            savedAt: Date.now(),
          }
          setLock({ status: "locked", info })
          writeDepositMarker(identity, info)
        } else if (!marker) {
          setLock({ status: "clear" })
        }
      } catch {
        if (!cancelled && !marker) setLock({ status: "clear" })
      }
    }
    void check()
    // Safari restores this tab from its cache without reloading; ask again
    // whenever the page comes back into view.
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) void check()
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") void check()
    }
    window.addEventListener("pageshow", onShow)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      cancelled = true
      window.removeEventListener("pageshow", onShow)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [anotherParam, leadIdParam, customerEmailParam, eventDateParam, source, adultsParam, kidsParam, locationParam, estimateHighParam])

  const totalAmount = useMemo(() => (booking ? calculateTotalAmount(booking) : 0), [booking])
  const hasBookingEstimateRange =
    booking &&
    typeof booking.estimate_low === "number" &&
    typeof booking.estimate_high === "number" &&
    booking.estimate_low > 0 &&
    booking.estimate_high >= booking.estimate_low

  const depositAmount = getDepositAmount(hasBookingEstimateRange ? booking?.estimate_high : totalAmount)
  // An owner-signed agreed total (the "协议总价" link) is what the customer was
  // quoted by text, and it is what the server locks in at payment. Until
  // 2026-09-18 this page still showed the standard rate, so a customer who
  // ticked the tables she had already been quoted for saw her price jump
  // $50 above the number she agreed to and stopped to ask. Show the agreed
  // figure here; the signature is verified server-side when she pays.
  const agreedTotal = useMemo(() => {
    const n = Number(agreedTotalParam)
    return agreedSigParam && Number.isFinite(n) && n > 0 ? n : null
  }, [agreedTotalParam, agreedSigParam])
  const totalEstimateText = agreedTotal
    ? `$${agreedTotal.toFixed(2)}`
    : hasBookingEstimateRange
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

    if (detailsMissing) {
      setCheckoutError(
        needsDate && !ISO_DATE.test(dateInput)
          ? "Pick your party date first - that is the date the deposit locks."
          : "Fill in the details above first.",
      )
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
          another: anotherParam || undefined,
          agreedTotal: agreedTotalParam || undefined,
          agreedSig: agreedSigParam || undefined,
          source: source || "deposit_pay",
          customerName: booking.full_name,
          customerEmail: booking.email,
          // Prefilled links send what the customer entered here; "TBD" never
          // travels as a date any more (the server refuses a missing date).
          eventDate: detailsEditable ? effectiveDate || undefined : booking.event_date,
          eventTime: detailsEditable ? effectiveTime || undefined : booking.event_time,
          location: detailsEditable ? effectiveLocation || undefined : booking.location,
          adults: detailsEditable ? adultsInput : booking.guest_adults,
          kids: detailsEditable ? kidsInput : booking.guest_kids,
          tent10x10: booking.tent_10x10,
          estimateLow: shownEstimate ?? booking.estimate_low,
          estimateHigh: shownEstimate ?? booking.estimate_high,
          totalAmount,
          depositAmount,
          currency: "USD",
        }),
      })

      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean
        checkoutUrl?: string
        error?: string
        locked?: boolean
        order_no?: string
        event_date?: string
        event_time?: string
        manage_url?: string
        opsNotification?: {
          attempted?: boolean
          delivered?: boolean
          skippedReason?: string
          error?: string
        }
      }

      if (response.status === 409 && payload.locked) {
        // The server found a paid deposit for this party: show the locked
        // state instead of an error, and remember it on this device.
        const info: DepositMarker = {
          orderNo: payload.order_no ?? null,
          eventDate: payload.event_date ?? null,
          eventTime: payload.event_time ?? null,
          manageUrl: payload.manage_url ?? null,
          savedAt: Date.now(),
        }
        writeDepositMarker({ leadId: leadIdParam, email: customerEmailParam, eventDate: eventDateParam }, info)
        setLock({ status: "locked", info })
        setCheckoutStarting(false)
        return
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

  if (loading || (lock.status === "checking" && !lockTimedOut)) {
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

  if (lock.status === "locked") {
    const info = lock.info
    const lockedDate = formatUiDate(info?.eventDate || booking?.event_date || eventDateParam, "Date on file")
    const lockedTime = formatClockTime(info?.eventTime || booking?.event_time || eventTimeParam || undefined)
    const lockedGuests = booking
      ? (booking.guest_kids ?? 0) > 0
        ? `${booking.guest_adults ?? 0} adults, ${booking.guest_kids} kids`
        : `${booking.guest_adults ?? 0} guests`
      : null
    return (
      <main className="min-h-[70vh] bg-cream px-4 py-10 sm:py-16">
        <div className="mx-auto w-full max-w-[560px] rounded-[32px] bg-surface px-6 pb-7 pt-10 text-center shadow-organic-lg sm:px-9">
          <div className="mx-auto mb-[18px] grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-700">
            <CalendarCheck className="h-7 w-7" strokeWidth={2.5} aria-hidden="true" />
          </div>
          <h1 className="font-serif text-[28px] font-extrabold leading-[1.1] text-ink sm:text-[34px]">Your date is locked</h1>
          <p className="mt-2 text-base text-clay-700">
            A deposit is already on file for this party. Nothing more to pay today.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-[18px] gap-y-2 rounded-[28px] bg-cream px-5 py-4 text-base text-ink">
            <span className="font-semibold">{lockedDate}{lockedTime !== "Time TBD" ? ` · ${lockedTime}` : ""}</span>
            {booking?.location ? (
              <>
                <span className="text-clay-600" aria-hidden="true">·</span>
                <span>{booking.location}</span>
              </>
            ) : null}
            {lockedGuests ? (
              <>
                <span className="text-clay-600" aria-hidden="true">·</span>
                <span>{lockedGuests}</span>
              </>
            ) : null}
          </div>
          {info?.orderNo ? <p className="mt-2 text-[13px] text-clay-600">Booking {info.orderNo}</p> : null}

          {info?.manageUrl ? (
            <a
              href={info.manageUrl}
              className="mt-[26px] flex h-14 w-full items-center justify-center gap-2 rounded-full bg-flame text-lg font-semibold text-white transition hover:bg-flame-600 active:bg-flame-700"
            >
              Manage your party
            </a>
          ) : null}
          <a
            href={smsHref(QUESTION_SMS)}
            className={`${info?.manageUrl ? "mt-3 h-12 bg-cream text-ink hover:bg-flame-100" : "mt-[26px] h-14 bg-flame text-white hover:bg-flame-600"} flex w-full items-center justify-center gap-2 rounded-full text-base font-semibold transition`}
          >
            <MessageSquare className="h-5 w-5" aria-hidden="true" />
            Questions? Text {phone.sms.dashed}
          </a>
          <p className="mt-5 text-[13px] text-clay-600">
            Booking a second party?{" "}
            <Link href={anotherHref} className="font-semibold text-flame-700 underline-offset-[3px] hover:underline">
              Start a new deposit
            </Link>
          </p>
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

  const shownDate = detailsEditable ? effectiveDate : booking.event_date
  const shownTime = detailsEditable ? effectiveTime : booking.event_time
  const shownLocation = detailsEditable ? effectiveLocation : booking.location
  const shownAdults = detailsEditable ? adultsInput : booking.guest_adults ?? 0
  const shownKids = detailsEditable ? kidsInput : booking.guest_kids ?? 0
  const dateLine = `${formatUiDate(shownDate || undefined, "Date TBD")} · ${formatClockTime(shownTime || undefined)}`
  const guestsLine = shownKids > 0 ? `${shownAdults} adults, ${shownKids} kids` : `${shownAdults} guests`
  const step = (setter: (n: number) => void, value: number, delta: number, min: number) => () => setter(Math.max(min, value + delta))
  const depositLabel = `$${depositAmount.toFixed(2)}`

  return (
    <main className="min-h-[70vh] bg-cream px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-[560px] rounded-[32px] bg-surface px-6 pb-7 pt-10 text-center shadow-organic-lg sm:px-9">
        {/* Who this page belongs to: the first thing Esme asked on the phone was "is this the real Hibachi site?" */}
        <p className="mb-4 text-[13px] font-semibold uppercase tracking-[0.08em] text-clay-600">Real Hibachi · {phone.sms.dashed}</p>
        <div className="mx-auto mb-[18px] grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-700">
          <Lock className="h-7 w-7" strokeWidth={2.5} aria-hidden="true" />
        </div>
        <h1 className="font-serif text-[28px] font-extrabold leading-[1.1] text-ink sm:text-[34px]">Lock your date</h1>
        <p className="mt-2 text-base text-clay-700">
          A {depositLabel} deposit holds your chef. It comes off your final balance.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-[18px] gap-y-2 rounded-[28px] bg-cream px-5 py-4 text-base text-ink">
          <span className="font-semibold">{dateLine}</span>
          {shownLocation ? (
            <>
              <span className="text-clay-600" aria-hidden="true">·</span>
              <span>{shownLocation}</span>
            </>
          ) : null}
          <span className="text-clay-600" aria-hidden="true">·</span>
          <span>{guestsLine}</span>
          <span className="text-clay-600" aria-hidden="true">·</span>
          <span className="font-serif text-xl font-extrabold text-flame-700">
            {shownEstimate !== null ? formatRange(shownEstimate, shownEstimate) : totalEstimateText}
          </span>
        </div>
        {latest ? (
          <p className="mt-2 text-[13px] text-clay-600">Using your latest details from our text thread.</p>
        ) : null}

        {detailsEditable ? (
          <div className="mt-5 rounded-[28px] bg-cream px-5 py-4 text-left">
            {needsDate || needsTime ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {needsDate ? (
                  <label className="block text-sm font-semibold text-ink">
                    Party date
                    <input
                      type="date"
                      min={tomorrowPT()}
                      value={dateInput}
                      onChange={(e) => setDateInput(e.target.value)}
                      className="mt-1 h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-base font-normal text-ink"
                      required
                    />
                    <span className="mt-1 block text-xs font-normal text-clay-600">This is the date the deposit locks.</span>
                  </label>
                ) : null}
                {needsTime ? (
                  <label className="block text-sm font-semibold text-ink">
                    Start time
                    <select
                      value={timeInput}
                      onChange={(e) => setTimeInput(e.target.value)}
                      className="mt-1 h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-base font-normal text-ink"
                      required
                    >
                      {TIME_OPTIONS.map(([value, label]) => (
                        <option key={value || "none"} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            ) : null}
            {needsLocation ? (
              <label className="mt-3 block text-sm font-semibold text-ink">
                Party address or city
                <input
                  type="text"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  placeholder="Street address, or just the city for now"
                  autoComplete="street-address"
                  className="mt-1 h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-base font-normal text-ink"
                  required
                />
                <span className="mt-1 block text-xs font-normal text-clay-600">Travel is confirmed from the address - the first 50 miles are free.</span>
              </label>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink">
              <div className="flex items-center gap-2">
                <span className="font-semibold">Adults</span>
                <button type="button" onClick={step(setAdultsInput, adultsInput, -1, 1)} aria-label="Fewer adults" className="grid h-8 w-8 place-items-center rounded-full bg-white text-lg leading-none shadow-sm">−</button>
                <span className="w-6 text-center font-semibold tabular-nums">{adultsInput}</span>
                <button type="button" onClick={step(setAdultsInput, adultsInput, 1, 1)} aria-label="More adults" className="grid h-8 w-8 place-items-center rounded-full bg-white text-lg leading-none shadow-sm">+</button>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">Kids 5–12</span>
                <button type="button" onClick={step(setKidsInput, kidsInput, -1, 0)} aria-label="Fewer kids" className="grid h-8 w-8 place-items-center rounded-full bg-white text-lg leading-none shadow-sm">−</button>
                <span className="w-6 text-center font-semibold tabular-nums">{kidsInput}</span>
                <button type="button" onClick={step(setKidsInput, kidsInput, 1, 0)} aria-label="More kids" className="grid h-8 w-8 place-items-center rounded-full bg-white text-lg leading-none shadow-sm">+</button>
              </div>
            </div>
            <p className="mt-2 text-xs text-clay-600">
              {tierLabel ? `Party-size discount included: ${tierLabel}.` : "Parties of 10+ get a party-size discount."} Headcount can still change until the day before.
              {repriced?.weekday ? " Mon–Thu rate applied." : null}
            </p>
          </div>
        ) : null}
        {agreedTotal ? (
          <p className="mt-2 text-[13px] text-clay-600">
            Your agreed price from our text thread. Anything you tick below is already included — ticking it just makes sure it's on the order.
          </p>
        ) : null}
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
          disabled={checkoutStarting || detailsMissing}
          className="mt-[26px] flex h-14 w-full items-center justify-center gap-2 rounded-full bg-flame text-lg font-semibold text-white transition hover:bg-flame-600 active:bg-flame-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {checkoutStarting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Opening secure checkout…
            </>
          ) : detailsMissing ? (
            needsDate && !ISO_DATE.test(dateInput) ? "Pick your date to continue" : "Fill in the details to continue"
          ) : (
            `Pay ${depositLabel} deposit · lock ${ISO_DATE.test(effectiveDate) ? formatUiDate(effectiveDate, "the date") : "the date"}`
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
              <span className="font-semibold text-ink">Liability:</span> Real Hibachi LLC is not liable for property
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
