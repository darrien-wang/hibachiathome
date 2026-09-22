import type { Metadata } from "next"
import Link from "next/link"
import { JsonLd, BUSINESS_ID } from "@/components/structured-data"
import { smsHref } from "@/config/site"
import LandingHero, { FIRST_MILES_FREE } from "@/components/city/landing-hero"
import LandingDiffs from "@/components/city/landing-diffs"
import { FactCards, FinalCta, LandingBody, LandingSection, LandingShell, PlaceChips, ReviewCards } from "@/components/city/landing-parts"

// 2026-09-21: rebuilt on the Joshua Tree shell (photo hero + the card that
// asks for the phone first). ChatGPT recommends this page, so the title,
// description, JSON-LD, h1 and every heading and paragraph keep their text;
// only the layout changed.

export const metadata: Metadata = {
  title: "Hibachi at Home Los Angeles & Orange County | Private Chef Catering",
  description:
    "Professional hibachi at home service in Los Angeles, Orange County & surrounding areas. Private hibachi chef brings authentic Japanese teppanyaki experience to your location. Book today!",
  keywords:
    "hibachi at home los angeles, private hibachi chef LA, hibachi catering los angeles, teppanyaki at home, japanese chef los angeles, hibachi party catering, private chef los angeles, hibachi grill rental LA",
  openGraph: {
    title: "Hibachi at Home Los Angeles | Private Chef Service",
    description:
      "Bring authentic hibachi experience to your home in LA. Professional chefs, premium ingredients, unforgettable entertainment.",
    url: "https://www.realhibachi.com/locations/la-orange-county",
    siteName: "Real Hibachi",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Los Angeles - Authentic Cooking with Amazing Flames',
      },
    ],
  },

  // Twitter Cards
  twitter: {
    card: 'summary_large_image',
    site: '@realhibachi',
    creator: '@realhibachi',
    title: 'Hibachi at Home Los Angeles | Private Chef Service',
    description: 'Authentic hibachi experience in LA & Orange County. Professional chefs bring Japanese teppanyaki to your home!',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

const serviceAreas = [
  "Los Angeles",
  "Orange County",
  "Beverly Hills",
  "Santa Monica",
  "Pasadena",
  "Irvine",
  "Newport Beach",
  "Anaheim",
  "Long Beach",
  "Burbank",
  "Glendale",
  "Huntington Beach",
  "Costa Mesa",
  "Fullerton",
  "Torrance",
  "West Hollywood",
  "Manhattan Beach",
  "Redondo Beach",
  "El Segundo",
  "Culver City",
]

// Verbatim 5-star Google reviews from the Real Hibachi listing (owner-supplied,
// 2026-08) — same pool as /quote and the homepage; do not invent locations/dates.
const testimonials = [
  {
    name: "Spencer Sprowls",
    rating: 5,
    text: "Bling is an amazing chef!! He makes the party 100x better and will make amazing food for you.",
  },
  {
    name: "David Armstrong",
    rating: 5,
    text: "Chef Bling curated a brilliant display of culinary mastery and phenomenal vibes to create an forgettable evening for the bros and I. 2 thumbs up.",
  },
  {
    name: "Max Schwenk",
    rating: 5,
    text: "Unbelievable experience! Bling was the best chef ever!",
  },
]

const features = [
  { title: "Professional Hibachi Chefs", description: "Trained Japanese teppanyaki chefs with years of experience" },
  { title: "Perfect for Any Event", description: "Birthday parties, corporate events, family gatherings, date nights" },
  { title: "Flexible Scheduling", description: "Available 7 days a week, lunch and dinner service" },
]

const laOcServiceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": "https://www.realhibachi.com/locations/la-orange-county#service",
  name: "Hibachi at Home in Los Angeles & Orange County",
  serviceType: "Private hibachi chef catering",
  provider: { "@id": BUSINESS_ID },
  description:
    "Private hibachi chef service across Los Angeles County and Orange County. The chef brings the grill, fresh ingredients, live cooking show, setup, and cleanup to your home or event space.",
  areaServed: serviceAreas.map((city) => ({ "@type": "City", name: `${city}, CA` })),
  offers: {
    "@type": "Offer",
    priceCurrency: "USD",
    price: "59.90",
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: "59.90",
      priceCurrency: "USD",
      unitText: "per adult ($29.90 per child 5–12, kids under 5 free, $599 event minimum)",
    },
    availability: "https://schema.org/InStock",
    url: "https://www.realhibachi.com/locations/la-orange-county",
  },
}

const INTRO =
  "Experience authentic Japanese hibachi and teppanyaki at your location in Los Angeles, Orange County, and surrounding areas. Professional private chefs bring restaurant-quality entertainment and cuisine directly to you."

export default function LAOrangeCountyPage() {
  return (
    <LandingShell>
      <JsonLd data={laOcServiceJsonLd} />
      <LandingHero
        kicker="Private hibachi chef · Los Angeles & Orange County"
        title={
          <>
            Hibachi at Home <span className="text-flame-300">Los Angeles</span>
          </>
        }
        subhead={INTRO}
        chips={["Free cancellation up to 72h", "500+ Events", "Same Day Available"]}
        imageAlt="Live hibachi fire show at a backyard party - hibachi at home in Los Angeles and Orange County"
        estimator={{ citySlug: "la-orange-county", cityName: "LA & Orange County", lockCity: true, source: "seo_location_la_oc", travelNote: FIRST_MILES_FREE }}
      />
      <LandingBody>
        <LandingDiffs distanceLine="Most of LA and Orange County sits inside the free 50 miles" />

        <p className="max-w-[760px] text-[15px] leading-relaxed lg:hidden">{INTRO}</p>

        <LandingSection
          title="Why Choose Our Hibachi at Home Service in LA?"
          lead="We're Los Angeles' premier hibachi at home service, bringing authentic Japanese teppanyaki experience to your doorstep"
        >
          <FactCards items={features.map((f) => ({ title: f.title, body: <p>{f.description}</p> }))} />
          <p className="text-sm">
            <Link href="/menu" className="font-semibold text-flame-700 underline">
              View Menu & Pricing
            </Link>
          </p>
        </LandingSection>

        <LandingSection
          title="Hibachi at Home Service Areas in Southern California"
          lead="Our professional hibachi chefs serve throughout Los Angeles County, Orange County, and surrounding areas"
        >
          <PlaceChips places={serviceAreas} />
          <div className="flex flex-col gap-2 rounded-[28px] border border-ink/10 bg-surface p-4 shadow-organic lg:p-6">
            <h3 className="font-serif text-xl font-extrabold leading-tight">Don&apos;t See Your Area?</h3>
            <p className="text-sm leading-relaxed text-clay-700">
              We serve many more locations throughout Southern California. Contact us to check availability in your area.
            </p>
            <a
              href={smsHref(
                [
                  "Hi! I'm interested in hibachi at home service in Los Angeles. Could you please let me know if you serve my area? Here are my details:",
                  "",
                  "Location: [Please specify your city/area]",
                  "Date needed: [Please specify]",
                  "Number of guests: [Please specify]",
                  "",
                  "Thank you!",
                ].join("\n"),
              )}
              className="text-sm font-semibold text-flame-700 underline"
            >
              Check My Area Availability
            </a>
          </div>
        </LandingSection>

        <LandingSection title="What Our Los Angeles Customers Say" lead="Real reviews from real hibachi at home experiences in LA">
          <ReviewCards reviews={testimonials.map((t) => ({ name: t.name, text: t.text, source: "Google review" }))} />
        </LandingSection>

        <FinalCta
          heading="Ready to Book Hibachi at Home in Los Angeles?"
          body="Join hundreds of satisfied customers who've experienced our authentic hibachi at home service. Book today and create unforgettable memories with family and friends."
        >
          <p className="pt-4 text-xs text-clay-600 lg:text-[13px]">Same-day booking available • Free consultation • 100% satisfaction guarantee</p>
        </FinalCta>
      </LandingBody>
    </LandingShell>
  )
}
