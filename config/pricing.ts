// Pricing configuration for packages and promotions
export const pricing = {
  // Package base prices per person
  packages: {
    basic: {
      originalPrice: 60,
      perPerson: 59.9,
      minimum: 599,
    },
    buffet: {
      originalPrice: 60,
      perPerson: 49.9,
      minimum: 998,
    },
  },

  // Child pricing
  children: {
    basic: 29.9,
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
    adultPrice: 59.9,
    childPrice: 29.9,
    minimumTotal: 599,
  },
}

// Helper function to get package price with potential promotions applied
export function getPackagePrice(packageId: string, applyPromotion?: string): number {
  const basePrice = pricing.packages[packageId]?.perPerson || 0

  if (!applyPromotion) return basePrice

  const promotionDiscount = pricing.promotions[applyPromotion] || 0
  return basePrice * (1 - promotionDiscount)
}
