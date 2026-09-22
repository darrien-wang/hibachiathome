import type { Metadata } from "next"
import MenuTabs from "@/components/menu/menu-tabs"
import LandingHero, { FIRST_MILES_FREE } from "@/components/city/landing-hero"
import LandingDiffs from "@/components/city/landing-diffs"
import { FinalCta, LandingBody, LandingShell } from "@/components/city/landing-parts"

export const metadata: Metadata = {
  title: "Hibachi at Home Menu & Pricing Los Angeles",
  description: "Explore our authentic hibachi menu and packages for Los Angeles & Orange County. Premium proteins, fresh vegetables, teppanyaki cooking. $59.90 per adult.",
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

// 2026-09-21: the Joshua Tree first screen. "Menu & Pricing" sitelinks on
// every campaign land here - 50 paid clicks and $267 since 09-13 for one lead,
// because the old estimator bar only linked out to /quote. The card now asks
// for the phone on the page; the three menu tabs follow straight after it.
// h1 "Our Menu" and the one-line intro keep their text.
const INTRO = "Every guest picks 2 proteins. Fried rice, vegetables and salad included — refills free."

export default function MenuPage() {
  return (
    <LandingShell>
      <LandingHero
        kicker="Hibachi at home menu & pricing"
        title="Our Menu"
        subhead={INTRO}
        chips={["2 proteins per guest", "Fried rice, vegetables & salad", "Refills free"]}
        imageAlt="Hibachi chef cooking steak, shrimp and fried rice on a teppanyaki grill at a backyard party"
        estimator={{ citySlug: "socal", cityName: "Southern California", source: "menu_estimator", travelNote: FIRST_MILES_FREE, cardLabel: "Your hibachi party" }}
      />
      <LandingBody>
        <section>
          <p className="max-w-[600px] text-sm leading-relaxed text-clay-700 lg:hidden">{INTRO}</p>
          <div className="mt-3 lg:mt-0">
            <MenuTabs />
          </div>
        </section>
        <LandingDiffs distanceLine="Most SoCal addresses carry no travel fee" />
        <FinalCta heading="Pick the proteins later — lock the date now" body="Your exact price is one number away. Guests choose their proteins before the party; the chef shops for exactly that." />
      </LandingBody>
    </LandingShell>
  )
}
