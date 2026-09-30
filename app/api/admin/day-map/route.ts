import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase"
import { HOME_BASE_QUERY } from "@/config/home-base"
import { decodePlusCode, parseLatLng, parsePlusCode, recoverPlusCode } from "@/lib/plus-code"
import { planTiers, type DispatchParams } from "@/lib/dispatch"
import { makeResolver, streetless, type Located } from "@/lib/address-resolve"
import { emptyMatrix, googleMatrix, osrmMatrix, ptInstantMs, type Matrix } from "@/lib/drive-matrix"
import { geocode } from "@/lib/travel-distance"
import { getWorkbenchSettings } from "@/lib/workbench-settings"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// 一天几场摆到地图上，并算出最少要几个师傅、谁接谁（老板 2026-09-29）。
// 判断规则和它为什么这么写，见 lib/dispatch.ts。地址怎么查见 lib/address-resolve.ts，
// 车程怎么算见 lib/drive-matrix.ts——这两块和分享出去的排班页（/tools/schedule）共用。
//
// 这里多的一层是缓存：坐标查过就存进 address_geo——Nominatim 每秒只准问一次，Google
// 按次计费，而地址不会自己搬家。分享页不走这一层，它什么都不存。
//
// 车程在 设置 → 派工 的开关打开时走 Google（按师傅出发时刻预测路况），否则 OSRM。
// Google 任何一步失败都整体退回 OSRM，不把两个来源的数字混在一张图里。

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

type DriveSource = "google_traffic" | "google" | "osrm" | "none"

const norm = (a: string) => a.trim().replace(/\s+/g, " ").toLowerCase()

const safeGeocode = async (q: string) => {
  try {
    return await geocode(q)
  } catch {
    return null
  }
}

/**
 * 带缓存的地址解析。精确的、手工钉的、Google 已经试过的，都直接用缓存；剩下的是
 * "只到城市"或"查不到"而且 Google 还没试过——接上 Google 之前存的那批，值得再给一次
 * 机会，否则它们会永远停在市中心。
 */
async function locate(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  resolver: ReturnType<typeof makeResolver>,
  address: string,
): Promise<Located | null> {
  const key = norm(address)
  if (!key) return null
  const gkey = process.env.GOOGLE_MAPS_API_KEY ?? ""
  if (supabase) {
    const { data } = await supabase.from("address_geo").select("lat, lng, label, found").eq("query", key).maybeSingle()
    if (data) {
      const row = data as { lat: number | null; lng: number | null; label: string | null; found: boolean }
      const label = row.label ?? ""
      const precise = row.found && row.lat !== null && row.lng !== null && !label.startsWith("~")
      const settled = precise || label.includes("手工定位") || label.includes("google:") || !gkey
      if (settled) {
        return row.found && row.lat !== null && row.lng !== null
          ? { lat: row.lat, lng: row.lng, label: row.label ?? address, approx: label.startsWith("~") }
          : null
      }
    }
  }

  const hit = await resolver.resolve(address)

  if (supabase) {
    await supabase
      .from("address_geo")
      .upsert({
        query: key,
        lat: hit?.lat ?? null,
        lng: hit?.lng ?? null,
        // Google 试过但没帮上忙的也要记下来（"google:miss"），不然下次打开还会再问一遍。
        label: hit ? (gkey && !hit.label.includes("google:") ? `${hit.label} · google:miss` : hit.label) : gkey ? "google:miss" : null,
        found: !!hit,
        geocoded_at: new Date().toISOString(),
      })
      .select("query")
  }
  return hit
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
  const resolver = makeResolver({ googleKey: process.env.GOOGLE_MAPS_API_KEY || null })
  const stops: StopRow[] = []
  for (const r of rows) {
    const addr = (r.event_address ?? "").trim()
    const geo = addr ? await locate(supabase, resolver, addr) : null
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
  let small: Matrix = emptyMatrix(pts.length)

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

  // 三档容忍度各排一版，再加多派的几版（见 lib/dispatch.ts planTiers）。
  const plans = planTiers(stops.map((s) => s.startMin), minutes, params, dp.late_ok_minutes, dp.late_limit_minutes)
  const home = await locate(supabase, resolver, HOME_BASE_QUERY)

  // 指派（老板 2026-09-30）：图上直接给每条线派师傅。这里带上每单现在派给了谁、能派的师傅名单；
  // 写入走 /api/admin/chefs 的 assign，和订单弹窗、厨师页是同一套。
  const ACTIVE = ["tentative", "confirmed", "completed"]
  const [{ data: asg }, { data: staff }] = await Promise.all([
    rows.length
      ? supabase.from("order_staff_assignments").select("order_id, staff_member_id").in("order_id", rows.map((r) => r.id)).in("assignment_status", ACTIVE)
      : Promise.resolve({ data: [] as Array<{ order_id: string; staff_member_id: string }> }),
    supabase.from("staff_members").select("id, display_name, full_name, status, is_bookable").neq("status", "deleted").order("display_name", { ascending: true }),
  ])
  const chefIdsOf = new Map<string, string[]>()
  for (const a of (asg ?? []) as Array<{ order_id: string; staff_member_id: string }>) {
    chefIdsOf.set(a.order_id, [...(chefIdsOf.get(a.order_id) ?? []), a.staff_member_id])
  }
  const chefs = ((staff ?? []) as Array<{ id: string; display_name: string | null; full_name: string | null; status: string | null; is_bookable: boolean | null }>).map((s) => ({
    id: s.id,
    name: (s.display_name ?? s.full_name ?? "").trim() || "未命名",
    active: s.status === "active" && s.is_bookable !== false,
  }))

  return NextResponse.json({
    ok: true,
    date,
    stops: stops.map(({ startMin: _startMin, ...s }) => ({ ...s, chefIds: chefIdsOf.get(s.id) ?? [] })),
    chefs,
    // 定位不到的单要点名，不能默默从地图上消失——那样看起来就像那天没这一场。
    missing: stops.filter((s) => s.lat === null).map((s) => ({ name: s.name, address: s.address })),
    home: home ? { lat: home.lat, lng: home.lng, label: "家（出发点）" } : null,
    plans: plans.map((plan) => ({
      key: plan.key,
      tolerance: plan.tolerance,
      chefs: plan.chefs,
      spread: plan.spread,
      onePerParty: plan.onePerParty,
      chains: plan.chains.map((c) => c.map((i) => stops[i].id)),
      links: plan.links.map((l) => ({
        fromId: stops[l.from].id,
        toId: stops[l.to].id,
        minutes: l.driveMinutes,
        miles: miles[l.from][l.to],
        bestLate: l.bestLate,
        worstLate: l.worstLate,
        grade: l.grade,
        fix: l.fix ? { minutes: l.fix.minutes, laterStart: clock(l.fix.laterStartMin), earlierStart: l.fix.earlierStartMin === null ? null : clock(l.fix.earlierStartMin) } : null,
      })),
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
