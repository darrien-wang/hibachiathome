"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { CheckCircle, AlertCircle, ArrowRight } from "lucide-react"
import Link from "next/link"
import { getBookingDetails } from "@/app/actions/booking"
import { getDepositAmount } from "@/config/deposit"
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

const PREFILL_SOURCES = new Set(["quoteA", "quoteB", "estimation"])

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
  return `$${low.toFixed(0)} - $${high.toFixed(0)}`
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
  const searchParams = useSearchParams()
  const bookingId = searchParams.get("id") || ""
  const source = searchParams.get("source") || ""
  const isPrefillSource = PREFILL_SOURCES.has(source)
  const customerNameParam = searchParams.get("customer_name")?.trim() || ""
  const customerEmailParam = searchParams.get("customer_email")?.trim() || ""
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
    async function fetchBookingDetails() {
      if (!bookingId) {
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
      }

      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.error || "Unable to start secure checkout. Please try again.")
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
      <div className="page-container container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error || !booking) {
    return (
      <div className="page-container container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error || "Unable to load booking details."}</AlertDescription>
          </Alert>
          <div className="mt-6 text-center">
            <Button asChild>
              <Link href="/contact">Contact Us</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container container mx-auto px-4 py-12">
      <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-8 rounded-md shadow-sm max-w-3xl mx-auto">
        <div className="flex items-center">
          <CheckCircle className="h-6 w-6 text-green-500 mr-3" />
          <p className="text-green-700 font-medium text-lg">
            <span className="font-bold">72-Hour Free Cancellation Policy:</span> Cancel at least 72 hours before your
            event for a full refund with no penalty.
          </p>
        </div>
      </div>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-4">Lock Your Date for ${depositAmount.toFixed(2)}</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Please pay the deposit to confirm your private hibachi party booking.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Booking Details</CardTitle>
            <CardDescription>Please confirm the following booking information.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Booking Number</p>
                  <p className="font-medium">{booking.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Customer Name</p>
                  <p className="font-medium">{booking.full_name || "Guest"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Event Date</p>
                  <p className="font-medium">{booking.event_date || "TBD"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Event Time</p>
                  <p className="font-medium">{booking.event_time || "TBD"}</p>
                </div>
              </div>

              {booking.location && (
                <div>
                  <p className="text-sm text-gray-500">City or ZIP</p>
                  <p className="font-medium">{booking.location}</p>
                </div>
              )}

              {typeof booking.tent_10x10 === "boolean" && (
                <div>
                  <p className="text-sm text-gray-500">10'x10' Tent</p>
                  <p className="font-medium">{booking.tent_10x10 ? "Yes" : "No"}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Number of Adults</p>
                  <p className="font-medium">{booking.guest_adults ?? 0} people</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Number of Children</p>
                  <p className="font-medium">{booking.guest_kids ?? 0} people</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Total Estimate</p>
                  <p className="font-medium">{totalEstimateText}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Deposit Amount</p>
                  <p className="font-bold text-lg text-primary">${depositAmount.toFixed(2)}</p>
                </div>
              </div>

              {hasBookingEstimateRange && (
                <p className="text-xs text-gray-500">
                  This estimate range is from your Instant Quote selections and will be finalized during confirmation.
                </p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button
              onClick={handleDepositCtaClick}
              disabled={checkoutStarting}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-xl py-3 disabled:bg-blue-300"
            >
              <div className="flex items-center justify-center">
                <img
                  src="https://b.stripecdn.com/manage-statics-srv/assets/public/favicon.ico"
                  alt="Stripe"
                  className="h-5 w-5 mr-2"
                />
                {checkoutStarting ? "Redirecting to secure checkout..." : `Lock Your Date for $${depositAmount.toFixed(2)}`}
                <ArrowRight className="ml-2 h-4 w-4" />
              </div>
            </Button>

            {checkoutError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Checkout Error</AlertTitle>
                <AlertDescription>{checkoutError}</AlertDescription>
              </Alert>
            )}

            <div className="text-sm text-gray-600 mt-4 space-y-4">
              <p className="text-center font-medium">
                By paying the deposit, you agree to our Terms of Service and Cancellation Policy.
              </p>

              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-xs">
                <h4 className="font-semibold mb-2">Important Policies:</h4>

                <p className="mb-2">
                  <span className="font-semibold">Liability Waiver:</span> Real Hibachi, Inc. will not be liable for
                  property damage caused during events. The host waives claims against Real Hibachi for loss, damage,
                  or destruction of property.
                </p>

                <p className="mb-2">
                  <span className="font-semibold">Communication Consent:</span> By proceeding, you agree to receive
                  communications by text message about your booking. You may opt-out by replying STOP.
                </p>

                <p className="mb-2">
                  <span className="font-semibold">Cancellation Policy:</span> Notify us at least 72 hours before your
                  event to cancel or reschedule and receive a full refund of your deposit with no penalty fees. Changes
                  inside 72 hours may make the deposit non-refundable.
                </p>

                <p>
                  <span className="font-semibold">Weather Policy:</span> If rain is in the forecast, we can provide a
                  complimentary tent for your event. If you still need to cancel due to weather, please let us know at
                  least 72 hours before your party for a full deposit refund.
                </p>
              </div>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
