export interface Reservation {
  id?: string
  name: string
  email?: string
  phone: string
  headcount: number
  event_date: string
  event_time: string
  address: string
  special_requests?: string
  status?: string
  created_at?: string
  updated_at?: string
}

export interface Order {
  id?: string
  reservation_id: string
  package_id: string
  total_price: number
  status?: string
  created_at?: string
  updated_at?: string
}

export interface OrderItem {
  id?: string
  order_id: string
  item_type: string // 'protein', 'side', 'premium', etc.
  item_id: string
  quantity: number
  price: number
  created_at?: string
}

export interface Participant {
  id?: string
  order_id: string
  name: string
  status?: string
  is_host?: boolean
  is_proxy_selection?: boolean
  created_at?: string
  updated_at?: string
}

export interface ParticipantSelection {
  id?: string
  participant_id: string
  item_type: string
  item_id: string
  quantity: number
  created_at?: string
}

export interface PackageOption {
  id: string
  name: string
  description: string
  headcount: number
  childCount: number
  flatRate: number
  originalPrice?: number
  currentPrice?: number
  upgrades: Record<string, number>
}
