export interface Promotion {
  id: string
  title: string
  description: string
  code?: string
  discount?: string
  validUntil?: string
  imageUrl?: string
  buttonText?: string
  buttonLink?: string
  isActive: boolean
}

export const promotions: Promotion[] = [
  {
    id: "mothers-day-2023",
    title: "Mother's Day Special",
    description:
      "Treat your mom to a special hibachi experience! Book a Mother's Day party and receive complimentary sushi appetizers for the entire group.",
    code: "MOM2023",
    discount: "Free sushi appetizers",
    validUntil: "2023-05-14",
    imageUrl: "/mothers-day-promo.jpg",
    buttonText: "Book Mother's Day Special",
    buttonLink: "/estimation?source=mothers_day",
    isActive: true,
  },
  {
    id: "summer-party",
    title: "Summer Party Package",
    description:
      "Planning a summer gathering? Book our Summer Party Package and get 10% off when booking for 15+ guests!",
    code: "SUMMER2023",
    discount: "10% off for 15+ guests",
    validUntil: "2023-08-31",
    buttonText: "Get Summer Discount",
    buttonLink: "/estimation?source=summer_party",
    isActive: true,
  },
  {
    id: "weekday-special",
    title: "Weekday Special",
    description: "Book your hibachi experience on Monday-Thursday and receive special weekday pricing!",
    discount: "15% off standard pricing",
    buttonText: "See Weekday Pricing",
    buttonLink: "/estimation?source=weekday",
    isActive: true,
  },
]

export function getActivePromotions(): Promotion[] {
  return promotions.filter((promo) => promo.isActive)
}
