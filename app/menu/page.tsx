import type { Metadata } from "next"
import MenuTabs from "@/components/menu/menu-tabs"
import MenuEstimatorBar from "@/components/menu/menu-estimator-bar"

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

// 2026-09-08 redesign: title, one line, three tabs, and an estimator that
// stays on screen (sticky bar on phones, sticky card on desktop).
export default function MenuPage() {
  return (
    <div className="bg-cream text-ink">
      <div className="mx-auto max-w-7xl px-5 pb-32 pt-[calc(var(--header-height,60px)+16px)] lg:grid lg:grid-cols-[1fr_360px] lg:gap-14 lg:px-8 lg:pb-20 lg:pt-[calc(var(--header-height,72px)+36px)]">
        <div>
          <h1 className="font-serif text-[34px] font-extrabold leading-[1.05] lg:text-[52px]">Our Menu</h1>
          <p className="mt-2 max-w-[600px] text-sm leading-relaxed text-clay-700 lg:text-[17px]">
            Every guest picks 2 proteins. Fried rice, vegetables and salad included — refills free.
          </p>
          <div className="mt-3 lg:mt-6">
            <MenuTabs />
          </div>
        </div>
        <aside className="hidden lg:block">
          <div className="sticky top-[calc(var(--header-height,72px)+24px)]">
            <MenuEstimatorBar variant="card" />
          </div>
        </aside>
      </div>
      <MenuEstimatorBar variant="sticky" />
    </div>
  )
}
