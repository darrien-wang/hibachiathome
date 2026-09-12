import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 月度 Google Ads 花费,给订单工作台的营业额看板配套。
//
// 走 REST 不走 SDK:google-ads-api 那个包是 gRPC 的,塞进 serverless 函数
// 会拖冷启动、还要带一堆原生依赖。这里只需要读一个按月聚合的数字,三次
// fetch 就够了 —— 刷 token、发 GAQL、聚合。零新依赖。
//
// 拿不到数据时返回 ok:false 而不是抛错:看板的营业额部分不依赖广告数据,
// 广告接口挂了不该让整个看板打不开,前端会把广告列显示成"—"。

function isAuthorized(request: NextRequest): boolean {
  const provided = request.headers.get("x-admin-key") ?? ""
  if (!provided) return false
  const owner = process.env.ADMIN_DASH_KEY
  if (owner && provided === owner) return true
  for (const entry of (process.env.AGENT_DASH_KEYS ?? "").split(",")) {
    const [alias, key] = entry.split(":").map((s) => s?.trim())
    if (alias && key && provided === key) return true
  }
  return false
}

type MonthSpend = { month: string; cost: number; clicks: number; impressions: number; conversions: number }

// Google Ads 的数字一天之内基本不动,而工作台每 30 秒轮询一次。缓存 15
// 分钟,免得把 API 配额浪费在重复查询上。lambda 实例级别,够用了。
const CACHE_TTL_MS = 15 * 60 * 1000
let cache: { at: number; data: MonthSpend[] } | null = null

async function getAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET ?? "",
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN ?? "",
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`token refresh failed: ${res.status} ${(await res.text()).slice(0, 200)}`)
  }
  const data = (await res.json()) as { access_token?: string }
  if (!data.access_token) throw new Error("token refresh returned no access_token")
  return data.access_token
}

function windowStart(): string {
  // 回看 13 个自然月,够看出淡旺季又不至于把响应撑大。
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1))
  return d.toISOString().slice(0, 10)
}

async function fetchMonthlySpend(): Promise<MonthSpend[]> {
  const customerId = (process.env.GOOGLE_ADS_CUSTOMER_ID ?? "").replace(/-/g, "")
  const loginCustomerId = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "").replace(/-/g, "")
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? ""
  if (!customerId || !developerToken) throw new Error("google ads env not configured")

  const accessToken = await getAccessToken()

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": developerToken,
    "Content-Type": "application/json",
  }
  // 直连子账号时不能带 login-customer-id,带了反而报权限错。
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId

  const today = new Date().toISOString().slice(0, 10)
  const query =
    "SELECT segments.month, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions " +
    "FROM customer " +
    `WHERE segments.date BETWEEN '${windowStart()}' AND '${today}' ` +
    "ORDER BY segments.month"

  const res = await fetch(`https://googleads.googleapis.com/v22/customers/${customerId}/googleAds:searchStream`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`google ads query failed: ${res.status} ${(await res.text()).slice(0, 300)}`)
  }

  // searchStream 返回的是一个数组,每个元素带一批 results。
  const chunks = (await res.json()) as Array<{
    results?: Array<{
      segments?: { month?: string }
      metrics?: { costMicros?: string; clicks?: string; impressions?: string; conversions?: number }
    }>
  }>

  const byMonth = new Map<string, MonthSpend>()
  for (const chunk of chunks) {
    for (const row of chunk.results ?? []) {
      const month = (row.segments?.month ?? "").slice(0, 7)
      if (!month) continue
      const acc = byMonth.get(month) ?? { month, cost: 0, clicks: 0, impressions: 0, conversions: 0 }
      acc.cost += Number(row.metrics?.costMicros ?? 0) / 1e6
      acc.clicks += Number(row.metrics?.clicks ?? 0)
      acc.impressions += Number(row.metrics?.impressions ?? 0)
      acc.conversions += Number(row.metrics?.conversions ?? 0)
      byMonth.set(month, acc)
    }
  }
  return [...byMonth.values()].sort((a, b) => (a.month < b.month ? 1 : -1))
}

// 2026-09-11 起,月度花费优先取 ad_spend_daily(全渠道:Google 同步 +
// ChatGPT/Meta/Yelp 手填或 CSV),这样看板的"广告费/获客成本"和渠道计分板
// 是同一个数;表里还没有的月份再回落到 Google 直连。
async function monthlyFromSpendTable(): Promise<Map<string, MonthSpend>> {
  const supabase = createServerSupabaseClient()
  const out = new Map<string, MonthSpend>()
  if (!supabase) return out
  const { data } = await supabase
    .from("ad_spend_daily")
    .select("date, cost_cents, clicks, impressions, platform_conversions")
    .gte("date", windowStart())
    .limit(20000)
  for (const r of data ?? []) {
    const month = String(r.date).slice(0, 7)
    const acc = out.get(month) ?? { month, cost: 0, clicks: 0, impressions: 0, conversions: 0 }
    acc.cost += Number(r.cost_cents) / 100
    acc.clicks += Number(r.clicks)
    acc.impressions += Number(r.impressions)
    acc.conversions += Number(r.platform_conversions)
    out.set(month, acc)
  }
  return out
}

function mergeMonths(table: Map<string, MonthSpend>, live: MonthSpend[]): MonthSpend[] {
  const merged = new Map<string, MonthSpend>(live.map((m) => [m.month, m]))
  for (const [month, row] of table) merged.set(month, row)
  return [...merged.values()].sort((a, b) => (a.month < b.month ? 1 : -1))
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const table = await monthlyFromSpendTable().catch(() => new Map<string, MonthSpend>())

  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json({ ok: true, months: mergeMonths(table, cache.data), cachedAt: new Date(cache.at).toISOString() })
  }

  try {
    const months = await fetchMonthlySpend()
    cache = { at: Date.now(), data: months }
    return NextResponse.json({ ok: true, months: mergeMonths(table, months), cachedAt: new Date(cache.at).toISOString() })
  } catch (error) {
    console.error("[ads-spend]", error)
    // 过期缓存也比没有强,先顶上,顺便说明这次刷新失败了。
    if (cache) {
      return NextResponse.json({
        ok: true,
        months: mergeMonths(table, cache.data),
        cachedAt: new Date(cache.at).toISOString(),
        stale: true,
      })
    }
    if (table.size > 0) {
      return NextResponse.json({ ok: true, months: mergeMonths(table, []), cachedAt: new Date().toISOString(), stale: true })
    }
    return NextResponse.json({ ok: false, error: String(error) }, { status: 200 })
  }
}
