import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// 生产环境里几把 Google key 各自属于哪个 GCP 项目、能用哪些接口（老板 2026-09-29）。
//
// 起因：Real Hibachi 项目绑了账单、Distance Matrix 也启用了，可 GOOGLE_MAPS_API_KEY
// 调 Distance Matrix 却回"没绑账单"——那这把 key 八成不在这个项目里。key 的明文谁都
// 不该往外传，但 Google 报错时会把**项目编号**带在里面，拿它对一下就知道了。
//
// 只有 owner 能调；返回里没有 key 的任何片段。

const ENV_NAMES = ["GOOGLE_MAPS_API_KEY", "GOOGLE_PLACES_API_KEY", "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"] as const

/** Google 的报错里挖项目编号："projects/123"、"project 123"、"project #123" 三种写法都见过。 */
function projectFrom(text: string): string | null {
  const m = /projects\/(\d{6,})/.exec(text) ?? /project\s*#?\s*(\d{6,})/i.exec(text)
  return m ? m[1] : null
}

const clip = (s: string, n = 200) => (s.length > n ? `${s.slice(0, n)}…` : s)

async function probeRoutes(key: string) {
  // 最小的一次 computeRoutes：家附近两点。成功会计一次费（一次请求的量），失败不计。
  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: { "content-type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "routes.duration" },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: 34.03, longitude: -117.95 } } },
        destination: { location: { latLng: { latitude: 34.05, longitude: -117.9 } } },
        travelMode: "DRIVE",
      }),
      cache: "no-store",
    })
    const text = await res.text()
    let reason: string | null = null
    let consumer: string | null = null
    try {
      const j = JSON.parse(text) as { error?: { status?: string; message?: string; details?: Array<{ reason?: string; metadata?: { consumer?: string } }> } }
      reason = j.error?.details?.[0]?.reason ?? j.error?.status ?? null
      consumer = j.error?.details?.find((d) => d.metadata?.consumer)?.metadata?.consumer ?? null
    } catch {
      // 不是 JSON 就当纯文本处理
    }
    return { http: res.status, ok: res.ok, reason, project: (consumer && projectFrom(consumer)) ?? projectFrom(text), message: res.ok ? null : clip(text.replace(/\s+/g, " ")) }
  } catch (e) {
    return { http: 0, ok: false, reason: "network", project: null, message: e instanceof Error ? e.message : "network error" }
  }
}

async function probeDistanceMatrix(key: string) {
  // 旧版接口，路费和派工现在用的就是它。1 个元素，成功计一次费。
  try {
    const params = new URLSearchParams({ origins: "34.03,-117.95", destinations: "34.05,-117.9", key })
    const res = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?${params}`, { cache: "no-store" })
    const j = (await res.json()) as { status?: string; error_message?: string }
    return { http: res.status, status: j.status ?? null, message: j.error_message ? clip(j.error_message) : null, project: projectFrom(j.error_message ?? "") }
  } catch (e) {
    return { http: 0, status: "network", message: e instanceof Error ? e.message : "network error", project: null }
  }
}

async function probeProject(key: string) {
  // 故意去调一个我们没启用的接口：Google 拒的时候会把项目编号写在报错里。
  // 这一次永远不会成功，所以永远不计费。
  try {
    const res = await fetch(`https://translation.googleapis.com/language/translate/v2/languages?key=${encodeURIComponent(key)}`, { cache: "no-store" })
    const text = await res.text()
    return projectFrom(text)
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (actor.role !== "owner") return NextResponse.json({ error: "owner only" }, { status: 403 })

  const values = new Map<string, string>()
  for (const n of ENV_NAMES) {
    const v = (process.env[n] ?? "").trim()
    if (v) values.set(n, v)
  }

  const keys = []
  for (const name of ENV_NAMES) {
    const v = values.get(name)
    if (!v) {
      keys.push({ name, present: false })
      continue
    }
    const sameAs = ENV_NAMES.filter((o) => o !== name && values.get(o) === v)
    const [routes, dm, viaProbe] = await Promise.all([probeRoutes(v), probeDistanceMatrix(v), probeProject(v)])
    keys.push({
      name,
      present: true,
      sameAs,
      // 三条路里哪条挖到了项目编号都算
      project: routes.project ?? dm.project ?? viaProbe,
      routes,
      distanceMatrix: dm,
    })
  }

  return NextResponse.json({ ok: true, expected: { projectId: "real-hibachi", projectNumber: "987010086025" }, keys })
}
