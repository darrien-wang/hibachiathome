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

export type InsightRow = {
  campaign_id?: string
  campaign_name?: string
  adset_id?: string
  adset_name?: string
  ad_id?: string
  ad_name?: string
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

// ---------------------------------------------------------------------------
// Below the campaign: ad x day (2026-11-21).
//
// The ledger judges Meta per ad set (la_oc_sched vs destination_sched) and
// per ad, and until now that spend was copied out of Ads Manager by hand.
// One insights call at level=ad gives the finest grain; ad set and campaign
// totals are sums of it. These rows go to meta_ad_spend_daily, a detail table
// - ad_spend_daily keeps its campaign rows, so nothing that totals a channel
// counts Meta twice.

export type MetaAdDay = {
  campaignId: string
  campaignName: string
  adsetId: string
  adsetName: string
  adId: string
  adName: string
  /** YYYY-MM-DD in the ad account's time zone (America/Los_Angeles). */
  date: string
  impressions: number
  /** All clicks, the way Meta reports "clicks (all)". */
  clicks: number
  /** Clicks that went to the site. */
  linkClicks: number
  costCents: number
  /** Meta's own "lead" action count, reference only. */
  leads: number
}

const leadCount = (r: InsightRow) =>
  (r.actions ?? []).filter((a) => a.action_type === "lead").reduce((sum, a) => sum + Number(a.value ?? 0), 0)

/** Insight rows (level=ad, one per ad per day) -> typed rows. A row with no ad, ad set or date is dropped. */
export function parseMetaAdRows(rows: InsightRow[]): MetaAdDay[] {
  const out: MetaAdDay[] = []
  for (const r of rows) {
    if (!r.ad_id || !r.adset_id || !r.campaign_id || !r.date_start) continue
    out.push({
      campaignId: String(r.campaign_id),
      campaignName: r.campaign_name ?? "",
      adsetId: String(r.adset_id),
      adsetName: r.adset_name ?? "",
      adId: String(r.ad_id),
      adName: r.ad_name ?? "",
      date: String(r.date_start),
      impressions: Number(r.impressions ?? 0),
      clicks: Number(r.clicks ?? 0),
      linkClicks: Number(r.inline_link_clicks ?? 0),
      costCents: Math.round(Number(r.spend ?? 0) * 100),
      leads: leadCount(r),
    })
  }
  return out
}

/**
 * Do the ad rows add up to the campaign rows for the same window? Each row is
 * rounded to the cent on its own, so a few cents of drift per campaign-day is
 * expected; anything larger means one of the two pulls is missing rows, and
 * the sync says so instead of letting a short ad set total pass as real.
 */
export function reconcileMetaAdSpend(
  campaignDays: Array<{ campaignId: string; date: string; costCents: number }>,
  adDays: Array<{ campaignId: string; date: string; costCents: number }>,
): { campaignCents: number; adCents: number; diffCents: number; ok: boolean; worst?: { campaignId: string; date: string; campaignCents: number; adCents: number } } {
  const key = (r: { campaignId: string; date: string }) => `${r.campaignId}|${r.date}`
  const camp = new Map<string, number>()
  const ads = new Map<string, number>()
  const adCount = new Map<string, number>()
  for (const r of campaignDays) camp.set(key(r), (camp.get(key(r)) ?? 0) + r.costCents)
  for (const r of adDays) {
    ads.set(key(r), (ads.get(key(r)) ?? 0) + r.costCents)
    adCount.set(key(r), (adCount.get(key(r)) ?? 0) + 1)
  }
  let ok = true
  let worst: { campaignId: string; date: string; campaignCents: number; adCents: number } | undefined
  let worstGap = 0
  for (const k of new Set([...camp.keys(), ...ads.keys()])) {
    const c = camp.get(k) ?? 0
    const a = ads.get(k) ?? 0
    const gap = Math.abs(c - a)
    // Half a cent of rounding per ad row, plus one for the campaign row.
    const tolerance = Math.ceil(((adCount.get(k) ?? 0) + 1) / 2)
    if (gap > tolerance) ok = false
    if (gap > worstGap) {
      worstGap = gap
      const [campaignId, date] = k.split("|")
      worst = { campaignId, date, campaignCents: c, adCents: a }
    }
  }
  const campaignCents = [...camp.values()].reduce((a, b) => a + b, 0)
  const adCents = [...ads.values()].reduce((a, b) => a + b, 0)
  return { campaignCents, adCents, diffCents: adCents - campaignCents, ok, ...(worst && worstGap > 0 ? { worst } : {}) }
}

/** Ad x day for [from, to] inclusive (YYYY-MM-DD). Follows paging. */
export async function fetchMetaAdDays(from: string, to: string): Promise<MetaAdDay[]> {
  const token = process.env.META_ACCESS_TOKEN?.trim()
  if (!token) throw new Error("META_ACCESS_TOKEN not set")
  const params = new URLSearchParams({
    level: "ad",
    fields: "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,impressions,clicks,inline_link_clicks,spend,actions",
    time_increment: "1",
    time_range: JSON.stringify({ since: from, until: to }),
    limit: "500",
    access_token: token,
  })
  let url = `${GRAPH}/act_${metaAdAccountId()}/insights?${params.toString()}`
  const raw: InsightRow[] = []
  // 40 pages x 500 rows: over a year of a dozen ads. Past that the window is
  // too wide for one call and the caller should say so rather than store a
  // truncated set that looks complete.
  for (let page = 0; url; page++) {
    if (page >= 40) throw new Error("Meta API: ad-level insights did not finish in 40 pages - narrow the window")
    const res = await fetch(url, { cache: "no-store" })
    const json = (await res.json().catch(() => null)) as { data?: InsightRow[]; paging?: { next?: string }; error?: MetaError } | null
    if (!res.ok || !json || json.error) {
      throw new Error(json?.error ? describeMetaError(json.error) : `Meta API HTTP ${res.status}`)
    }
    raw.push(...(json.data ?? []))
    url = json.paging?.next ?? ""
  }
  return parseMetaAdRows(raw)
}
