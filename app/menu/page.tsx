import { AnimateOnScroll } from "@/components/animate-on-scroll"
import MenuDetails from "@/components/menu/menu-details"
import PricingBanner from "@/components/menu/pricing-banner"
import ServiceNotes from "@/components/menu/service-notes"
import Testimonials from "@/components/menu/testimonials"
import { regularProteins, premiumProteins, sides } from "@/config/menu-items"
import { pricing } from "@/config/pricing"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Menu & Packages",
}

export default function MenuPage() {
  // 示例评价数据
  const testimonials = [
    {
      name: "Sarah M.",
      rating: 5,
      comment: "The hibachi experience was amazing! Our chef was entertaining and the food was delicious.",
    },
    {
      name: "Michael T.",
      rating: 5,
      comment: "We booked for our anniversary and it exceeded all expectations. Restaurant-quality hibachi at home!",
    },
    {
      name: "Jennifer L.",
      rating: 5,
      comment:
        "Our family gathering was transformed into an unforgettable event. The chef was professional and friendly, and put on an amazing show!",
    },
    {
      name: "David W.",
      rating: 5,
      comment: "Perfect for our office party. Everyone was impressed with both the performance and the food quality.",
    },
  ]

  return (
    <div className="container mx-auto px-4 py-12 pt-24 mt-16">
      <div className="max-w-6xl mx-auto">
        <AnimateOnScroll direction="down">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold mb-4">Our Menu</h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Explore our hibachi menu options, featuring premium proteins, fresh vegetables, and authentic Japanese
              flavors.
            </p>
          </div>
        </AnimateOnScroll>

        <AnimateOnScroll>
          <PricingBanner
            adultPrice={pricing.packages.basic.perPerson}
            childPrice={pricing.children.basic}
            minimumTotal={pricing.packages.basic.minimum}
          />
        </AnimateOnScroll>

        <AnimateOnScroll>
          <ServiceNotes />
        </AnimateOnScroll>

        <AnimateOnScroll>
          <MenuDetails proteins={regularProteins} premiumProteins={premiumProteins} sides={sides} />
        </AnimateOnScroll>

        <AnimateOnScroll direction="up">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold mb-4">What Our Customers Say</h2>
            <Testimonials testimonials={testimonials} />
          </div>
        </AnimateOnScroll>
      </div>
    </div>
  )
}
