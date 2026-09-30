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
// 老板定的三条：
//   · 只走免费的 OpenStreetMap（Nominatim 查地址、OSRM 算车程）——不花他 Google 的钱。
//     代价是沙漠区一些街道 OSM 没有，会退到城市标"只到城市"；页面上教对方贴 Plus Code。
//   · 不存对方的地址。不写 address_geo，也不让平台缓存这次查询（noStore）。
//     只记"哪个链接、哪天、几次、几个点"。
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

type InStop = { address?: unknown; lat?: unknown; lng?: unknown; approx?: unknown }

/**
 * POST { t, stops: [{ address, lat?, lng?, approx? }] }
 *   → { stops: [{ lat, lng, approx, found }], minutes[][], miles[][] }
 *
 * 对方改了几行再算时，没改的那几行把上次的坐标带回来，这里就不再查——省时间，也少打扰
 * Nominatim。带回来的坐标只影响对方自己的结果，所以不用验真。
 */
export async function POST(request: NextRequest) {
  let body: { t?: unknown; stops?: unknown }
  try {
    body = (await request.json()) as { t?: unknown; stops?: unknown }
  } catch {
    return deny(400, "invalid json")
  }
  const link = await findLink(typeof body.t === "string" ? body.t.trim() : "")
  if (!link) return deny(404, "链接无效或已收回")

  const raw = Array.isArray(body.stops) ? (body.stops as InStop[]) : []
  if (raw.length === 0) return deny(400, "没有地址")
  if (raw.length > MAX_STOPS) return deny(400, `一次最多 ${MAX_STOPS} 场`)

  const supabase = createServerSupabaseClient()
  if (!supabase) return deny(500, "not configured")
  const { data: ok } = await supabase.rpc("schedule_share_take", { p_link: link.id, p_day: today(), p_stops: raw.length, p_limit: link.daily_limit })
  if (ok !== true) return deny(429, `今天的 ${link.daily_limit} 次用完了，明天再来。改服务时长、容忍迟到这些参数不占次数。`)

  const resolver = makeResolver({ googleKey: null, noStore: true, paceMs: 1100 })
  const stops: Array<{ lat: number | null; lng: number | null; approx: boolean; found: boolean }> = []
  for (const s of raw) {
    const address = typeof s.address === "string" ? s.address.trim().slice(0, 300) : ""
    const lat = Number(s.lat)
    const lng = Number(s.lng)
    if (s.lat !== undefined && s.lng !== undefined && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      stops.push({ lat, lng, approx: s.approx === true, found: true })
      continue
    }
    const hit = address ? await resolver.resolve(address) : null
    stops.push(
      hit
        ? { lat: hit.lat, lng: hit.lng, approx: !!hit.approx || streetless(address), found: true }
        : { lat: null, lng: null, approx: false, found: false },
    )
  }

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
    { ok: true, stops, minutes, miles, matrixOk, usedToday: await usedToday(link.id), dailyLimit: link.daily_limit },
    { headers: { "cache-control": "no-store" } },
  )
}
