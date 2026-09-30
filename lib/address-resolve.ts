// 地址 → 坐标（2026-09-29 从日历地图的路由里抽出来，给分享出去的排班页共用）。
//
// 按"最可信的先试"排：
//   1. 粘进来的坐标 / Plus Code —— 它本身就是坐标，不用查任何服务，最准也最快。
//   2. Google（配了 key 才走）—— OSM 认不出的街道它多半认得，沙漠区的度假屋尤其
//      （Stargate、Evangeline Way 都是 OSM 没有、Google 一查就有）。
//   3. Nominatim（OSM）查完整地址。
//   4. 查不到就退到城市或邮编，标成 approx——但要核对拿回来的是不是那个地方。
//
// 第 4 步是有意的："大概在 Yucca Valley"对排班已经够用了——要判断的是能不能连做两场，
// 不是门牌号。从地图上消失反而更糟：看起来像那天没这一场。
//
// 这里只管"怎么查"，不管缓存：日历地图把结果存进 address_geo，分享页什么都不存。

import { geocode } from "@/lib/travel-distance"
import { decodePlusCode, parseLatLng, parsePlusCode, recoverPlusCode } from "@/lib/plus-code"

export type Located = { lat: number; lng: number; label: string; approx?: boolean }

export type ResolveOptions = {
  /** 有就先问 Google。分享页一律不给（老板 2026-09-29 定：分享出去的走免费的 OSM）。 */
  googleKey?: string | null
  /** 不让平台缓存这次查询——分享页承诺不留别人客户的地址，平台那层也算。 */
  noStore?: boolean
  /** 两次 Nominatim 请求之间至少隔多久。它的使用条款是每秒最多一次。 */
  paceMs?: number
}

/** 只写了城市、没写门牌（"Indio"、"La Quinta"）——定位得到，但图钉是市中心不是客人家。 */
export const streetless = (a: string) => !parseLatLng(a) && !parsePlusCode(a) && !/\d/.test(a.split(",")[0] ?? "")

/**
 * Google 的地址解析。ROOFTOP / RANGE_INTERPOLATED 是门口级别；GEOMETRIC_CENTER /
 * APPROXIMATE 或 partial_match 只是个大概，照样标 approx。label 带 "google:" 是给
 * 调用方的缓存用的：知道 Google 已经试过了，别每次都再问一遍。
 */
async function googleGeocode(address: string, key: string): Promise<Located | null> {
  try {
    const params = new URLSearchParams({ address, region: "us", key })
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`, { cache: "no-store" })
    const j = (await res.json()) as {
      status?: string
      results?: Array<{ formatted_address?: string; partial_match?: boolean; geometry?: { location?: { lat: number; lng: number }; location_type?: string } }>
    }
    if (j.status !== "OK") return null
    const r = j.results?.[0]
    const loc = r?.geometry?.location
    if (!r || !loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return null
    const approx = r.partial_match === true || !/^(ROOFTOP|RANGE_INTERPOLATED)$/.test(r.geometry?.location_type ?? "")
    return { lat: loc.lat, lng: loc.lng, label: `${approx ? "~" : ""}google: ${r.formatted_address ?? address}`, approx }
  } catch {
    return null
  }
}

/**
 * 一个解析器实例 = 一次请求。实例里记着上一次问 Nominatim 的时刻，好把间隔拉开。
 */
export function makeResolver(opts: ResolveOptions = {}) {
  let lastNominatim = 0
  const nominatim = async (q: string) => {
    if (opts.paceMs) {
      const wait = lastNominatim + opts.paceMs - Date.now()
      if (wait > 0) await new Promise((r) => setTimeout(r, wait))
      lastNominatim = Date.now()
    }
    try {
      return await geocode(q, { noStore: opts.noStore })
    } catch {
      return null
    }
  }

  async function resolve(address: string): Promise<Located | null> {
    const a = (address ?? "").trim()
    if (!a) return null

    // 1. 直接就是坐标或 Plus Code
    const pin = parseLatLng(a)
    if (pin) return { ...pin, label: a }
    const plus = parsePlusCode(a)
    if (plus) {
      if (plus.full) {
        const d = decodePlusCode(plus.code)
        if (d) return { ...d, label: plus.code }
      } else if (plus.rest) {
        // 短码省掉了前四位，得先知道大概在地球哪一块。地名部分就是那个参考点。
        const ref = await nominatim(plus.rest)
        if (ref) {
          const d = decodePlusCode(recoverPlusCode(plus.code, ref.lat, ref.lng))
          if (d) return { ...d, label: plus.code }
        }
      }
    }

    // 2. Google
    if (opts.googleKey) {
      const g = await googleGeocode(a, opts.googleKey)
      if (g) return g
    }

    // 3. Nominatim
    const n = await nominatim(a)
    if (n) return { lat: n.lat, lng: n.lng, label: n.label }

    // 4. 退到城市 / 邮编。Nominatim 对美国邮编很不靠谱：问 "92253, CA, USA" 它回过圣莱安德罗
    //    的一个路口（2026-09-29，Frank 那单因此被画到了旧金山湾区）。所以先问城市，再问邮编，
    //    而且结果的名字里必须带着问的那个城市名 / 邮编，否则当没查到。
    const zip = /\b(\d{5})(?:-\d{4})?\b/.exec(a)?.[1]
    const parts = a.split(",").map((x) => x.trim()).filter(Boolean)
    const city = (parts.length >= 2 ? parts[parts.length - 2] : "").replace(/\s*\d{5}(-\d{4})?\s*/, "").trim()
    const tries: Array<{ q: string; mustContain: string }> = []
    if (city) tries.push({ q: `${city}, CA, USA`, mustContain: city.toLowerCase() })
    if (zip) tries.push({ q: `${zip}, CA, USA`, mustContain: zip })
    for (const t of tries) {
      const g = await nominatim(t.q)
      // label 打个 ~ 前缀，缓存里还认得出这是个大概位置。
      if (g && g.label.toLowerCase().includes(t.mustContain)) return { lat: g.lat, lng: g.lng, label: `~${g.label}`, approx: true }
    }
    return null
  }

  return { resolve }
}
