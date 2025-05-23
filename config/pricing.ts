// Pricing configuration for packages and promotions
export const pricing = {
  // Package base prices per person
  packages: {
    basic: {
      originalPrice: 60,
      perPerson: 49.9,
      minimum: 499,
    },
    buffet: {
      originalPrice: 50,
      perPerson: 39.9,
      minimum: 798,
    },
  },

  // Child pricing
  children: {
    basic: 30,
    buffet: 25,
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
    adultPrice: 39.9,
    childPrice: 19.9,
    minimumTotal: 499,
  },
}

// Helper function to get package price with potential promotions applied
export function getPackagePrice(packageId: string, applyPromotion?: string): number {
  const basePrice = pricing.packages[packageId]?.perPerson || 0

  if (!applyPromotion) return basePrice

  const promotionDiscount = pricing.promotions[applyPromotion] || 0
  return basePrice * (1 - promotionDiscount)
}
