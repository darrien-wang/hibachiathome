import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase"
import { geocode } from "@/lib/travel-distance"
import { HOME_BASE_QUERY } from "@/config/home-base"
import { decodePlusCode, parseLatLng, parsePlusCode, recoverPlusCode } from "@/lib/plus-code"

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

type Located = { lat: number; lng: number; label: string; approx?: boolean }

const safeGeocode = async (q: string) => {
  try {
    return await geocode(q)
  } catch {
    return null
  }
}

/**
 * 地址 → 坐标，按"最可信的先试"排：
 *
 *  1. 粘进来的坐标 / Plus Code —— 它本身就是坐标，不用查任何服务，最准也最快。
 *  2. Nominatim 查完整地址。
 *  3. 查不到就退到邮编或城市，标成 approx。
 *
 * 第 3 步是有意的：OSM 在沙漠区缺街道（Caleb 那单的 Stargate 五种写法都查不到），
 * 而"大概在 Yucca Valley"对调度已经够用了——你要判断的是能不能连做两场，不是门牌号。
 * 让它从地图上消失反而更糟：看起来像那天没这一场。
 *
 * 查过的都存进 address_geo，查不到也存——Nominatim 每秒只准问一次，而地址不会自己搬家。
 */
async function locate(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  address: string,
): Promise<Located | null> {
  const key = norm(address)
  if (!key) return null
  if (supabase) {
    const { data } = await supabase.from("address_geo").select("lat, lng, label, found").eq("query", key).maybeSingle()
    if (data) {
      const row = data as { lat: number | null; lng: number | null; label: string | null; found: boolean }
      return row.found && row.lat !== null && row.lng !== null
        ? { lat: row.lat, lng: row.lng, label: row.label ?? address, approx: (row.label ?? "").startsWith("~") }
        : null
    }
  }

  let hit: Located | null = null

  // 1. 直接就是坐标或 Plus Code
  const pin = parseLatLng(address)
  if (pin) hit = { ...pin, label: address }
  if (!hit) {
    const plus = parsePlusCode(address)
    if (plus) {
      if (plus.full) {
        const d = decodePlusCode(plus.code)
        if (d) hit = { ...d, label: plus.code }
      } else if (plus.rest) {
        // 短码省掉了前四位，得先知道大概在地球哪一块。地名部分就是那个参考点。
        const ref = await safeGeocode(plus.rest)
        if (ref) {
          const d = decodePlusCode(recoverPlusCode(plus.code, ref.lat, ref.lng))
          if (d) hit = { ...d, label: plus.code }
        }
      }
    }
  }

  // 2. 正常查
  if (!hit) {
    const g = await safeGeocode(address)
    if (g) hit = { lat: g.lat, lng: g.lng, label: g.label }
  }

  // 3. 退到邮编 / 城市
  if (!hit) {
    const zip = /\b(\d{5})(?:-\d{4})?\b/.exec(address)?.[1]
    const parts = address.split(",").map((x) => x.trim()).filter(Boolean)
    const city = parts.length >= 2 ? parts.slice(-2).join(", ").replace(/\s*\d{5}(-\d{4})?\s*/, "").trim() : ""
    for (const q of [zip ? `${zip}, CA, USA` : "", city ? `${city}, USA` : ""].filter(Boolean)) {
      const g = await safeGeocode(q)
      if (g) {
        // label 打个 ~ 前缀，取缓存时还认得出这是个大概位置。
        hit = { lat: g.lat, lng: g.lng, label: `~${g.label}`, approx: true }
        break
      }
    }
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
      // 只精确到城市/邮编的要标出来，别让人以为图钉就是门口。
      approx: !!geo?.approx,
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
    approx: stops.filter((s) => s.approx).map((s) => ({ name: s.name, address: s.address })),
    home: home ? { lat: home.lat, lng: home.lng, label: "家（出发点）" } : null,
    // 第 i 条 = 第 i 场开到第 i+1 场
    hops,
  })
}

/**
 * POST { address, value } —— 手工给一个地址钉坐标。
 *
 * OSM 在沙漠区缺街道，而那正是我们最赚钱的一块（Joshua Tree / Yucca Valley / Big Bear）。
 * 与其等它补数据，不如让老板从 Google 地图右键复制一个 Plus Code 贴进来——Plus Code
 * 本身就是坐标的另一种写法，离线就能解开，不依赖任何服务。粘经纬度也认。
 */
export async function POST(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "not configured" }, { status: 500 })

  let body: { address?: string; value?: string }
  try {
    body = (await request.json()) as { address?: string; value?: string }
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  const address = (body.address ?? "").trim()
  const value = (body.value ?? "").trim()
  if (!address) return NextResponse.json({ error: "address required" }, { status: 400 })
  if (!value) return NextResponse.json({ error: "贴一个 Plus Code 或者经纬度" }, { status: 400 })

  let pt = parseLatLng(value)
  if (!pt) {
    const plus = parsePlusCode(value)
    if (plus?.full) {
      pt = decodePlusCode(plus.code)
    } else if (plus) {
      // 短码：拿地址本身当参考点，找不着就退到家的位置——两者都在南加州，
      // 短码省掉的那几位在这个尺度上是一样的。
      const ref = (await safeGeocode(plus.rest || address)) ?? (await safeGeocode(HOME_BASE_QUERY))
      if (ref) pt = decodePlusCode(recoverPlusCode(plus.code, ref.lat, ref.lng))
    }
  }
  if (!pt) return NextResponse.json({ error: "认不出来。Plus Code 长这样 85654G4J+24，或者贴 34.105, -116.470" }, { status: 400 })

  await supabase.from("address_geo").upsert({
    query: norm(address),
    lat: pt.lat,
    lng: pt.lng,
    label: `${value}（手工定位）`,
    found: true,
    geocoded_at: new Date().toISOString(),
  })
  return NextResponse.json({ ok: true, lat: pt.lat, lng: pt.lng })
}
