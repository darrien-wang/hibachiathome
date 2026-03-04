"use server"

import { createServerSupabaseClient } from "@/lib/supabase"
import type { PaymentRequest, PaymentResponse, DepositRecord } from "@/types/payment"
import { Resend } from "resend"
import PaymentConfirmationEmail from "@/components/emails/payment-confirmation"
import RefundConfirmationEmail from "@/components/emails/refund-confirmation"

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null
  }
  return new Resend(process.env.RESEND_API_KEY)
}

function isLikelyStripePaymentIntentId(value: unknown): value is string {
  return typeof value === "string" && /^pi_/i.test(value)
}

function isLikelyStripeSessionId(value: unknown): value is string {
  return typeof value === "string" && /^cs_(test|live)_/i.test(value)
}

export async function processPayment(request: PaymentRequest): Promise<PaymentResponse> {
  try {
    const supabase = createServerSupabaseClient()
    if (!supabase) {
      return {
        success: false,
        error: "Database connection failed. Please try again.",
      }
    }

    // 1. Validate booking exists
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", request.bookingId)
      .single()

    if (bookingError || !booking) {
      console.error("Booking not found:", bookingError)
      return {
        success: false,
        error: "Booking not found or has been cancelled",
      }
    }

    // 2. Process payment based on method
    let transactionId = ""
    const isImmediateCapture = request.method === "stripe" || request.method === "square"
    const normalizedAmount = Number(request.amount.toFixed(2))

    switch (request.method) {
      case "stripe":
        // Prefer real Stripe transaction identifiers when available.
        transactionId =
          request.paymentIntentId ||
          request.stripeSessionId ||
          `stripe_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
        break

      case "square":
        // In a real application, this would call the Square API
        transactionId = `square_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
        break

      case "venmo":
        // Venmo typically requires manual confirmation
        transactionId = `venmo_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
        break

      case "zelle":
        // Zelle typically requires manual confirmation
        transactionId = `zelle_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
        break

      default:
        return {
          success: false,
          error: "Unsupported payment method",
        }
    }

    // 3. Record deposit payment
    const { data: deposit, error: depositError } = await supabase
      .from("deposits")
      .insert({
        booking_id: request.bookingId,
        amount: normalizedAmount,
        payment_method: request.method,
        transaction_id: transactionId,
        status: isImmediateCapture ? "completed" : "pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (depositError) {
      console.error("Error recording deposit:", depositError)
      return {
        success: false,
        error: "Error recording deposit payment",
      }
    }

    // 4. Update booking status - Note: convert deposit to integer
    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        deposit: Math.round(normalizedAmount), // Convert to integer as the database uses bigint
        deposit_amount: normalizedAmount,
        deposit_status: isImmediateCapture ? "paid" : "pending",
        stripe_session_id: request.stripeSessionId ?? null,
        payment_intent_id: request.paymentIntentId ?? null,
        status: "confirmed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.bookingId)

    if (updateError) {
      console.error("Error updating booking:", updateError)
      return {
        success: false,
        error: "Error updating booking status",
      }
    }

    // 5. Send confirmation email
    try {
      const resend = getResendClient()
      if (resend) {
        await resend.emails.send({
          from: process.env.EMAIL_FROM || "noreply@hibachicatering.com",
          to: booking.email,
          subject: "Hibachi Catering - Deposit Payment Confirmation",
          react: PaymentConfirmationEmail({
            customerName: booking.full_name,
            bookingId: booking.id,
            eventDate: booking.event_date,
            eventTime: booking.event_time,
            depositAmount: request.amount,
            paymentMethod: request.method,
            transactionId: transactionId,
            paymentDate: new Date().toISOString(),
          }),
        })
      }
    } catch (emailError) {
      // Log the error but don't fail the payment process
      console.error("Error sending confirmation email:", emailError)
    }

    return {
      success: true,
      transactionId,
    }
  } catch (error) {
    console.error("Payment processing error:", error)
    return {
      success: false,
      error: "Error processing payment",
    }
  }
}

// Get deposits list
export async function getDeposits() {
  try {
    const supabase = createServerSupabaseClient()
    if (!supabase) {
      return {
        success: false,
        error: "Database connection failed. Please try again.",
      }
    }

    const { data, error } = await supabase
      .from("deposits")
      .select(`
        *,
        bookings (
          id,
          full_name,
          event_date,
          event_time
        )
      `)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching deposits:", error)
      return {
        success: false,
        error: error.message,
      }
    }

    return {
      success: true,
      data: data as DepositRecord[],
    }
  } catch (error: any) {
    console.error("Error in getDeposits:", error)
    return {
      success: false,
      error: `An unexpected error occurred: ${error.message || "Unknown error"}`,
    }
  }
}

// Confirm deposit
export async function confirmDeposit(depositId: string) {
  try {
    const supabase = createServerSupabaseClient()
    if (!supabase) {
      return {
        success: false,
        error: "Database connection failed. Please try again.",
      }
    }

    // 1. Get deposit and booking information
    const { data: deposit, error: fetchError } = await supabase
      .from("deposits")
      .select(`
        *,
        bookings (
          id,
          full_name,
          email,
          event_date,
          event_time
        )
      `)
      .eq("id", depositId)
      .single()

    if (fetchError || !deposit) {
      console.error("Error fetching deposit:", fetchError)
      return {
        success: false,
        error: "Failed to retrieve deposit information",
      }
    }

    // 2. Update deposit status
    const { error } = await supabase
      .from("deposits")
      .update({
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", depositId)

    if (error) {
      console.error("Error confirming deposit:", error)
      return {
        success: false,
        error: error.message,
      }
    }

    // 3. Update canonical booking deposit fields
    const bookingId = (deposit as any).bookings?.id as string | undefined
    if (bookingId) {
      const depositAmountRaw = Number((deposit as any).amount ?? 0)
      const depositAmount = Number.isFinite(depositAmountRaw) ? Number(depositAmountRaw.toFixed(2)) : 0
      const depositTransactionId = (deposit as any).transaction_id as string | undefined
      const bookingUpdate: Record<string, unknown> = {
        deposit: Math.round(depositAmount),
        deposit_amount: depositAmount,
        deposit_status: "paid",
        status: "confirmed",
        updated_at: new Date().toISOString(),
      }

      if (isLikelyStripeSessionId(depositTransactionId)) {
        bookingUpdate.stripe_session_id = depositTransactionId
      }
      if (isLikelyStripePaymentIntentId(depositTransactionId)) {
        bookingUpdate.payment_intent_id = depositTransactionId
      }

      const { error: updateBookingError } = await supabase.from("bookings").update(bookingUpdate).eq("id", bookingId)

      if (updateBookingError) {
        console.error("Error updating booking canonical deposit fields:", updateBookingError)
        return {
          success: false,
          error: "Failed to update booking deposit status",
        }
      }
    }

    // 4. Send confirmation email
    try {
      const booking = (deposit as any).bookings
      const resend = getResendClient()
      if (booking && booking.email && resend) {
        await resend.emails.send({
          from: process.env.EMAIL_FROM || "noreply@hibachicatering.com",
          to: booking.email,
          subject: "Hibachi Catering - Deposit Payment Confirmed",
          react: PaymentConfirmationEmail({
            customerName: booking.full_name,
            bookingId: booking.id,
            eventDate: booking.event_date,
            eventTime: booking.event_time,
            depositAmount: deposit.amount,
            paymentMethod: deposit.payment_method,
            transactionId: deposit.transaction_id,
            paymentDate: deposit.created_at,
          }),
        })
      }
    } catch (emailError) {
      // Log the error but don't fail the confirmation process
      console.error("Error sending confirmation email:", emailError)
    }

    return {
      success: true,
    }
  } catch (error: any) {
    console.error("Error in confirmDeposit:", error)
    return {
      success: false,
      error: `An unexpected error occurred: ${error.message || "Unknown error"}`,
    }
  }
}

// Refund deposit
export async function refundDeposit(depositId: string) {
  try {
    const supabase = createServerSupabaseClient()
    if (!supabase) {
      return {
        success: false,
        error: "Database connection failed. Please try again.",
      }
    }

    // 1. Get deposit information
    const { data: deposit, error: fetchError } = await supabase
      .from("deposits")
      .select(`
        *,
        bookings (
          id,
          full_name,
          email,
          event_date,
          event_time
        )
      `)
      .eq("id", depositId)
      .single()

    if (fetchError || !deposit) {
      console.error("Error fetching deposit:", fetchError)
      return {
        success: false,
        error: "Failed to retrieve deposit information",
      }
    }

    // 2. Update deposit status
    const { error: updateDepositError } = await supabase
      .from("deposits")
      .update({
        status: "refunded",
        updated_at: new Date().toISOString(),
      })
      .eq("id", depositId)

    if (updateDepositError) {
      console.error("Error updating deposit:", updateDepositError)
      return {
        success: false,
        error: "Failed to update deposit status",
      }
    }

    // 3. Update booking status
    const bookingId = (deposit as any).bookings?.id
    if (bookingId) {
      const depositAmountRaw = Number((deposit as any).amount ?? 0)
      const depositAmount = Number.isFinite(depositAmountRaw) ? Number(depositAmountRaw.toFixed(2)) : 0

      const { error: updateBookingError } = await supabase
        .from("bookings")
        .update({
          deposit: 0, // Clear deposit
          deposit_amount: depositAmount,
          deposit_status: "refunded",
          status: "pending", // Revert to pending status
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookingId)

      if (updateBookingError) {
        console.error("Error updating booking:", updateBookingError)
        // Don't interrupt the process, but log the error
      }
    }

    // 4. Send refund confirmation email
    try {
      const booking = (deposit as any).bookings
      const resend = getResendClient()
      if (booking && booking.email && resend) {
        await resend.emails.send({
          from: process.env.EMAIL_FROM || "noreply@hibachicatering.com",
          to: booking.email,
          subject: "Hibachi Catering - Deposit Refund Confirmation",
          react: RefundConfirmationEmail({
            customerName: booking.full_name,
            bookingId: booking.id,
            eventDate: booking.event_date,
            eventTime: booking.event_time,
            depositAmount: deposit.amount,
            paymentMethod: deposit.payment_method,
            transactionId: deposit.transaction_id,
            refundDate: new Date().toISOString(),
          }),
        })
      }
    } catch (emailError) {
      // Log the error but don't fail the refund process
      console.error("Error sending refund confirmation email:", emailError)
    }

    return {
      success: true,
    }
  } catch (error: any) {
    console.error("Error in refundDeposit:", error)
    return {
      success: false,
      error: `An unexpected error occurred: ${error.message || "Unknown error"}`,
    }
  }
}
