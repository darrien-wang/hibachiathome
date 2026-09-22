import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { occasionPages } from "@/config/occasion-pages"
import { JsonLd, BUSINESS_ID } from "@/components/structured-data"
import LandingHero, { FIRST_MILES_FREE } from "@/components/city/landing-hero"
import LandingDiffs from "@/components/city/landing-diffs"
import LandingCtaButton from "@/components/city/landing-cta-button"
import { LandingBody, LandingShell } from "@/components/city/landing-parts"

const BASE_URL = "https://www.realhibachi.com"
const URL = `${BASE_URL}/party`

export const metadata: Metadata = {
  title: "Party Ideas | A Hibachi Chef for Every Occasion",
  description:
    "Birthdays, pool parties, reunions, holidays — if it's worth gathering for, it's worth a show. A private hibachi chef comes to you, anywhere in Southern California.",
  alternates: { canonical: URL },
  openGraph: {
    title: "Party Ideas | A Hibachi Chef for Every Occasion | Real Hibachi",
    description:
      "Birthdays, pool parties, reunions, holidays — a private hibachi chef and live fire show at your place, anywhere in Southern California.",
    url: URL,
    siteName: "Real Hibachi",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: `${BASE_URL}/images/hibachi-flame-og.png`,
        width: 1200,
        height: 630,
        alt: "Real Hibachi party occasions",
      },
    ],
  },
}

// 2026-09-08 redesign ("Realhibachi Party" board): kicker, one headline, one
// line, three chips, then the twelve occasions as tappable photo cards (the
// first one full-width), a gold "not listed?" card and a sticky quote bar.
export default function PartyHubPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "Party Ideas", item: URL },
    ],
  }

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Real Hibachi party occasions",
    itemListElement: occasionPages.map((page, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: page.headline,
      url: `${BASE_URL}/party/${page.slug}`,
    })),
  }

  const serviceProviderJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${URL}#service`,
    name: "Private hibachi chef for any occasion",
    serviceType: "Private hibachi chef catering",
    provider: { "@id": BUSINESS_ID },
    areaServed: { "@type": "State", name: "Southern California" },
  }

  // 2026-09-21: the Joshua Tree first screen - the card that asks for the
  // phone first - above the same occasion grid. h1, intro, chips and every
  // occasion card keep their text; the page's own "Get an Instant Quote" bar
  // is gone because the card brings its own.
  const intro = "Birthdays, pool parties, reunions, reveals, holidays — whatever brings your people together, we bring the chef, the fire, and the show."

  return (
    <LandingShell>
      <JsonLd data={[breadcrumbJsonLd, itemListJsonLd, serviceProviderJsonLd]} />
      <LandingHero
        kicker="Fire up your story."
        title="A Reason to Gather Is All You Need"
        subhead={intro}
        chips={["500+ parties served", "Full refund up to 72h", "All of Southern California"]}
        imageAlt="Guests gathered around a live hibachi fire show at a backyard party"
        estimator={{ citySlug: "socal", cityName: "Southern California", source: "occasion_hub", travelNote: FIRST_MILES_FREE, cardLabel: "Your party" }}
      />
      <LandingBody>
        <p className="text-[15px] leading-relaxed text-clay-700 lg:hidden">{intro}</p>

        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
          {occasionPages.map((page, i) => (
            <Link
              key={page.slug}
              href={`/party/${page.slug}`}
              className={`group flex flex-col overflow-hidden rounded-[28px] border border-ink/10 bg-white shadow-organic transition hover:border-flame-300 hover:shadow-organic-lg ${
                i === 0 ? "col-span-2" : ""
              }`}
            >
              <div className={`relative w-full overflow-hidden ${i === 0 ? "aspect-[16/9] lg:aspect-[2.4/1]" : "aspect-square lg:aspect-[4/3]"}`}>
                <Image
                  src={page.photos[0].src}
                  alt={page.photos[0].alt}
                  fill
                  sizes={i === 0 ? "(max-width: 1024px) 100vw, 1200px" : "(max-width: 1024px) 50vw, 300px"}
                  className="object-cover saturate-[1.12] transition duration-300 group-hover:scale-105"
                />
              </div>
              <div className="flex flex-col gap-0.5 px-3 pb-3.5 pt-3 lg:px-4 lg:pb-4">
                <h2 className="font-serif text-[17px] font-extrabold leading-tight lg:text-lg">{page.occasion}</h2>
                <p className="text-xs leading-snug text-clay-700 lg:text-[13px]">{page.subline}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="flex flex-col gap-2 rounded-[28px] bg-gold-100 p-[18px] text-gold-800 lg:flex-row lg:items-center lg:justify-between lg:p-6">
          <p className="text-base font-bold lg:text-lg">Celebrating something we haven&apos;t listed? We&apos;re still in.</p>
          <LandingCtaButton surface="occasion_hub" className="inline-flex h-12 items-center justify-center rounded-full bg-flame px-6 text-[15px] font-bold text-white hover:bg-flame-600">
            Get an Instant Quote
          </LandingCtaButton>
        </div>

        <LandingDiffs distanceLine="Most SoCal addresses carry no travel fee" />
      </LandingBody>
    </LandingShell>
  )
}
