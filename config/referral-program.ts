// Customer give-get referral program (launched 2026-09).
//
// Single source of truth for the numbers shown on /referral and referenced in
// the quote form. Rewards are settled manually by ops (Zelle within 48h after
// the referred party is completed) and the friend's discount is applied on the
// final invoice — nothing here feeds the automated pricing engine in
// config/pricing-rules.ts, on purpose: codes are captured at intake and
// reconciled against partnerships/08-referral-tracking.md.
//
// Competitive anchors (verified 2026-09-01): Hibachi Omakase pays $50-200 cash
// via Zelle from a 12-adult minimum; we start at 10 adults and pay cash, which
// beats both Omakase's floor and Tokyo Hibachi's credit-only $100.

export type ReferralTier = {
  /** Inclusive adult-count lower bound of the referred party. */
  minAdults: number
  /** Inclusive upper bound; null = no cap. */
  maxAdults: number | null
  /** Cash reward, USD, paid via Zelle within 48h of the completed party. */
  cashReward: number
  /** Alternative reward taken as booking credit (~1.5x cash). */
  creditReward: number
}

export const REFERRAL_TIERS: ReferralTier[] = [
  { minAdults: 10, maxAdults: 15, cashReward: 50, creditReward: 75 },
  { minAdults: 16, maxAdults: 25, cashReward: 75, creditReward: 115 },
  { minAdults: 26, maxAdults: 49, cashReward: 125, creditReward: 190 },
  { minAdults: 50, maxAdults: null, cashReward: 200, creditReward: 300 },
]

/** Discount the referred friend gets on their first party, USD, applied on the final invoice. */
export const REFERRAL_FRIEND_DISCOUNT = 50

/** Texting this keyword to the business line gets a personal referral code issued. */
export const REFERRAL_SMS_KEYWORD = "REFER"

/** Hours within which rewards are paid after the referred party is completed. */
export const REFERRAL_PAYOUT_HOURS = 48

export function formatTierRange(tier: ReferralTier): string {
  return tier.maxAdults === null ? `${tier.minAdults}+ adults` : `${tier.minAdults}–${tier.maxAdults} adults`
}
