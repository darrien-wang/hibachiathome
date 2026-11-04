// Google Ads over REST for serverless routes. The gRPC SDK drags native deps
// and cold-start time into a Vercel function; three fetches do the job.
// Env (Vercel project only, not in .env.local): GOOGLE_ADS_DEVELOPER_TOKEN /
// CUSTOMER_ID, plus one of two ways to get a token:
//   - GOOGLE_ADS_SERVICE_ACCOUNT_JSON: the service-account key file's contents
//     (2026-11-04). The account has direct access, no expiry, and must NOT be
//     sent with login-customer-id (the MCC header turns into a 403). Preferred.
//   - GOOGLE_ADS_CLIENT_ID / CLIENT_SECRET / REFRESH_TOKEN (+ LOGIN_CUSTOMER_ID):
//     the OAuth refresh token Google kept revoking under the 7-day testing rule.
import { JWT } from "google-auth-library"

// v22 was sunset by Google in Oct 2026 (UNSUPPORTED_VERSION, found 2026-11-04);
// keep this on a version the Python client in ads-analytics also uses.
const API_VERSION = "v25"

type ServiceAccount = { client_email: string; private_key: string }

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_ADS_SERVICE_ACCOUNT_JSON?.trim()
  if (!raw) return null
  let parsed: { client_email?: string; private_key?: string }
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error("GOOGLE_ADS_SERVICE_ACCOUNT_JSON is not valid JSON (paste the key file's contents as-is)")
  }
  if (!parsed.client_email || !parsed.private_key) throw new Error("GOOGLE_ADS_SERVICE_ACCOUNT_JSON missing client_email/private_key")
  return { client_email: parsed.client_email, private_key: parsed.private_key }
}

export function googleAdsAuthMode(): "service_account" | "oauth" {
  return serviceAccount() ? "service_account" : "oauth"
}

export async function getGoogleAdsAccessToken(): Promise<string> {
  const sa = serviceAccount()
  if (sa) {
    const jwt = new JWT({ email: sa.client_email, key: sa.private_key, scopes: ["https://www.googleapis.com/auth/adwords"] })
    const r = await jwt.getAccessToken()
    if (!r?.token) throw new Error("service account returned no access token")
    return r.token
  }
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
  // Direct child-account access must not carry login-customer-id (MCC → 403);
  // the service account is direct access, so it never sends the header.
  if (loginCustomerId && googleAdsAuthMode() === "oauth") headers["login-customer-id"] = loginCustomerId
  const res = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/googleAds:searchStream`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
    cache: "no-store",
  })
  if (!res.ok) {
    // Keep the errorCode (deep in the JSON) visible; 300 chars cut it off.
    const text = (await res.text()).replace(/\s+/g, " ")
    throw new Error(`google ads query failed: ${res.status} ${text.slice(0, 800)}`)
  }
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
