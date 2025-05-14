export type PaymentMethod = "stripe" | "square" | "venmo" | "zelle"

export interface PaymentRequest {
  bookingId: string
  amount: number
  method: PaymentMethod
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
  status: "pending" | "completed" | "refunded"
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
