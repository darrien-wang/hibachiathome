import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { makeResolver, streetless } from "@/lib/address-resolve"
import { osrmMatrix } from "@/lib/drive-matrix"
import { MAX_STOPS } from "@/lib/schedule-parse"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
// 15 个地址、每个最多 3 次 Nominatim（地址 → 城市 → 邮编）、每次间隔 1.1 秒，最坏将近一分钟。
export const maxDuration = 120

// 分享出去的排班计算器（老板 2026-09-29）。
//
// 凭链接里的 token 用，老板在 工作台 → 设置 里发链接、定每天几次、随时收回。
//
// 这个接口只干要联网的那一步：地址 → 坐标 → 两两车程。**排班算法在对方浏览器里跑**
// （lib/dispatch.ts 是纯函数），所以对方调"服务多久""能容忍迟到多久"不会再打到这里，
// 秒出、不占次数。
//
// 老板定的：
//   · 只走免费的 OpenStreetMap（Nominatim 查地址、OSRM 算车程）——不花他 Google 的钱。
//     代价是沙漠区一些街道 OSM 没有，会退到城市标"只到城市"；页面上教对方贴 Plus Code。
//   · 对方的场次**要存**（2026-09-30 改，原来是不存）：以后合作可能要换单，得知道同行
//     哪天、几点、在哪、多少人。存在 schedule_share_stops，同一链接同一天只留最新一次；
//     页面上明写"会存"。不写 address_geo——那是我们自己订单的定位缓存，分开放。
//   · 碰不到老板的订单——这里只认对方粘进来的东西。

const TODAY_TZ = "America/Los_Angeles"
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: TODAY_TZ })

type LinkRow = { id: string; name: string; daily_limit: number; revoked_at: string | null }

async function findLink(token: string): Promise<LinkRow | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null
  const supabase = createServerSupabaseClient()
  if (!supabase) return null
  const { data } = await supabase.from("schedule_share_links").select("id, name, daily_limit, revoked_at").eq("token", token).maybeSingle()
  const row = data as LinkRow | null
  return row && !row.revoked_at ? row : null
}

async function usedToday(linkId: string): Promise<number> {
  const supabase = createServerSupabaseClient()
  if (!supabase) return 0
  const { data } = await supabase.from("schedule_share_usage").select("runs").eq("link_id", linkId).eq("day", today()).maybeSingle()
  return Number((data as { runs?: number } | null)?.runs ?? 0)
}

const deny = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status, headers: { "cache-control": "no-store" } })

/** GET ?t=token —— 页面打开时核一下链接还有效、今天还剩几次。 */
export async function GET(request: NextRequest) {
  const link = await findLink((request.nextUrl.searchParams.get("t") ?? "").trim())
  if (!link) return deny(404, "链接无效或已收回")
  const used = await usedToday(link.id)
  return NextResponse.json(
    { ok: true, name: link.name, dailyLimit: link.daily_limit, usedToday: used, maxStops: MAX_STOPS },
    { headers: { "cache-control": "no-store" } },
  )
}

type InStop = { address?: unknown; name?: unknown; startMin?: unknown; guests?: unknown; lat?: unknown; lng?: unknown; approx?: unknown }

const DAY_MS = 86_400_000

/**
 * POST { t, date, stops: [{ address, name?, startMin, guests?, lat?, lng?, approx? }] }
 *   → { stops: [{ lat, lng, approx, found }], minutes[][], miles[][], saved }
 *
 * 对方改了几行再算时，没改的那几行把上次的坐标带回来，这里就不再查——省时间，也少打扰
 * Nominatim。带回来的坐标只影响对方自己的结果，所以不用验真。
 *
 * 算完把这一天的场次存进 schedule_share_stops（老板 2026-09-30 改的：要存，以后合作换单用）。
 * 同一个链接、同一天再算一次，就用最新的覆盖。页面上写明了会存。
 */
export async function POST(request: NextRequest) {
  let body: { t?: unknown; date?: unknown; stops?: unknown }
  try {
    body = (await request.json()) as { t?: unknown; date?: unknown; stops?: unknown }
  } catch {
    return deny(400, "invalid json")
  }
  const link = await findLink(typeof body.t === "string" ? body.t.trim() : "")
  if (!link) return deny(404, "链接无效或已收回")

  // 哪一天：换单要按日期对，没有日期存下来也用不上
  const date = typeof body.date === "string" ? body.date.trim() : ""
  const dayMs = /^\d{4}-\d{2}-\d{2}$/.test(date) ? Date.parse(`${date}T12:00:00Z`) : NaN
  const todayMs = Date.parse(`${today()}T12:00:00Z`)
  if (!Number.isFinite(dayMs) || dayMs < todayMs - 400 * DAY_MS || dayMs > todayMs + 730 * DAY_MS) return deny(400, "先填上是哪天")

  const raw = Array.isArray(body.stops) ? (body.stops as InStop[]) : []
  if (raw.length === 0) return deny(400, "没有地址")
  if (raw.length > MAX_STOPS) return deny(400, `一次最多 ${MAX_STOPS} 场`)
  const rows = raw.map((s) => {
    const startMin = Math.round(Number(s.startMin))
    const guests = Math.round(Number(s.guests))
    return {
      address: typeof s.address === "string" ? s.address.trim().slice(0, 300) : "",
      name: typeof s.name === "string" ? s.name.trim().slice(0, 120) || null : null,
      startMin: Number.isFinite(startMin) && startMin >= 0 && startMin < 1440 ? startMin : null,
      guests: s.guests !== null && Number.isFinite(guests) && guests >= 1 && guests <= 999 ? guests : null,
    }
  })
  if (rows.some((r) => !r.address || r.startMin === null)) return deny(400, "每一场都要有开场时间和地址")

  const supabase = createServerSupabaseClient()
  if (!supabase) return deny(500, "not configured")
  const { data: ok } = await supabase.rpc("schedule_share_take", { p_link: link.id, p_day: today(), p_stops: raw.length, p_limit: link.daily_limit })
  if (ok !== true) return deny(429, `今天的 ${link.daily_limit} 次用完了，明天再来。改服务时长、容忍迟到这些参数不占次数。`)

  // 这个链接以前存过的同一个地址，直接用上次的坐标，不再去问 Nominatim
  const { data: prior } = await supabase
    .from("schedule_share_stops")
    .select("address, lat, lng, approx")
    .eq("link_id", link.id)
    .eq("found", true)
    .in("address", Array.from(new Set(rows.map((r) => r.address))))
    .order("saved_at", { ascending: false })
    .limit(200)
  const priorOf = new Map<string, { lat: number; lng: number; approx: boolean }>()
  for (const r of (prior ?? []) as Array<{ address: string; lat: number | null; lng: number | null; approx: boolean }>) {
    if (!priorOf.has(r.address) && r.lat !== null && r.lng !== null) priorOf.set(r.address, { lat: r.lat, lng: r.lng, approx: r.approx })
  }

  const resolver = makeResolver({ googleKey: null, noStore: true, paceMs: 1100 })
  const stops: Array<{ lat: number | null; lng: number | null; approx: boolean; found: boolean }> = []
  for (let i = 0; i < raw.length; i++) {
    const s = raw[i]
    const address = rows[i].address
    const lat = Number(s.lat)
    const lng = Number(s.lng)
    if (s.lat !== undefined && s.lng !== undefined && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      stops.push({ lat, lng, approx: s.approx === true, found: true })
      continue
    }
    const before = priorOf.get(address)
    if (before) {
      stops.push({ ...before, found: true })
      continue
    }
    const hit = await resolver.resolve(address)
    stops.push(
      hit
        ? { lat: hit.lat, lng: hit.lng, approx: !!hit.approx || streetless(address), found: true }
        : { lat: null, lng: null, approx: false, found: false },
    )
  }

  // 存下来（同一链接同一天覆盖）。存失败不挡对方的结果——他要的是排班。
  const { data: saved } = await supabase.rpc("schedule_share_save", {
    p_link: link.id,
    p_date: date,
    p_stops: rows.map((r, i) => ({ ...r, lat: stops[i].lat, lng: stops[i].lng, approx: stops[i].approx, found: stops[i].found })),
  })

  // 车程只在定位到的点之间算，再摊回全部下标——定位不到的那几行全是 null。
  const placed = stops.map((s, i) => (s.lat !== null && s.lng !== null ? i : -1)).filter((i) => i >= 0)
  const n = stops.length
  const minutes = Array.from({ length: n }, () => new Array<number | null>(n).fill(null))
  const miles = Array.from({ length: n }, () => new Array<number | null>(n).fill(null))
  let matrixOk = true
  if (placed.length >= 2) {
    const m = await osrmMatrix(placed.map((i) => ({ lat: stops[i].lat as number, lng: stops[i].lng as number })))
    if (!m) matrixOk = false
    else
      placed.forEach((gi, a) =>
        placed.forEach((gk, b) => {
          minutes[gi][gk] = m.minutes[a]?.[b] ?? null
          miles[gi][gk] = m.miles[a]?.[b] ?? null
        }),
      )
  }

  return NextResponse.json(
    { ok: true, stops, minutes, miles, matrixOk, saved: typeof saved === "number" ? saved : null, usedToday: await usedToday(link.id), dailyLimit: link.daily_limit },
    { headers: { "cache-control": "no-store" } },
  )
}
