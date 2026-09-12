// Channel taxonomy, presentation side. The classification itself lives in
// Postgres (rh_resolve_channel / rh_channel_group, migration
// multichannel_ads_foundation) so the scorecard view, the attribution sweep
// and the daily report all agree. This file only knows how to label it.

export type ChannelGroup = "paid" | "organic" | "referral" | "direct" | "unresolved"

export type PaidChannel = "google_ads" | "chatgpt_ads" | "meta_ads" | "yelp_ads" | "other_ads"

export const PAID_CHANNELS: PaidChannel[] = ["google_ads", "chatgpt_ads", "meta_ads", "yelp_ads", "other_ads"]

export const CHANNEL_LABELS: Record<string, string> = {
  google_ads: "Google Ads",
  chatgpt_ads: "ChatGPT Ads",
  meta_ads: "Meta Ads",
  yelp_ads: "Yelp Ads",
  other_ads: "其他付费",
  google_organic: "Google 自然",
  search_organic: "其他搜索自然",
  chatgpt_referral: "ChatGPT 自然",
  meta_organic: "Meta 自然",
  fb_marketplace: "FB Marketplace",
  yelp_organic: "Yelp 自然",
  marketplace_referral: "平台转介",
  other_referral: "其他来源",
  word_of_mouth: "口碑转介绍",
  partner: "合作伙伴",
  organic_direct: "直接/未追踪",
  unresolved: "未归因",
}

export const GROUP_LABELS: Record<ChannelGroup, string> = {
  paid: "付费",
  organic: "自然",
  referral: "转介",
  direct: "直接",
  unresolved: "未归因",
}

export function channelLabel(channel: string | null | undefined): string {
  if (!channel) return CHANNEL_LABELS.unresolved
  return CHANNEL_LABELS[channel] ?? channel
}

export function isPaidChannel(channel: string): channel is PaidChannel {
  return (PAID_CHANNELS as string[]).includes(channel)
}

/** One scorecard row, already aggregated over the requested window. */
export type ChannelScore = {
  channel: string
  group: ChannelGroup
  costCents: number
  clicks: number
  impressions: number
  platformConversions: number
  leads: number
  leadsQualified: number
  deposits: number
  revenueCents: number
  /** derived */
  cpcCents: number | null
  cplCents: number | null
  cpaCents: number | null
  leadToDepositRate: number | null
  /** n<10 rule from the decision log: don't draw conclusions on thin data */
  thin: boolean
}

export function deriveScore(row: Omit<ChannelScore, "cpcCents" | "cplCents" | "cpaCents" | "leadToDepositRate" | "thin">): ChannelScore {
  const cpc = row.clicks > 0 ? Math.round(row.costCents / row.clicks) : null
  const cpl = row.leads > 0 && row.costCents > 0 ? Math.round(row.costCents / row.leads) : null
  const cpa = row.deposits > 0 && row.costCents > 0 ? Math.round(row.costCents / row.deposits) : null
  const l2d = row.leads > 0 ? row.deposits / row.leads : null
  return { ...row, cpcCents: cpc, cplCents: cpl, cpaCents: cpa, leadToDepositRate: l2d, thin: row.leads + row.deposits < 10 }
}
