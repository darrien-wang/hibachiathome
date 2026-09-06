import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"

const QUOTE_TIME_SLOTS = ["13:00", "16:00", "19:00", "21:00"] as const

// Same capacity model as /api/availability: technician_count x max_orders_per_technician
// per day, read from pricing_config with the same fallbacks. Cached briefly so the
// quote page can poll per date-change without hammering Supabase.
let configCache: { technicianCount: number; maxOrdersPerTech: number } | null = null
let configLastFetched = 0
const CONFIG_CACHE_TTL = 60 * 1000

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? ""
  // Range mode (?start=YYYY-MM-DD&days=N) powers the month calendar with one
  // Supabase query; single-date mode below is unchanged for existing callers.
  const start = request.nextUrl.searchParams.get("start")
  if (start) {
    return rangeAvailability(start, request.nextUrl.searchParams.get("days"))
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  let technicianCount = 3
  let maxOrdersPerTech = 3
  try {
    const now = Date.now()
    if (configCache && now - configLastFetched < CONFIG_CACHE_TTL) {
      technicianCount = configCache.technicianCount
      maxOrdersPerTech = configCache.maxOrdersPerTech
    } else {
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
    }
  } catch {
    // keep defaults
  }

  const maxDaily = technicianCount * maxOrdersPerTech

  let bookedTimes: string[] = []
  try {
    const { data, error } = await supabase
      .from("reservations")
      .select("event_time")
      .eq("event_date", date)
      .eq("status", "confirmed")
    if (error) throw error
    bookedTimes = (data ?? [])
      .map((row) => String(row.event_time ?? ""))
      .filter((value) => value.length > 0)
  } catch {
    return NextResponse.json({ error: "availability lookup failed" }, { status: 503 })
  }

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

  const supabase = createServerSupabaseClient()

  let technicianCount = 3
  let maxOrdersPerTech = 3
  try {
    const now = Date.now()
    if (configCache && now - configLastFetched < CONFIG_CACHE_TTL) {
      technicianCount = configCache.technicianCount
      maxOrdersPerTech = configCache.maxOrdersPerTech
    } else {
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
    }
  } catch {
    // keep defaults
  }
  const maxDaily = technicianCount * maxOrdersPerTech

  const startDate = new Date(`${start}T00:00:00Z`)
  const endDate = new Date(startDate)
  endDate.setUTCDate(endDate.getUTCDate() + days - 1)
  const end = endDate.toISOString().slice(0, 10)

  let rows: Array<{ event_date: string }> = []
  try {
    const { data, error } = await supabase
      .from("reservations")
      .select("event_date")
      .gte("event_date", start)
      .lte("event_date", end)
      .eq("status", "confirmed")
    if (error) throw error
    rows = (data ?? []) as Array<{ event_date: string }>
  } catch {
    return NextResponse.json({ error: "availability lookup failed" }, { status: 503 })
  }

  const bookedByDate = new Map<string, number>()
  for (const row of rows) {
    const key = String(row.event_date).slice(0, 10)
    bookedByDate.set(key, (bookedByDate.get(key) ?? 0) + 1)
  }

  const daysOut: Array<{ date: string; remaining: number }> = []
  const cursor = new Date(startDate)
  for (let i = 0; i < days; i += 1) {
    const key = cursor.toISOString().slice(0, 10)
    daysOut.push({ date: key, remaining: Math.max(0, maxDaily - (bookedByDate.get(key) ?? 0)) })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return NextResponse.json({ start, days, maxDaily, dates: daysOut })
}
