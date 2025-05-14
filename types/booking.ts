export interface Booking {
  id?: string
  full_name: string
  email: string
  phone: string
  address: string
  zip_code: string
  event_date: string
  event_time: string
  guest_adults: number
  guest_kids: number
  price_adult: number
  price_kid: number
  travel_fee: number
  special_requests?: string
  premium_proteins?: Array<{
    name: string
    quantity: number
    unit_price: number
  }>
  add_ons?: Array<{
    name: string
    quantity: number
    unit_price: number
  }>
  total_cost?: number
  deposit?: number
  status?: "pending" | "confirmed" | "completed" | "cancelled"
  created_at?: string
  updated_at?: string
}

export interface BookingFormData {
  name: string
  email: string
  phone: string
  address: string
  zipcode: string
  eventDate: string
  eventTime: string
  adults: number
  kids: number
  filetMignon: number
  lobsterTail: number
  extraProteins: number
  noodles: number
  message?: string
}

export interface BookingResponse {
  success: boolean
  data?: Booking
  error?: string
}

export interface AvailableTimesResponse {
  success: boolean
  availableTimeSlots?: string[]
  error?: string
}

export type DateTimeSelection = {
  date: string | undefined
  time: string | undefined
  price: number
  originalPrice: number
}
