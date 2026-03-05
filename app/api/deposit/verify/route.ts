import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"

export const runtime = "nodejs"

type CanonicalDepositStatus = "pending" | "paid" | "refunded"

type VerifyResponse = {
  success: boolean
  paid: boolean
  session_id: string | null
  status: CanonicalDepositStatus | "not_found" | "invalid_request"
  value?: number
  currency?: string
  transaction_id?: string
  booking_id?: string
  email?: string
  phone?: string
  error?: string
}

function jsonNoStore(body: VerifyResponse, status = 200) {
  const response = NextResponse.json(body, { status })
  response.headers.set("Cache-Control", "no-store")
  return response
}

function normalizeSessionId(value: string | null): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeAmount(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined
  }

  return Number(value.toFixed(2))
}

function normalizeCanonicalStatus(value: unknown): CanonicalDepositStatus {
  if (value === "paid" || value === "refunded" || value === "pending") {
    return value
  }
  return "pending"
}

function normalizeTransactionId(input: { payment_intent_id?: unknown; stripe_session_id?: unknown; fallbackSessionId: string }) {
  if (typeof input.payment_intent_id === "string" && input.payment_intent_id.trim()) {
    return input.payment_intent_id
  }

  if (typeof input.stripe_session_id === "string" && input.stripe_session_id.trim()) {
    return input.stripe_session_id
  }

  return input.fallbackSessionId
}

export async function GET(request: NextRequest) {
  const sessionId = normalizeSessionId(request.nextUrl.searchParams.get("session_id"))
  if (!sessionId) {
    return jsonNoStore(
      {
        success: false,
        paid: false,
        session_id: null,
        status: "invalid_request",
        error: "Missing session_id query parameter.",
      },
      400,
    )
  }

  const supabase = createServerSupabaseClient()
  if (!supabase) {
    return jsonNoStore(
      {
        success: false,
        paid: false,
        session_id: sessionId,
        status: "invalid_request",
        error: "Supabase server client is not configured.",
      },
      500,
    )
  }

  const { data, error } = await supabase
    .from("bookings")
    .select("id, email, phone, deposit_status, deposit_amount, payment_intent_id, stripe_session_id")
    .eq("stripe_session_id", sessionId)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("[deposit/verify] Failed to load canonical deposit state:", error)
    return jsonNoStore(
      {
        success: false,
        paid: false,
        session_id: sessionId,
        status: "invalid_request",
        error: "Failed to verify deposit status.",
      },
      500,
    )
  }

  if (!data) {
    return jsonNoStore({
      success: true,
      paid: false,
      session_id: sessionId,
      status: "not_found",
      currency: "USD",
    })
  }

  const canonicalStatus = normalizeCanonicalStatus(data.deposit_status)
  const paid = canonicalStatus === "paid"
  const value = normalizeAmount(data.deposit_amount)
  const transactionId = normalizeTransactionId({
    payment_intent_id: data.payment_intent_id,
    stripe_session_id: data.stripe_session_id,
    fallbackSessionId: sessionId,
  })

  return jsonNoStore({
    success: true,
    paid,
    session_id: sessionId,
    status: canonicalStatus,
    value,
    currency: "USD",
    transaction_id: paid ? transactionId : undefined,
    booking_id: typeof data.id === "string" ? data.id : undefined,
    email: typeof data.email === "string" ? data.email : undefined,
    phone: typeof data.phone === "string" ? data.phone : undefined,
  })
}
