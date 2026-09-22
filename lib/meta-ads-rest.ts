// Meta Marketing API (Graph) insights → campaign × day rows for ad_spend_daily.
//
// Same role as lib/google-ads-rest.ts for Google: the scorecard needs
// impressions / clicks / spend per campaign per day from every paid channel,
// and it never trusts a platform's own conversion count for cross-channel
// comparison (leads and deposits come from our tables by utm). Plain fetch,
// no SDK. Auth is a System User token from the REAL Hibachi LLC portfolio
// with ads_read on the ad account; without META_ACCESS_TOKEN every call
// says so instead of throwing into a cron.

const GRAPH = "https://graph.facebook.com/v21.0"
// Real Hibachi Ads (created 2026-09-22 inside the business portfolio). The
// id is not a secret - it is on every Ads Manager URL.
const DEFAULT_AD_ACCOUNT_ID = "4120806044884874"

export function metaAdAccountId(): string {
  return (process.env.META_AD_ACCOUNT_ID?.trim() || DEFAULT_AD_ACCOUNT_ID).replace(/^act_/, "")
}

export function metaConfigured(): boolean {
  return Boolean(process.env.META_ACCESS_TOKEN?.trim())
}

export type MetaCampaignDay = {
  campaignId: string
  campaignName: string
  /** YYYY-MM-DD in the ad account's time zone (America/Los_Angeles). */
  date: string
  impressions: number
  /** All clicks, the way Meta reports "clicks (all)". */
  clicks: number
  /** Clicks that went to the site - the number comparable to Google's clicks. */
  linkClicks: number
  costCents: number
  /** Meta's own "lead" action count (pixel + on-site), reference only. */
  leads: number
}

type InsightRow = {
  campaign_id?: string
  campaign_name?: string
  date_start?: string
  impressions?: string
  clicks?: string
  inline_link_clicks?: string
  spend?: string
  actions?: Array<{ action_type?: string; value?: string }>
}

/** Campaign × day for [from, to] inclusive (YYYY-MM-DD). Follows paging. */
export async function fetchMetaCampaignDays(from: string, to: string): Promise<MetaCampaignDay[]> {
  const token = process.env.META_ACCESS_TOKEN?.trim()
  if (!token) throw new Error("META_ACCESS_TOKEN not set")
  const params = new URLSearchParams({
    level: "campaign",
    fields: "campaign_id,campaign_name,impressions,clicks,inline_link_clicks,spend,actions",
    time_increment: "1",
    time_range: JSON.stringify({ since: from, until: to }),
    limit: "500",
    access_token: token,
  })
  let url = `${GRAPH}/act_${metaAdAccountId()}/insights?${params.toString()}`
  const out: MetaCampaignDay[] = []
  for (let page = 0; url && page < 20; page++) {
    const res = await fetch(url, { cache: "no-store" })
    const json = (await res.json().catch(() => null)) as { data?: InsightRow[]; paging?: { next?: string }; error?: { message?: string; code?: number } } | null
    if (!res.ok || !json || json.error) {
      throw new Error(json?.error?.message ? `Meta API: ${json.error.message} (code ${json.error.code ?? "?"})` : `Meta API HTTP ${res.status}`)
    }
    for (const r of json.data ?? []) {
      if (!r.campaign_id || !r.date_start) continue
      const leads = (r.actions ?? []).filter((a) => a.action_type === "lead").reduce((sum, a) => sum + Number(a.value ?? 0), 0)
      out.push({
        campaignId: String(r.campaign_id),
        campaignName: r.campaign_name ?? "",
        date: String(r.date_start),
        impressions: Number(r.impressions ?? 0),
        clicks: Number(r.clicks ?? 0),
        linkClicks: Number(r.inline_link_clicks ?? 0),
        costCents: Math.round(Number(r.spend ?? 0) * 100),
        leads,
      })
    }
    url = json.paging?.next ?? ""
  }
  return out
}
