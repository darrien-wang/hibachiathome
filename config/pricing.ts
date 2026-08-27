// Display-facing pricing figures.
// The authoritative rules live in ./pricing-rules — this file only reshapes
// them for the marketing components that already consume `pricing`.
import { GUEST_TIERS, MINIMUM_SPEND } from "./pricing-rules"

export const pricing = {
  // Package base prices per person
  packages: {
    basic: {
      originalPrice: 60,
      perPerson: GUEST_TIERS.adult.price,
      minimum: MINIMUM_SPEND,
    },
    buffet: {
      originalPrice: 60,
      perPerson: GUEST_TIERS.adult.price,
      minimum: 998,
    },
  },

  // Child pricing
  children: {
    basic: GUEST_TIERS.child.price,
    buffet: 25,
    // Kids under 5 are a flat small-plate charge.
    underFive: GUEST_TIERS.toddler.price,
  },

  // Promotional discounts (can be updated during promotions)
  promotions: {
    summerDiscount: 0.1, // 10% off
    holidaySpecial: 0.15, // 15% off
    groupDiscount: 0.05, // 5% off for groups over 20
    // Add more promotional discounts as needed
  },

  // Pricing banner display values
  pricingBanner: {
    adultPrice: GUEST_TIERS.adult.price,
    childPrice: GUEST_TIERS.child.price,
    underFivePrice: GUEST_TIERS.toddler.price,
    minimumTotal: MINIMUM_SPEND,
  },
}

// Helper function to get package price with potential promotions applied
export function getPackagePrice(packageId: string, applyPromotion?: string): number {
  const basePrice = pricing.packages[packageId]?.perPerson || 0

  if (!applyPromotion) return basePrice

  const promotionDiscount = pricing.promotions[applyPromotion] || 0
  return basePrice * (1 - promotionDiscount)
}
