import type { Metadata } from "next"
import Link from "next/link"
import { CATERING_CITIES } from "@/config/catering-cities"
import { getCityPage } from "@/config/city-pages"
import { occasionPages } from "@/config/occasion-pages"
import { pickReviews, reviewSourceLabel } from "@/config/reviews"
import AppreciationBanner from "@/components/appreciation-banner"
import { JsonLd, BUSINESS_ID } from "@/components/structured-data"
import LandingHero, { FIRST_MILES_FREE } from "@/components/city/landing-hero"
import LandingDiffs from "@/components/city/landing-diffs"
import { CheckList, FaqList, FinalCta, LandingBody, LandingSection, LandingShell, LinkPills, ReviewCards } from "@/components/city/landing-parts"

// 2026-09-21: rebuilt on the Joshua Tree shell. ChatGPT recommends this hub
// and the LA Occasions "Large Party 20+" ads land here, so the card opens at
// 20 adults and asks for the phone first. Metadata, JSON-LD, the h1 and every
// heading, paragraph and FAQ keep their text - only the layout changed.

const BASE_URL = "https://www.realhibachi.com"
const URL = `${BASE_URL}/hibachi-catering`

export const metadata: Metadata = {
  title: "Hibachi Catering Los Angeles, OC & San Diego | From $59.90/Person",
  description:
    "Hibachi catering for parties and events across Southern California — chef, teppanyaki grill, and live fire show at your home or venue. Published pricing from $59.90/adult, one chef per 28 guests, any party size.",
  alternates: { canonical: URL },
  openGraph: {
    title: "Hibachi Catering Los Angeles, OC & San Diego | Real Hibachi",
    description:
      "Hibachi catering for parties and events — chef, grill, and live show at your venue. Published pricing from $59.90/person.",
    url: URL,
    siteName: "Real Hibachi",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: `${BASE_URL}/images/hibachi-flame-og.png`,
        width: 1200,
        height: 630,
        alt: "Hibachi catering event in Southern California",
      },
    ],
  },
}

const included = [
  "Professional hibachi chef & mobile teppanyaki grill per 28 guests",
  "2 regular proteins per guest (chicken, steak, shrimp, salmon, or tofu)",
  "Garlic butter fried rice, fresh vegetables & house salad",
  "Live cooking show — fire tricks, egg toss, chef entertainment",
  "Complete setup and cleanup at your home or venue",
]

const faqs = [
  {
    question: "How does hibachi catering work for a big event?",
    answer:
      "One chef and one teppanyaki grill serve up to 28 guests. Larger events simply get more crews — one per 28 guests — under a single booking, one point of contact, and one bill. A 100-person party runs four grills cooking simultaneously so everyone eats hot food at the same time.",
  },
  {
    question: "How much does hibachi catering cost?",
    answer:
      "$59.90 per adult, $29.90 per child 5–12, kids under 5 eat free, with a $599 event minimum. Monday–Thursday events get the Weekday Special at any size: $54.90 per adult plus a free appetizer platter. Parties of 10–14 guests save $30, 15–24 save $60, 25–30 save $90 — any day, applied automatically. Pricing is published — the instant quote shows your price range with no sign-up, and your exact total including any travel fee comes by text before you pay anything.",
  },
  {
    question: "Do you cater corporate events and offices?",
    answer:
      "Yes — office parties, team celebrations, and client events are a growing part of our calendar. The grill needs an outdoor spot (courtyard, patio, parking area) with about 10 ft of overhead clearance. If your building has vendor requirements, text us the details before you book and we'll confirm what we can provide.",
  },
  {
    question: "Can you cater at a park or rented venue?",
    answer:
      "Usually yes. We cook on propane, so we need the venue to allow open-flame cooking outdoors — most parks with BBQ areas and most private venues do. Confirm with your venue, tell us the address, and we handle everything else.",
  },
  {
    question: "What about dietary restrictions across a big guest list?",
    answer:
      "Standard at every event: vegetarian and vegan guests get tofu and extra vegetables at the same per-person rate, gluten-free guests can bring preferred sauces and we cook on a separate station, and we review allergy labels with you before the date. Collect your guests' needs and we plan the grill around them.",
  },
  {
    question: "How far in advance should we book?",
    answer:
      "Weekend evening slots go first — two to three weeks ahead is comfortable for most dates, and longer for December and graduation season. Weekday and daytime slots are often available on shorter notice.",
  },
]

const INTRO = [
  "Hibachi catering turns any gathering into dinner and a show: our chefs bring the teppanyaki grills to your home, office, or venue and cook live for parties of 10 to 100+.",
  "One chef and grill per 28 guests, published pricing, and a single booking no matter how big the guest list — serving Los Angeles, Orange County, San Diego, and the Inland Empire.",
]

export default function HibachiCateringHubPage() {
  const reviews = pickReviews("hibachi-catering-hub")
  const cateringCityPages = CATERING_CITIES.map((slug) => getCityPage(slug)).filter(
    (page): page is NonNullable<ReturnType<typeof getCityPage>> => Boolean(page),
  )

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${URL}#service`,
    name: "Hibachi Catering in Southern California",
    serviceType: "Hibachi event catering",
    provider: { "@id": BUSINESS_ID },
    description:
      "Hibachi catering for parties, celebrations, and corporate events across Southern California — private chefs, mobile teppanyaki grills, and a live fire show at your home or venue.",
    areaServed: [
      { "@type": "AdministrativeArea", name: "Los Angeles County, CA" },
      { "@type": "AdministrativeArea", name: "Orange County, CA" },
      { "@type": "AdministrativeArea", name: "San Diego County, CA" },
      { "@type": "AdministrativeArea", name: "Riverside County, CA" },
      { "@type": "AdministrativeArea", name: "San Bernardino County, CA" },
      { "@type": "AdministrativeArea", name: "Ventura County, CA" },
    ],
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
      url: URL,
    },
  }

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  }

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "Hibachi Catering", item: URL },
    ],
  }

  return (
    <LandingShell>
      <JsonLd data={[serviceJsonLd, faqJsonLd, breadcrumbJsonLd]} />
      <LandingHero
        breadcrumb={
          <nav aria-label="Breadcrumb">
            <Link href="/" className="hover:underline">
              Home
            </Link>
            {" / "}
            <span>Hibachi Catering</span>
          </nav>
        }
        kicker="Hibachi catering · LA, OC, San Diego & Inland Empire"
        title={
          <>
            Hibachi Catering Across <span className="text-flame-300">Southern California</span>
          </>
        }
        subhead={INTRO[0]}
        chips={["Free cancellation up to 72h", "1 Chef & Grill per 28 Guests", "Our Own Chefs", "Setup & Cleanup Included"]}
        imageAlt="Hibachi catering event in Southern California - live teppanyaki fire show"
        estimator={{
          citySlug: "socal",
          cityName: "Southern California",
          lockCity: true,
          source: "seo_hibachi_catering_hub",
          travelNote: FIRST_MILES_FREE,
          cardLabel: "Your catering event",
          defaults: { adults: 20, kids: 0 },
        }}
      />
      <LandingBody>
        <LandingDiffs distanceLine="Most SoCal addresses carry no travel fee" />

        <div className="flex max-w-[760px] flex-col gap-3 text-[15px] leading-relaxed lg:text-[17px]">
          {INTRO.map((p, i) => (
            <p key={p.slice(0, 24)} className={i > 0 ? "text-clay-700" : ""}>
              {p}
            </p>
          ))}
        </div>

        <LandingSection title="Catering Pricing, Published">
          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-10">
            <div className="flex flex-col gap-2">
              <p className="font-serif text-5xl font-extrabold leading-none">
                $59.90<span className="font-sans text-lg font-medium text-clay-600">/adult</span>
              </p>
              <p className="text-sm text-clay-700 lg:text-[15px]">$29.90 per child 5–12 · kids under 5 eat free · $599 event minimum</p>
              <p className="text-sm text-clay-700 lg:text-[15px]">
                Weekday Special: <strong>$54.90/adult</strong> for Mon–Thu events, any size, with a free appetizer platter.
              </p>
              <p className="text-xs leading-relaxed text-clay-600 lg:text-[13px]">
                No per-guest setup surcharge and no fee to add more grills — the per-person price is the price at 10 guests or 100. The first 50 miles of travel are free, then $1 per additional mile, shown in your quote before you pay. Gratuity (20–25%) is the only thing not included.
              </p>
            </div>
            <div className="flex flex-col gap-3 rounded-[28px] border border-ink/10 bg-surface p-5 shadow-organic">
              <h3 className="font-serif text-xl font-extrabold leading-tight">Every catering booking includes</h3>
              <CheckList items={included} />
            </div>
          </div>
          <AppreciationBanner source="hibachi_catering_hub" />
        </LandingSection>

        <LandingSection title="Occasions We Cater" lead="Every occasion gets its own playbook — see how a hibachi party fits yours.">
          <LinkPills links={occasionPages.map((occasion) => ({ label: occasion.occasion, href: `/party/${occasion.slug}` }))} />
        </LandingSection>

        <LandingSection title="What Hosts Say">
          <ReviewCards reviews={reviews.map((review) => ({ name: review.name, text: review.text, source: reviewSourceLabel(review) }))} />
        </LandingSection>

        <FaqList
          heading="Hibachi Catering Questions"
          faqs={faqs}
          footer={
            <Link href="/faq" className="font-semibold text-flame-700 underline">
              View All FAQs
            </Link>
          }
        />

        <LandingSection title="Hibachi Catering by City" lead="Local pricing, travel details, and neighborhood coverage for each metro we cater.">
          <LinkPills links={cateringCityPages.map((city) => ({ label: city.city, href: `/hibachi-catering/${city.slug}` }))} />
        </LandingSection>

        <FinalCta
          heading="Feed Everyone. Entertain Everyone."
          body="See your hibachi catering price range in 30 seconds — any party size. Exact quote and party discount by text."
        />
      </LandingBody>
    </LandingShell>
  )
}
