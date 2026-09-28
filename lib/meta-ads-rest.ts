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

type MetaError = {
  message?: string
  code?: number
  error_subcode?: number
  type?: string
  error_user_title?: string
  error_user_msg?: string
  fbtrace_id?: string
}

/**
 * Meta answers half a dozen different problems with the same "(#200) API
 * access blocked", and the old message threw away everything that told them
 * apart (2026-09-28: three days of no spend data and no way to say whether
 * the account, the token or the app was the blocker). Keep the subcode and
 * the user-facing text - those are what name the actual cause.
 */
function describeMetaError(e: MetaError): string {
  const bits = [
    `Meta API: ${e.message ?? "unknown error"}`,
    `code ${e.code ?? "?"}${e.error_subcode ? `/${e.error_subcode}` : ""}`,
    e.type,
    e.error_user_title,
    e.error_user_msg,
    e.fbtrace_id ? `trace ${e.fbtrace_id}` : undefined,
  ].filter(Boolean)
  return bits.join(" · ")
}

/** Ad-account status codes, so a blocked sync says why in plain words. */
const ACCOUNT_STATUS: Record<number, string> = {
  1: "ACTIVE",
  2: "DISABLED",
  3: "UNSETTLED - unpaid balance",
  7: "PENDING_RISK_REVIEW",
  8: "PENDING_SETTLEMENT",
  9: "IN_GRACE_PERIOD",
  100: "PENDING_CLOSURE",
  101: "CLOSED",
  201: "ANY_ACTIVE",
  202: "ANY_CLOSED",
}
const DISABLE_REASON: Record<number, string> = {
  0: "none",
  1: "ADS_INTEGRITY_POLICY",
  2: "ADS_IP_REVIEW",
  3: "RISK_PAYMENT",
  4: "GRAY_ACCOUNT_SHUT_DOWN",
  5: "ADS_AFC_REVIEW",
  6: "BUSINESS_INTEGRITY_RATIONALE",
  7: "PERMANENT_CLOSE",
  8: "UNUSED_RESELLER_ACCOUNT",
  9: "UNUSED_ACCOUNT",
}

export type MetaAccountStatus = {
  ok: boolean
  /** Set when the account itself answered. */
  name?: string
  accountStatus?: string
  disableReason?: string
  currency?: string
  amountSpent?: string
  /** Set when even this read was refused - then the token or app is the blocker, not the account. */
  error?: string
  /**
   * Does the token work at all, outside of ads? A live token here with a
   * refused ad read means the app lost Marketing API access; a dead token
   * here means it simply needs reissuing. Different first click either way.
   */
  token?: { alive: boolean; who?: string; error?: string }
}

async function probeToken(token: string): Promise<{ alive: boolean; who?: string; error?: string }> {
  try {
    const res = await fetch(`${GRAPH}/me?fields=id,name&access_token=${encodeURIComponent(token)}`, { cache: "no-store" })
    const json = (await res.json().catch(() => null)) as { id?: string; name?: string; error?: MetaError } | null
    if (!res.ok || !json || json.error) {
      return { alive: false, error: json?.error ? describeMetaError(json.error) : `HTTP ${res.status}` }
    }
    return { alive: true, who: json.name ? `${json.name} (${json.id ?? "?"})` : json.id }
  } catch (error) {
    return { alive: false, error: String(error) }
  }
}

/**
 * One cheap read that separates "the ad account is restricted" from "our token
 * or app lost Marketing API access" - the two are indistinguishable from the
 * insights call alone, and they need completely different fixes.
 */
export async function fetchMetaAccountStatus(): Promise<MetaAccountStatus> {
  const token = process.env.META_ACCESS_TOKEN?.trim()
  if (!token) return { ok: false, error: "META_ACCESS_TOKEN not set" }
  const params = new URLSearchParams({
    fields: "name,account_status,disable_reason,currency,amount_spent",
    access_token: token,
  })
  const res = await fetch(`${GRAPH}/act_${metaAdAccountId()}?${params.toString()}`, { cache: "no-store" })
  const json = (await res.json().catch(() => null)) as
    | { name?: string; account_status?: number; disable_reason?: number; currency?: string; amount_spent?: string; error?: MetaError }
    | null
  if (!res.ok || !json || json.error) {
    return {
      ok: false,
      error: json?.error ? describeMetaError(json.error) : `Meta API HTTP ${res.status}`,
      token: await probeToken(token),
    }
  }
  return {
    ok: true,
    name: json.name,
    accountStatus: `${json.account_status ?? "?"} ${ACCOUNT_STATUS[json.account_status ?? -1] ?? ""}`.trim(),
    disableReason: `${json.disable_reason ?? "?"} ${DISABLE_REASON[json.disable_reason ?? -1] ?? ""}`.trim(),
    currency: json.currency,
    amountSpent: json.amount_spent,
  }
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
    const json = (await res.json().catch(() => null)) as { data?: InsightRow[]; paging?: { next?: string }; error?: MetaError } | null
    if (!res.ok || !json || json.error) {
      throw new Error(json?.error ? describeMetaError(json.error) : `Meta API HTTP ${res.status}`)
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
