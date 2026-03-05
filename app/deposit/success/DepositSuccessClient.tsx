"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"

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
  error?: string
}

type DepositSuccessClientProps = {
  sessionId: string | null
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

export default function DepositSuccessClient({ sessionId }: DepositSuccessClientProps) {
  const [state, setState] = useState<VerifyState>({ stage: "idle" })

  const canVerify = useMemo(() => typeof sessionId === "string" && sessionId.length > 0, [sessionId])

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
      const response = await fetch(`/api/deposit/verify?session_id=${encodeURIComponent(sessionId)}`, {
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
  }, [sessionId])

  useEffect(() => {
    void verify()
  }, [verify])

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
            {result.transaction_id && (
              <p className="mt-1 break-all">
                Transaction ID: <span className="font-mono">{result.transaction_id}</span>
              </p>
            )}
            {result.booking_id && (
              <p className="mt-1 break-all">
                Booking ID: <span className="font-mono">{result.booking_id}</span>
              </p>
            )}
          </div>
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
            {canVerify && sessionId && (
              <p className="text-xs text-gray-500 break-all">
                Checkout session: <span className="font-mono">{sessionId}</span>
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/deposit/pay">Back to Deposit</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/deposit/cancel">Payment Help</Link>
              </Button>
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

