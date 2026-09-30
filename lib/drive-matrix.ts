// 两两车程（2026-09-29 从日历地图的路由里抽出来，给分享出去的排班页共用）。
//
// 两个来源：
//   · OSRM —— 免费，给的是不堵车的理想值。分享页只用它（老板定的：分享出去的走免费的）。
//   · Google —— 带上师傅**实际出发的那个时刻**，返回按那个时段预测的路况。日历地图在
//     设置 → 派工 的开关打开时用它。

const OSRM_TABLE = "https://router.project-osrm.org/table/v1/driving"
const GOOGLE_MATRIX = "https://maps.googleapis.com/maps/api/distancematrix/json"
const METERS_PER_MILE = 1609.344
const UA = "RealHibachi-Marketing/1.0 (support@realhibachi.com)"

export type Pt = { lat: number; lng: number }
export type Matrix = { minutes: Array<Array<number | null>>; miles: Array<Array<number | null>> }

export const emptyMatrix = (n: number): Matrix => ({
  minutes: Array.from({ length: n }, () => new Array<number | null>(n).fill(null)),
  miles: Array.from({ length: n }, () => new Array<number | null>(n).fill(null)),
})

/** 一次调用拿全部两两车程，不是 n² 次路径查询——五个点就是 20 条腿，一条条问会被限流。 */
export async function osrmMatrix(points: Pt[]): Promise<Matrix | null> {
  if (points.length < 2) return emptyMatrix(points.length)
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";")
  try {
    const res = await fetch(`${OSRM_TABLE}/${coords}?annotations=duration,distance`, { headers: { "User-Agent": UA }, cache: "no-store" })
    if (!res.ok) return null
    const j = (await res.json()) as { code?: string; durations?: Array<Array<number | null>>; distances?: Array<Array<number | null>> }
    if (j.code !== "Ok" || !j.durations) return null
    const out = emptyMatrix(points.length)
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
export async function googleMatrix(
  points: Pt[],
  starts: number[],
  departMs: number[],
  apiKey: string,
): Promise<{ matrix: Matrix; traffic: boolean } | { error: string }> {
  const n = points.length
  const out = emptyMatrix(n)
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
export function ptInstantMs(date: string, minutesOfDay: number): number {
  const asUtc = Date.parse(`${date}T00:00:00Z`) + minutesOfDay * 60_000
  const tz =
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", timeZoneName: "shortOffset" })
      .formatToParts(new Date(asUtc))
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT-8"
  const m = /GMT([+-]\d{1,2})(?::(\d{2}))?/.exec(tz)
  const offsetMin = m ? Number(m[1]) * 60 + (m[2] ? Math.sign(Number(m[1])) * Number(m[2]) : 0) : -480
  return asUtc - offsetMin * 60_000
}
