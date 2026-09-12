// Google Ads over REST for serverless routes. The gRPC SDK drags native deps
// and cold-start time into a Vercel function; three fetches do the job.
// Env (Vercel project only, not in .env.local): GOOGLE_ADS_CLIENT_ID /
// CLIENT_SECRET / REFRESH_TOKEN / DEVELOPER_TOKEN / CUSTOMER_ID / LOGIN_CUSTOMER_ID.

const API_VERSION = "v22"

export async function getGoogleAdsAccessToken(): Promise<string> {
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
  if (!res.ok) throw new Error(`token refresh failed: ${res.status} ${(await res.text()).slice(0, 200)}`)
  const data = (await res.json()) as { access_token?: string }
  if (!data.access_token) throw new Error("token refresh returned no access_token")
  return data.access_token
}

export function googleAdsCustomerId(): string {
  return (process.env.GOOGLE_ADS_CUSTOMER_ID ?? "").replace(/-/g, "")
}

/** Runs one GAQL query via searchStream and returns the flattened result rows. */
export async function googleAdsSearch<T = Record<string, unknown>>(query: string): Promise<T[]> {
  const customerId = googleAdsCustomerId()
  const loginCustomerId = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "").replace(/-/g, "")
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? ""
  if (!customerId || !developerToken) throw new Error("google ads env not configured")
  const accessToken = await getGoogleAdsAccessToken()
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": developerToken,
    "Content-Type": "application/json",
  }
  // Direct child-account access must not carry login-customer-id (MCC → 403).
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId
  const res = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/googleAds:searchStream`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`google ads query failed: ${res.status} ${(await res.text()).slice(0, 300)}`)
  const chunks = (await res.json()) as Array<{ results?: T[] }>
  return chunks.flatMap((c) => c.results ?? [])
}

export type GoogleCampaignDay = {
  campaignId: string
  campaignName: string
  date: string
  impressions: number
  clicks: number
  costCents: number
  conversions: number
  conversionValueCents: number
}

/** Campaign × day spend for [from, to] (YYYY-MM-DD, account time zone). */
export async function fetchGoogleCampaignDays(from: string, to: string): Promise<GoogleCampaignDay[]> {
  type Row = {
    campaign?: { id?: string; name?: string }
    segments?: { date?: string }
    metrics?: { impressions?: string; clicks?: string; costMicros?: string; conversions?: number; conversionsValue?: number }
  }
  const rows = await googleAdsSearch<Row>(
    "SELECT campaign.id, campaign.name, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value " +
      `FROM campaign WHERE segments.date BETWEEN '${from}' AND '${to}' AND campaign.status != 'REMOVED' ORDER BY segments.date`,
  )
  return rows
    .filter((r) => r.campaign?.id && r.segments?.date)
    .map((r) => ({
      campaignId: String(r.campaign?.id),
      campaignName: r.campaign?.name ?? "",
      date: String(r.segments?.date),
      impressions: Number(r.metrics?.impressions ?? 0),
      clicks: Number(r.metrics?.clicks ?? 0),
      costCents: Math.round(Number(r.metrics?.costMicros ?? 0) / 1e4),
      conversions: Number(r.metrics?.conversions ?? 0),
      conversionValueCents: Math.round(Number(r.metrics?.conversionsValue ?? 0) * 100),
    }))
}
