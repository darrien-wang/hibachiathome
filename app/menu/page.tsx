import { AnimateOnScroll } from "@/components/animate-on-scroll"
import PortionsBlock from "@/components/menu/portions-block"
import MenuDetails from "@/components/menu/menu-details"
import SourcingSpec from "@/components/menu/sourcing-spec"
import PricingBanner from "@/components/menu/pricing-banner"
import PriceTransparency from "@/components/menu/price-transparency"
import ServiceNotes from "@/components/menu/service-notes"
import { regularProteins, premiumProteins, sides } from "@/config/menu-items"
import { pricing } from "@/config/pricing"
import CityQuoteCalculator from "@/components/city/city-quote-calculator"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { smsHref } from "@/config/site"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Hibachi at Home Menu & Pricing Los Angeles",
  description: "Explore our authentic hibachi menu and packages for Los Angeles & Orange County. Premium proteins, fresh vegetables, teppanyaki cooking. Starting at $59.9 per person.",
  keywords: "hibachi menu Los Angeles, teppanyaki packages LA, Japanese food catering Orange County, hibachi pricing Los Angeles, authentic Japanese cuisine LA",
  openGraph: {
    title: "Hibachi at Home Menu & Pricing | Real Hibachi",
    description: "Authentic hibachi menu and packages for Los Angeles. Premium Japanese cuisine brought to your home by professional chefs.",
    url: "https://www.realhibachi.com/menu",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi Menu Los Angeles - Authentic Cooking Experience',
      },
    ],
  },
}

export default function MenuPage() {
  return (
    <div className="menu-page-safe container mx-auto px-4 py-12">
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

        {/* Paid "Menu & Pricing" sitelink lands here: 26 paid sessions / 0 form
            fills in the 8 days to 2026-09-07. Give them the same zero-input
            estimator the ad landing pages use (决策日志 D-0907-05). */}
        <AnimateOnScroll>
          <div className="mb-10">
            <CityQuoteCalculator
              citySlug="los-angeles"
              cityName="Los Angeles"
              source="menu_estimator"
              smsHref={smsHref("Hi! I was looking at your menu — can I get an exact quote for my party?")}
            />
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
          <PriceTransparency />
        </AnimateOnScroll>

        <AnimateOnScroll>
          <ServiceNotes />
        </AnimateOnScroll>

        <AnimateOnScroll>
          <PortionsBlock />
        </AnimateOnScroll>

        <AnimateOnScroll>
          <MenuDetails proteins={regularProteins} premiumProteins={premiumProteins} sides={sides} />
        </AnimateOnScroll>

        <AnimateOnScroll>
          <div className="mt-16">
            <SourcingSpec adultPrice={pricing.packages.basic.perPerson} />
          </div>
        </AnimateOnScroll>

        <AnimateOnScroll>
          <div className="mt-12 text-center">
            <Button asChild size="lg" className="rounded-full bg-[hsl(24_79%_55%)] px-8 text-base font-semibold text-white hover:bg-[hsl(24_79%_48%)]">
              <Link href="/quote?source=menu_bottom">See your exact price — 30 seconds</Link>
            </Button>
            <p className="mt-2 text-sm text-gray-500">No phone number needed. Any travel fee shows before you pay.</p>
          </div>
        </AnimateOnScroll>

      </div>
    </div>
  )
}
