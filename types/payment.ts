export type PaymentMethod = "stripe" | "square" | "venmo" | "zelle"
export type DepositStatus = "pending" | "paid" | "refunded" | "completed"

export interface PaymentRequest {
  bookingId: string
  amount: number
  method: PaymentMethod
  stripeSessionId?: string
  paymentIntentId?: string
  currency?: string
}

export interface PaymentResponse {
  success: boolean
  transactionId?: string
  error?: string
}

export interface DepositRecord {
  id: string
  booking_id: string
  amount: number
  payment_method: PaymentMethod
  transaction_id: string
  status: DepositStatus
  deposit_status?: "pending" | "paid" | "refunded"
  stripe_session_id?: string | null
  payment_intent_id?: string | null
  deposit_amount?: number
  created_at: string
  updated_at: string
  bookings?: {
    id: string
    full_name: string
    email?: string
    event_date: string
    event_time: string
  }
}
