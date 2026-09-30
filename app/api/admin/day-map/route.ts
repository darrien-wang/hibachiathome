import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase"
import { geocode } from "@/lib/travel-distance"
import { HOME_BASE_QUERY } from "@/config/home-base"
import { decodePlusCode, parseLatLng, parsePlusCode, recoverPlusCode } from "@/lib/plus-code"
import { planDay, type DayPlan, type DispatchParams } from "@/lib/dispatch"
import { getWorkbenchSettings } from "@/lib/workbench-settings"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// 一天几场摆到地图上，并算出最少要几个师傅、谁接谁（老板 2026-09-29）。
// 判断规则和它为什么这么写，见 lib/dispatch.ts。
//
// 默认全程免 key：地址用 Nominatim（地址补全本来就在用），车程用 OSRM，底图用 OSM 的
// 瓦片。坐标查过就存进 address_geo——Nominatim 每秒只准问一次，老板来回点几下就撞
// 配额了，而地址不会自己搬家。
//
// 车程有两个来源：
//   · OSRM —— 免费，但给的是不堵车的理想值。
//   · Google —— 带上师傅**实际出发的那个时刻**，返回按那个时段预测的路况。这类调用
//     走 Google 更贵的计费档，所以挂在 设置 → 派工 的开关后面，默认关。
// Google 任何一步失败都整体退回 OSRM，不把两个来源的数字混在一张图里。

const OSRM_TABLE = "https://router.project-osrm.org/table/v1/driving"
const GOOGLE_MATRIX = "https://maps.googleapis.com/maps/api/distancematrix/json"
const METERS_PER_MILE = 1609.344
const UA = "RealHibachi-Marketing/1.0 (support@realhibachi.com)"

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

type Matrix = { minutes: Array<Array<number | null>>; miles: Array<Array<number | null>> }
type DriveSource = "google_traffic" | "google" | "osrm" | "none"

const norm = (a: string) => a.trim().replace(/\s+/g, " ").toLowerCase()

type Located = { lat: number; lng: number; label: string; approx?: boolean }

const safeGeocode = async (q: string) => {
  try {
    return await geocode(q)
  } catch {
    return null
  }
}

/** 只写了城市、没写门牌（"Indio"、"La Quinta"）——定位得到，但图钉是市中心不是客人家。 */
const streetless = (a: string) => !parseLatLng(a) && !parsePlusCode(a) && !/\d/.test(a.split(",")[0] ?? "")

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

// ---------------------------------------------------------------- 车程

type Pt = { lat: number; lng: number }

const empty = (n: number): Matrix => ({
  minutes: Array.from({ length: n }, () => new Array<number | null>(n).fill(null)),
  miles: Array.from({ length: n }, () => new Array<number | null>(n).fill(null)),
})

/** 一次调用拿全部两两车程，不是 n² 次路径查询——五个点就是 20 条腿，一条条问会被限流。 */
async function osrmMatrix(points: Pt[]): Promise<Matrix | null> {
  if (points.length < 2) return empty(points.length)
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";")
  try {
    const res = await fetch(`${OSRM_TABLE}/${coords}?annotations=duration,distance`, { headers: { "User-Agent": UA }, cache: "no-store" })
    if (!res.ok) return null
    const j = (await res.json()) as { code?: string; durations?: Array<Array<number | null>>; distances?: Array<Array<number | null>> }
    if (j.code !== "Ok" || !j.durations) return null
    const out = empty(points.length)
    for (let i = 0; i < points.length; i++) {
      for (let k = 0; k < points.length; k++) {
        const sec = j.durations[i]?.[k]
        const m = j.distances?.[i]?.[k]
        if (typeof sec === "number") out.minutes[i][k] = Math.round(sec / 60)
        if (typeof m === "number") out.miles[i][k] = Math.round((m / METERS_PER_MILE) * 10) / 10
      }
    }
    return out
  } catch {
    return null
  }
}

/**
 * Google 的车程，每个出发点单独问一次：出发时刻因人而异（上一场几点收完摊，师傅就
 * 几点上路），而一次请求只能带一个出发时刻。
 *
 * 只问"往后接"的那些目的地——往回开的腿排班用不上，问了白花钱。
 * 出发时刻已经过去的（回看昨天）Google 不接受，那一行就不带时刻、拿不含路况的数。
 */
async function googleMatrix(
  points: Pt[],
  starts: number[],
  departMs: number[],
  apiKey: string,
): Promise<{ matrix: Matrix; traffic: boolean } | { error: string }> {
  const n = points.length
  const out = empty(n)
  let allTraffic = true
  const now = Date.now()
  try {
    for (let i = 0; i < n; i++) {
      const later = points.map((_, k) => k).filter((k) => k !== i && starts[k] > starts[i])
      if (later.length === 0) continue
      const params = new URLSearchParams({
        origins: `${points[i].lat},${points[i].lng}`,
        destinations: later.map((k) => `${points[k].lat},${points[k].lng}`).join("|"),
        units: "imperial",
        key: apiKey,
      })
      const future = departMs[i] > now + 60_000
      if (future) params.set("departure_time", String(Math.floor(departMs[i] / 1000)))
      else allTraffic = false
      const res = await fetch(`${GOOGLE_MATRIX}?${params}`, { cache: "no-store" })
      if (!res.ok) return { error: `HTTP ${res.status}` }
      const j = (await res.json()) as {
        status?: string
        error_message?: string
        rows?: Array<{ elements?: Array<{ status?: string; duration?: { value?: number }; duration_in_traffic?: { value?: number }; distance?: { value?: number } }> }>
      }
      // Google 自己说的拒绝理由原样带出去——猜"多半是没开通"没有用，
      // REQUEST_DENIED 背后可能是没开通、没绑账单、或者 key 限了来源，修法各不相同。
      if (j.status !== "OK") return { error: `${j.status ?? "UNKNOWN"}${j.error_message ? ` — ${j.error_message}` : ""}` }
      const els = j.rows?.[0]?.elements ?? []
      for (let x = 0; x < later.length; x++) {
        const el = els[x]
        if (!el || el.status !== "OK") continue
        const sec = el.duration_in_traffic?.value ?? el.duration?.value
        if (typeof sec === "number") out.minutes[i][later[x]] = Math.round(sec / 60)
        if (typeof el.distance?.value === "number") out.miles[i][later[x]] = Math.round((el.distance.value / METERS_PER_MILE) * 10) / 10
        if (future && typeof el.duration_in_traffic?.value !== "number") allTraffic = false
      }
    }
    return { matrix: out, traffic: allTraffic }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "network error" }
  }
}

/** PT 的墙上时间 → 真实时刻。订单存的是墙上时间（按 UTC 写入），Google 要的是真实时刻。 */
function ptInstantMs(date: string, minutesOfDay: number): number {
  const asUtc = Date.parse(`${date}T00:00:00Z`) + minutesOfDay * 60_000
  const tz =
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", timeZoneName: "shortOffset" })
      .formatToParts(new Date(asUtc))
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT-8"
  const m = /GMT([+-]\d{1,2})(?::(\d{2}))?/.exec(tz)
  const offsetMin = m ? Number(m[1]) * 60 + (m[2] ? Math.sign(Number(m[1])) * Number(m[2]) : 0) : -480
  return asUtc - offsetMin * 60_000
}

// 同一天的图来回开（每次「定位」都会重载），别每次都去问一遍路——尤其是按次计费的那家。
const driveCache = new Map<string, { at: number; matrix: Matrix; source: DriveSource; note: string | null }>()
const DRIVE_TTL_MS = 15 * 60_000

const clock = (minutesOfDay: number) => {
  const h = Math.floor(minutesOfDay / 60) % 24
  const m = minutesOfDay % 60
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`
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

  type StopRow = {
    id: string
    orderNo: string
    name: string
    phone: string | null
    address: string
    time: string
    startMin: number
    guests: number
    lat: number | null
    lng: number | null
    approx: boolean
  }
  const stops: StopRow[] = []
  for (const r of rows) {
    const addr = (r.event_address ?? "").trim()
    const geo = addr ? await locate(supabase, addr) : null
    const t = r.event_start ? new Date(r.event_start) : null
    const startMin = t ? t.getUTCHours() * 60 + t.getUTCMinutes() : 0
    stops.push({
      id: r.id,
      orderNo: r.order_no,
      name: (r.customer_name ?? "").trim() || "未留名",
      phone: r.customer_phone ?? null,
      address: addr,
      time: clock(startMin),
      startMin,
      guests: (r.guest_adult_count ?? 0) + (r.guest_child_count ?? 0),
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      // 图钉不是门口的两种情况：查不到街道退到了城市，或者地址本来就只写了城市。
      // 手工定位过的不算。
      approx: !!geo && (!!geo.approx || (streetless(addr) && !geo.label.includes("手工定位"))),
    })
  }

  const settings = await getWorkbenchSettings()
  const dp = settings.dispatch
  const params: DispatchParams = {
    busyMinMinutes: dp.busy_min_minutes,
    busyMaxMinutes: dp.busy_max_minutes,
    arriveEarlyMinutes: dp.arrive_early_minutes,
  }

  // 车程只在定位到的场次之间算；定位不到的那几场各占一个师傅。
  const placedIdx = stops.map((s, i) => (s.lat !== null && s.lng !== null ? i : -1)).filter((i) => i >= 0)
  const pts = placedIdx.map((i) => ({ lat: stops[i].lat as number, lng: stops[i].lng as number }))
  const startsPlaced = placedIdx.map((i) => stops[i].startMin)

  let source: DriveSource = "none"
  let note: string | null = null
  let small: Matrix = empty(pts.length)

  if (pts.length >= 2) {
    const wantGoogle = settings.dispatch.google_traffic && !!process.env.GOOGLE_MAPS_API_KEY
    const cacheKey = JSON.stringify([date, wantGoogle, pts, startsPlaced, params])
    const cached = driveCache.get(cacheKey)
    if (cached && Date.now() - cached.at < DRIVE_TTL_MS) {
      small = cached.matrix
      source = cached.source
      note = cached.note
    } else {
      if (wantGoogle) {
        // 师傅上路的时刻：开场后 90–120 分钟之间，取中间那个点去问路况。
        const depart = startsPlaced.map((s) => ptInstantMs(date, s + Math.round((params.busyMinMinutes + params.busyMaxMinutes) / 2)))
        const g = await googleMatrix(pts, startsPlaced, depart, process.env.GOOGLE_MAPS_API_KEY as string)
        if ("matrix" in g) {
          small = g.matrix
          source = g.traffic ? "google_traffic" : "google"
        } else {
          note = `Google 拒了：${g.error}。这次用的是不含堵车的车程。`
        }
      } else if (settings.dispatch.google_traffic) {
        note = "开了 Google 路况，但服务器上没配 GOOGLE_MAPS_API_KEY"
      }
      if (source === "none") {
        const o = await osrmMatrix(pts)
        if (o) {
          small = o
          source = "osrm"
        } else {
          note = "车程没算出来（路线服务没响应），下面的排班只能当每场各派一个师傅"
        }
      }
      // 想要 Google 却退回了 OSRM 的这次不缓存：老板去后台把 key 修好之后，
      // 下一次打开就该立刻用上，而不是再看 15 分钟的旧结果。
      const degraded = wantGoogle && source === "osrm"
      if (source !== "none" && !degraded) driveCache.set(cacheKey, { at: Date.now(), matrix: small, source, note })
    }
  }

  // 摊回全部场次的下标：planDay 看的是"当天所有场次"，定位不到的那几行全是 null。
  const n = stops.length
  const minutes = Array.from({ length: n }, () => new Array<number | null>(n).fill(null))
  const miles = Array.from({ length: n }, () => new Array<number | null>(n).fill(null))
  placedIdx.forEach((gi, a) => placedIdx.forEach((gk, b) => {
    minutes[gi][gk] = small.minutes[a]?.[b] ?? null
    miles[gi][gk] = small.miles[a]?.[b] ?? null
  }))

  // 三档容忍度各排一版。"省一个师傅"要付什么代价，让老板自己看、自己定——
  // 接不接一条可能迟到的衔接是他的风险决定，不是算法替他决定。
  const startsAll = stops.map((s) => s.startMin)
  const tiers: Array<{ key: "safe" | "late_ok" | "late_limit"; tolerance: number }> = [
    { key: "safe", tolerance: 0 },
    { key: "late_ok", tolerance: dp.late_ok_minutes },
    { key: "late_limit", tolerance: dp.late_limit_minutes },
  ]
  const plans: Array<{ key: string; plan: DayPlan }> = []
  for (const t of tiers) {
    const plan = planDay(startsAll, minutes, params, t.tolerance, dp.late_ok_minutes)
    // 更冒险却没省下师傅的排法不给——那是白担风险。
    if (plans.length > 0 && plan.chefs >= plans[plans.length - 1].plan.chefs) continue
    plans.push({ key: t.key, plan })
  }

  const ceil5 = (m: number) => Math.ceil(m / 5) * 5
  const floor5 = (m: number) => Math.floor(m / 5) * 5
  const home = await locate(supabase, HOME_BASE_QUERY)

  return NextResponse.json({
    ok: true,
    date,
    stops: stops.map(({ startMin: _startMin, ...s }) => s),
    // 定位不到的单要点名，不能默默从地图上消失——那样看起来就像那天没这一场。
    missing: stops.filter((s) => s.lat === null).map((s) => ({ name: s.name, address: s.address })),
    home: home ? { lat: home.lat, lng: home.lng, label: "家（出发点）" } : null,
    plans: plans.map(({ key, plan }) => ({
      key,
      tolerance: plan.tolerance,
      chefs: plan.chefs,
      chains: plan.chains.map((c) => c.map((i) => stops[i].id)),
      links: plan.links.map((l) => {
        // 想让这一条稳下来（拖满也能提前到），得挪出多少分钟
        const need = l.worstLate + params.arriveEarlyMinutes
        // 只有师傅当天的第一台才提前得了——老板原话：第一台可以很早过去布置好，
        // 人齐了就提前开。链中间的那一场自己都可能晚开，谈不上提前。
        const isHead = plan.chains.some((c) => c[0] === l.from)
        return {
          fromId: stops[l.from].id,
          toId: stops[l.to].id,
          minutes: l.driveMinutes,
          miles: miles[l.from][l.to],
          bestLate: l.bestLate,
          worstLate: l.worstLate,
          grade: l.grade,
          fix:
            need > 0
              ? {
                  minutes: need,
                  laterStart: clock(ceil5(stops[l.to].startMin + need)),
                  earlierStart: isHead ? clock(floor5(stops[l.from].startMin - need)) : null,
                }
              : null,
        }
      }),
    })),
    params: {
      busyMin: params.busyMinMinutes,
      busyMax: params.busyMaxMinutes,
      arriveEarly: params.arriveEarlyMinutes,
      lateOk: dp.late_ok_minutes,
      lateLimit: dp.late_limit_minutes,
    },
    source,
    note,
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
  // 这个地址的坐标变了，之前算过的车程作废。
  driveCache.clear()
  return NextResponse.json({ ok: true, lat: pt.lat, lng: pt.lng })
}
