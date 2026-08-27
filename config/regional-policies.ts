export const REGION_COOKIE_KEY = "rh_region"
export const DEFAULT_REGION_CODE = "ca" as const

// Real Hibachi serves Southern California only (East Coast market discontinued 2026-07).
// Legacy region aliases (e.g. ?region=east-coast-nj) resolve to null and fall back to "ca".
export type RegionCode = "ca"
export type PricingPolicyKey = "weekday_saver"
export type RegionalDisplayModule = "quote_pricing_tiers" | "home_pricing_cards"

export type PricingPolicyDefinition = {
  key: PricingPolicyKey
  title: string
  description: string
  unavailableMessage: string
  homeFeatureList: readonly string[]
  quoteDescription: string
}

type RegionDefinition = {
  code: RegionCode
  label: string
  aliases: readonly string[]
  quoteRegionParam: string
  enabledPricingPolicies: readonly PricingPolicyKey[]
  enabledDisplayModules: readonly RegionalDisplayModule[]
}

const REGION_DEFINITIONS: Record<RegionCode, RegionDefinition> = {
  ca: {
    code: "ca",
    label: "Southern California",
    aliases: ["ca", "california", "southern-california", "west-coast", "west_coast", "socal"],
    quoteRegionParam: "west-coast",
    enabledPricingPolicies: ["weekday_saver"],
    enabledDisplayModules: ["quote_pricing_tiers", "home_pricing_cards"],
  },
} as const

const PRICING_POLICY_DEFINITIONS: Record<PricingPolicyKey, PricingPolicyDefinition> = {
  weekday_saver: {
    key: "weekday_saver",
    title: "Weekday Special",
    description:
      "Includes the Standard food and chef show package. Difference: guests pick 2 of 3 proteins (chicken, steak, shrimp).",
    unavailableMessage: "Weekday Special is currently available in Southern California only.",
    homeFeatureList: [
      "$45.9/adult; $22.95/child 5–12; $5 under 5",
      "Fried rice, fresh vegetables, and house salad included",
      "Live chef performance and on-site grill cooking",
      "Monday-Thursday events only; 15+ guests (a child counts as half, under-5s do not count)",
      "No premium add-ons or custom menu upgrades",
      "Optional full setup (tables, chairs, utensils): +$15 per guest",
    ],
    quoteDescription:
      "$45.9/adult, $22.95/child. Includes the Standard food/show package; guests pick 2 of 3 proteins (chicken/steak/shrimp).",
  },
}

const REGION_ALIAS_TO_CODE: Record<string, RegionCode> = Object.values(REGION_DEFINITIONS).reduce<Record<string, RegionCode>>(
  (accumulator, region) => {
    for (const alias of region.aliases) {
      accumulator[alias] = region.code
    }
    return accumulator
  },
  {},
)

export function normalizeRegionCode(raw: string | null | undefined): RegionCode | null {
  const normalized = raw?.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  return REGION_ALIAS_TO_CODE[normalized] ?? null
}

export function resolveRegionCode(raw: string | null | undefined): RegionCode {
  return normalizeRegionCode(raw) ?? DEFAULT_REGION_CODE
}

export function getRegionDefinition(region: RegionCode): RegionDefinition {
  return REGION_DEFINITIONS[region]
}

export function getPricingPolicyDefinition(policy: PricingPolicyKey): PricingPolicyDefinition {
  return PRICING_POLICY_DEFINITIONS[policy]
}

export function isPricingPolicyEnabledForRegion(policy: PricingPolicyKey, region: RegionCode): boolean {
  return REGION_DEFINITIONS[region].enabledPricingPolicies.includes(policy)
}

export function isDisplayModuleEnabledForRegion(module: RegionalDisplayModule, region: RegionCode): boolean {
  return REGION_DEFINITIONS[region].enabledDisplayModules.includes(module)
}

export function getRegionQuoteHref(region: RegionCode): string {
  return `/quote?region=${REGION_DEFINITIONS[region].quoteRegionParam}`
}

export type RegionalPolicySnapshot = {
  region: RegionDefinition
  quoteHref: string
  pricingPolicies: Record<
    PricingPolicyKey,
    {
      definition: PricingPolicyDefinition
      enabled: boolean
    }
  >
  displayModules: Record<RegionalDisplayModule, boolean>
}

export function getRegionalPolicySnapshot(region: RegionCode): RegionalPolicySnapshot {
  return {
    region: getRegionDefinition(region),
    quoteHref: getRegionQuoteHref(region),
    pricingPolicies: {
      weekday_saver: {
        definition: getPricingPolicyDefinition("weekday_saver"),
        enabled: isPricingPolicyEnabledForRegion("weekday_saver", region),
      },
    },
    displayModules: {
      quote_pricing_tiers: isDisplayModuleEnabledForRegion("quote_pricing_tiers", region),
      home_pricing_cards: isDisplayModuleEnabledForRegion("home_pricing_cards", region),
    },
  }
}
