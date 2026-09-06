import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"

const QUOTE_TIME_SLOTS = ["13:00", "16:00", "19:00", "21:00"] as const

// Capacity model: technician_count x max_orders_per_technician per day.
// NOTE (2026-09-06 fix): this endpoint originally queried a "reservations"
// table that has never existed in this Supabase project, so it 503'd since
// launch and the quote page silently used its hash fallback. Real committed
// events live in TWO places: `bookings` with status=confirmed (deposit-paid
// website flow) and `orders` with order_status=active (workbench-created).
// We count both; an order promoted from a confirmed booking can double-count
// a party, which errs toward showing scarcity slightly early — acceptable
// for a display-only hint that never blocks booking.
// `orders.event_start` stores WALL time in a UTC column, so the date/time is
// read by string-slicing, never by timezone conversion.
let configCache: { technicianCount: number; maxOrdersPerTech: number } | null = null
let configLastFetched = 0
const CONFIG_CACHE_TTL = 60 * 1000

async function getCapacityConfig() {
  const supabase = createServerSupabaseClient()
  let technicianCount = 3
  let maxOrdersPerTech = 3
  try {
    const now = Date.now()
    if (configCache && now - configLastFetched < CONFIG_CACHE_TTL) {
      return configCache
    }
    const { data } = await supabase
      .from("pricing_config")
      .select("key, value")
      .in("key", ["technician_count", "max_orders_per_technician"])
    for (const row of data ?? []) {
      const parsed = Number.parseInt(row.value, 10)
      if (!Number.isFinite(parsed) || parsed <= 0) continue
      if (row.key === "technician_count") technicianCount = parsed
      if (row.key === "max_orders_per_technician") maxOrdersPerTech = parsed
    }
    configCache = { technicianCount, maxOrdersPerTech }
    configLastFetched = now
  } catch {
    // keep defaults
  }
  return { technicianCount, maxOrdersPerTech }
}

/** Committed event times per date across bookings + orders, keyed YYYY-MM-DD. */
async function fetchCommittedTimes(start: string, end: string): Promise<Map<string, string[]> | null> {
  const supabase = createServerSupabaseClient()
  const byDate = new Map<string, string[]>()
  try {
    const { data, error } = await supabase
      .from("bookings")
      .select("event_date, event_time")
      .gte("event_date", start)
      .lte("event_date", end)
      .eq("status", "confirmed")
    if (error) throw error
    for (const row of data ?? []) {
      const key = String(row.event_date ?? "").slice(0, 10)
      if (!key) continue
      const list = byDate.get(key) ?? []
      list.push(String(row.event_time ?? ""))
      byDate.set(key, list)
    }
  } catch {
    return null
  }
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("event_start")
      .gte("event_start", `${start}T00:00:00`)
      .lte("event_start", `${end}T23:59:59`)
      .eq("order_status", "active")
    if (error) throw error
    for (const row of data ?? []) {
      const raw = String(row.event_start ?? "")
      const key = raw.slice(0, 10)
      if (!key) continue
      const list = byDate.get(key) ?? []
      list.push(raw.slice(11, 16))
      byDate.set(key, list)
    }
  } catch {
    // Orders lookup failing shouldn't kill the endpoint — bookings already loaded.
  }
  return byDate
}

export async function GET(request: NextRequest) {
  const start = request.nextUrl.searchParams.get("start")
  if (start) {
    return rangeAvailability(start, request.nextUrl.searchParams.get("days"))
  }

  const date = request.nextUrl.searchParams.get("date") ?? ""
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 })
  }

  const { technicianCount, maxOrdersPerTech } = await getCapacityConfig()
  const maxDaily = technicianCount * maxOrdersPerTech

  const byDate = await fetchCommittedTimes(date, date)
  if (!byDate) {
    return NextResponse.json({ error: "availability lookup failed" }, { status: 503 })
  }
  const bookedTimes = (byDate.get(date) ?? []).filter((value) => value.length > 0)

  const remaining = Math.max(0, maxDaily - bookedTimes.length)
  const slots = QUOTE_TIME_SLOTS.map((time) => {
    const bookedAtTime = bookedTimes.filter((value) => value.startsWith(time)).length
    return {
      time,
      booked: bookedAtTime,
      available: remaining > 0 && bookedAtTime < technicianCount,
    }
  })

  return NextResponse.json({ date, maxDaily, booked: bookedTimes.length, remaining, slots })
}

async function rangeAvailability(start: string, daysParam: string | null) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    return NextResponse.json({ error: "start must be YYYY-MM-DD" }, { status: 400 })
  }
  const days = Math.min(Math.max(Number.parseInt(daysParam ?? "31", 10) || 31, 1), 62)

  const { technicianCount, maxOrdersPerTech } = await getCapacityConfig()
  const maxDaily = technicianCount * maxOrdersPerTech

  const startDate = new Date(`${start}T00:00:00Z`)
  const endDate = new Date(startDate)
  endDate.setUTCDate(endDate.getUTCDate() + days - 1)
  const end = endDate.toISOString().slice(0, 10)

  const byDate = await fetchCommittedTimes(start, end)
  if (!byDate) {
    return NextResponse.json({ error: "availability lookup failed" }, { status: 503 })
  }

  const daysOut: Array<{ date: string; remaining: number }> = []
  const cursor = new Date(startDate)
  for (let i = 0; i < days; i += 1) {
    const key = cursor.toISOString().slice(0, 10)
    daysOut.push({ date: key, remaining: Math.max(0, maxDaily - (byDate.get(key)?.length ?? 0)) })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return NextResponse.json({ start, days, maxDaily, dates: daysOut })
}
