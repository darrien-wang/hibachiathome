"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { trackDepositCompletedOnce } from "@/lib/tracking"

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
  const invoiceSelfServiceHref = useMemo(
    () =>
      buildInvoiceSelfServiceHref({
        baseUrl: process.env.NEXT_PUBLIC_INVOICE_SELF_SERVICE_BASE_URL,
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

    trackDepositCompletedOnce({
      transaction_id: result.transaction_id,
      value: typeof result.value === "number" ? result.value : undefined,
      currency: typeof result.currency === "string" ? result.currency : "USD",
      event_id: result.session_id || sessionId || undefined,
      booking_id: displayBookingId ?? undefined,
      checkout_session_id: result.session_id || undefined,
      deposit_status: result.status,
      conversion_surface: "deposit_success",
    })
  }, [displayBookingId, sessionId, state])

  const content = (() => {
    if (state.stage === "idle" || state.stage === "loading") {
      return (
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            We are verifying your deposit with our server before confirming your booking status.
          </p>
          <div className="inline-flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking payment status...
          </div>
        </div>
      )
    }

    if (state.stage === "failed") {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Verification failed</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )
    }

    const result = state.payload
    if (result.paid) {
      return (
        <div className="space-y-4">
          <Alert className="border-green-200 bg-green-50 text-green-900">
            <CheckCircle2 className="h-4 w-4 text-green-700" />
            <AlertTitle>Deposit payment confirmed</AlertTitle>
            <AlertDescription>
              Your Stripe payment has been verified from canonical payment records.
            </AlertDescription>
          </Alert>
          <div className="rounded-md border border-gray-200 p-4 text-sm text-gray-700">
            {typeof result.value === "number" && (
              <p>
                Amount:{" "}
                <span className="font-medium">{formatCurrency(result.value, (result.currency || "USD").toUpperCase())}</span>
              </p>
            )}
            {displayBookingId && (
              <p className="mt-1 break-all">
                Booking Number: <span className="font-mono">{displayBookingId}</span>
              </p>
            )}
          </div>
          {invoiceSelfServiceHref && (
            <p className="text-sm text-gray-700">
              Need to confirm your party-day menu selections or update contact information? Use the self-service link
              below.
            </p>
          )}
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertCircle className="h-4 w-4 text-amber-700" />
          <AlertTitle>Payment not confirmed yet</AlertTitle>
          <AlertDescription>
            We have not verified a paid deposit for this session yet. This can happen if webhook delivery is delayed.
          </AlertDescription>
        </Alert>
        <p className="text-sm text-gray-700">
          Status: <span className="font-medium">{result.status}</span>
        </p>
        <Button onClick={() => void verify()} variant="outline">
          Refresh Verification
        </Button>
      </div>
    )
  })()

  return (
    <div className="page-container container mx-auto px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Deposit Payment Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {content}
            <div className="flex flex-wrap gap-3">
              {isPaidState && invoiceSelfServiceHref && (
                <Button asChild>
                  <a href={invoiceSelfServiceHref} target="_blank" rel="noreferrer">
                    Manage Party-Day Details
                  </a>
                </Button>
              )}
              {!isPaidState && invoiceSelfServiceHref && (
                <Button asChild variant="outline">
                  <a href={invoiceSelfServiceHref} target="_blank" rel="noreferrer">
                    Open Self-Service Details
                  </a>
                </Button>
              )}
              {!isPaidState && (
                <Button asChild variant="outline">
                  <Link href="/deposit/cancel">Payment Help</Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link href="/contact">Contact Support</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
