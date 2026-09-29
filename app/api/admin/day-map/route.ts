import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase"
import { geocode } from "@/lib/travel-distance"
import { HOME_BASE_QUERY } from "@/config/home-base"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// 一天几场摆到地图上（老板 2026-09-29）：五场挤在 17:00–20:30，能不能让一个师傅
// 连做两场，全看它们离多远、顺不顺路。
//
// 全程免 key：地址用 Nominatim（地址补全本来就在用），车程用 OSRM，底图用 OSM 的
// 瓦片。坐标查过就存进 address_geo——Nominatim 每秒只准问一次，老板来回点几下就撞
// 配额了，而地址不会自己搬家。

const OSRM_TABLE = "https://router.project-osrm.org/table/v1/driving"
const METERS_PER_MILE = 1609.344

type OrderRow = {
  id: string
  order_no: string
  customer_name: string | null
  customer_phone: string | null
  event_start: string | null
  event_address: string | null
  guest_adult_count: number | null
  guest_child_count: number | null
  order_status: string | null
}

const norm = (a: string) => a.trim().replace(/\s+/g, " ").toLowerCase()

/** 查过的地址直接用缓存；查不到也记下来，免得每次打开都重问同一个烂地址。 */
async function locate(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  address: string,
): Promise<{ lat: number; lng: number; label: string } | null> {
  const key = norm(address)
  if (!key) return null
  if (supabase) {
    const { data } = await supabase.from("address_geo").select("lat, lng, label, found").eq("query", key).maybeSingle()
    if (data) {
      const row = data as { lat: number | null; lng: number | null; label: string | null; found: boolean }
      return row.found && row.lat !== null && row.lng !== null ? { lat: row.lat, lng: row.lng, label: row.label ?? address } : null
    }
  }
  let hit: { lat: number; lng: number; label: string } | null = null
  try {
    hit = await geocode(address)
  } catch {
    hit = null
  }
  if (supabase) {
    await supabase
      .from("address_geo")
      .upsert({ query: key, lat: hit?.lat ?? null, lng: hit?.lng ?? null, label: hit?.label ?? null, found: !!hit, geocoded_at: new Date().toISOString() })
      .select("query")
  }
  return hit
}

/**
 * 每一场到下一场的车程。一次 OSRM table 调用拿全部两两距离，不是 n 次路径查询——
 * 五个点就是 20 条腿，一条条问会被限流。
 */
async function legs(points: Array<{ lat: number; lng: number }>): Promise<Array<{ minutes: number; miles: number } | null>> {
  if (points.length < 2) return []
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";")
  try {
    const res = await fetch(`${OSRM_TABLE}/${coords}?annotations=duration,distance`, {
      headers: { "User-Agent": "RealHibachi-Marketing/1.0 (support@realhibachi.com)" },
      cache: "no-store",
    })
    if (!res.ok) return points.slice(1).map(() => null)
    const j = (await res.json()) as { durations?: number[][]; distances?: number[][] }
    return points.slice(1).map((_, i) => {
      const sec = j.durations?.[i]?.[i + 1]
      const m = j.distances?.[i]?.[i + 1]
      if (typeof sec !== "number" || typeof m !== "number") return null
      return { minutes: Math.round(sec / 60), miles: Math.round((m / METERS_PER_MILE) * 10) / 10 }
    })
  } catch {
    return points.slice(1).map(() => null)
  }
}

export async function GET(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "not configured" }, { status: 500 })

  const date = (request.nextUrl.searchParams.get("date") ?? "").trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "date required" }, { status: 400 })

  // event_start 存的是墙上时间（按 UTC 写入），所以"哪一天"直接比 ISO 日期位，
  // 不做时区换算——换算会把 12:00 变成前一天。
  const { data } = await supabase
    .from("orders")
    .select("id, order_no, customer_name, customer_phone, event_start, event_address, guest_adult_count, guest_child_count, order_status")
    .gte("event_start", `${date}T00:00:00`)
    .lt("event_start", `${date}T23:59:59`)
    .order("event_start")

  const rows = ((data ?? []) as OrderRow[]).filter((r) => !/cancel|void|refund/i.test(r.order_status ?? ""))

  const stops = []
  for (const r of rows) {
    const addr = (r.event_address ?? "").trim()
    const geo = addr ? await locate(supabase, addr) : null
    const t = r.event_start ? new Date(r.event_start) : null
    stops.push({
      id: r.id,
      orderNo: r.order_no,
      name: (r.customer_name ?? "").trim() || "未留名",
      phone: r.customer_phone ?? null,
      address: addr,
      time: t ? t.toLocaleTimeString("en-US", { timeZone: "UTC", hour: "numeric", minute: "2-digit" }) : "",
      guests: (r.guest_adult_count ?? 0) + (r.guest_child_count ?? 0),
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
    })
  }

  const placed = stops.filter((s) => s.lat !== null && s.lng !== null) as Array<(typeof stops)[number] & { lat: number; lng: number }>
  const home = await locate(supabase, HOME_BASE_QUERY)
  const hops = await legs(placed.map((s) => ({ lat: s.lat, lng: s.lng })))

  return NextResponse.json({
    ok: true,
    date,
    stops,
    // 定位不到的单要点名，不能默默从地图上消失——那样看起来就像那天没这一场。
    missing: stops.filter((s) => s.lat === null).map((s) => ({ name: s.name, address: s.address })),
    home: home ? { lat: home.lat, lng: home.lng, label: "家（出发点）" } : null,
    // 第 i 条 = 第 i 场开到第 i+1 场
    hops,
  })
}
