import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getCityPage, getNearbyCityPages } from "@/config/city-pages"
import { CATERING_CITIES } from "@/config/catering-cities"
import { getCityClimate } from "@/config/city-climate"
import { getCityTravel } from "@/config/city-travel"
import { pickReviews } from "@/config/reviews"
import { coastalHero } from "@/config/coastal-cities"
import LandingTemplate from "@/components/city/landing-template"
import GeoCityName from "@/components/city/geo-city-name"
import { JsonLd, BUSINESS_ID } from "@/components/structured-data"
import { phone } from "@/config/site"

const BASE_URL = "https://www.realhibachi.com"
const PHONE_RAW = phone.sms.e164

// The "hibachi catering {city}" SERP is a separate keyword family from
// "hibachi at home {city}" — competitors rank both with twin pages. These
// pages take the event/host framing (bigger groups, planned occasions) while
// the /hibachi-at-home twins keep the family-dinner framing, and the two
// cross-link so they reinforce instead of cannibalizing.
export async function generateStaticParams() {
  return CATERING_CITIES.map((city) => ({ city }))
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params
  const page = getCityPage(city)
  if (!page || !CATERING_CITIES.includes(city as (typeof CATERING_CITIES)[number])) {
    return { title: "Page Not Found" }
  }
  const url = `${BASE_URL}/hibachi-catering/${page.slug}`
  const title = `Hibachi Catering ${page.city} CA | Chef & Show from $59.90/Person`
  const description = `Hibachi catering for ${page.city} events: a private chef, mobile teppanyaki grill, and live fire show come to your venue or backyard. Flat $59.90/adult, published pricing, instant quote.`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} | Real Hibachi`,
      description,
      url,
      siteName: "Real Hibachi",
      locale: "en_US",
      type: "website",
      images: [
        {
          url: `${BASE_URL}/images/hibachi-flame-og.png`,
          width: 1200,
          height: 630,
          alt: `Hibachi catering in ${page.city}, CA`,
        },
      ],
    },
  }
}

const included = [
  "Professional hibachi chef & mobile teppanyaki grill",
  "2 proteins per guest: chicken, steak, shrimp, salmon or tofu",
  "Garlic butter fried rice, vegetables & salad — refills free",
  "Live fire show, games and chef entertainment",
  "Complete setup and cleanup — your venue stays spotless",
]

const eventTypes = [
  {
    title: "Big group? That's the point.",
    description:
      "One chef serves up to ~25 guests with the full show; larger events get a second chef and grill so every table has a front row. Tell us the headcount and we bring the right crew.",
  },
  {
    title: "Corporate & team events",
    description:
      "Office parties, launch dinners, wrap parties — a hibachi show is the team event people actually talk about after. Weekday dates get the $54.90/adult Weekday Special with a free appetizer platter.",
  },
  {
    title: "Milestones & celebrations",
    description:
      "Birthdays, graduations, showers, reunions — the chef builds the show around your moment. See our party ideas for how each occasion plays out.",
  },
]

export default async function CateringCityPage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params
  const page = getCityPage(city)
  if (!page || !CATERING_CITIES.includes(city as (typeof CATERING_CITIES)[number])) {
    notFound()
  }

  const url = `${BASE_URL}/hibachi-catering/${page.slug}`
  const atHomeUrl = `/hibachi-at-home/${page.slug}`
  const source = `catering_${page.slug.replace(/-/g, "_")}`
  const smsHref = `sms:${PHONE_RAW}?body=${encodeURIComponent(
    `Hi Real Hibachi! I'm planning an event in ${page.city} and would love a catering quote.`,
  )}`
  const nearby = getNearbyCityPages(page)
  const reviews = pickReviews(`${page.slug}-catering`)
  const climate = getCityClimate(page.slug)
  const travel = getCityTravel(page.slug)

  const faqs = [
    {
      question: `How much does hibachi catering cost in ${page.city}?`,
      answer: `$59.90 per adult and $29.90 per child (5–12), with a $599 event minimum — food, chef, live show, setup, and cleanup included. Monday–Thursday events get the $54.90/adult Weekday Special at any size, with a free appetizer platter. The first 50 miles of travel are free; anything beyond is $1/mile, shown upfront in your quote.`,
    },
    {
      question: "How many guests can you cater?",
      answer:
        "One chef comfortably serves up to about 25 guests. Bigger event? We bring additional chefs and grills so the show reaches every table — 50, 80, 100+ guests are all doable with notice. Tell us your headcount in the quote and we'll staff it right.",
    },
    {
      question: "Do you cater at venues, offices, or rentals — or just homes?",
      answer:
        "Anywhere with an outdoor spot for the grill: backyards, rooftops, office patios, event venues, parks with permits, Airbnbs. We need about a 6x8 ft flat area with 10 ft of overhead clearance in open air. Guests can eat indoors while the chef cooks outside.",
    },
    {
      question: "What do we need to provide?",
      answer:
        "Tables, chairs, and place settings — or add our tableware rental ($15/person: tables, chairs, tableware, tablecloth) and provide nothing. We bring the chef, grill, all food, and take everything away after.",
    },
    {
      question: "How far ahead should we book?",
      answer:
        "Weekend evenings go first — two to three weeks ahead is comfortable, and a $19.90 refundable deposit locks your date. Weekday corporate events can often be booked closer in. Cancel or reschedule 72+ hours out for a full deposit refund.",
    },
  ]

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${url}#service`,
    name: `Hibachi Catering in ${page.city}, CA`,
    serviceType: "Hibachi event catering",
    provider: { "@id": BUSINESS_ID },
    description: `Private hibachi chef and mobile teppanyaki catering for events in ${page.city}, CA — corporate parties, celebrations, and large gatherings.`,
    areaServed: [
      { "@type": "City", name: `${page.city}, CA` },
      ...page.neighborhoods.map((name) => ({ "@type": "Place", name: `${name}, CA` })),
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
      url,
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
      { "@type": "ListItem", position: 2, name: "Hibachi Catering", item: `${BASE_URL}/hibachi-catering/los-angeles` },
      { "@type": "ListItem", position: 3, name: page.city, item: url },
    ],
  }

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#package`,
    name: `Hibachi Catering Package — ${page.city}, CA`,
    description: `Private hibachi chef, mobile teppanyaki grill, live fire show, 2 proteins per guest, sides, setup and cleanup — catered at your ${page.city} event.`,
    image: `${BASE_URL}/images/hibachi-flame-og.png`,
    brand: { "@type": "Brand", name: "Real Hibachi" },
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: "59.90",
      priceValidUntil: "2027-12-31",
      availability: "https://schema.org/InStock",
      url,
    },
    review: reviews.map((review) => ({
      "@type": "Review",
      reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" },
      author: { "@type": "Person", name: review.name },
      reviewBody: review.text,
    })),
  }

  const otherCatering = CATERING_CITIES.filter((slug) => slug !== page.slug)
    .map((slug) => getCityPage(slug))
    .filter((other): other is NonNullable<typeof other> => Boolean(other))

  return (
    <>
      <JsonLd data={[serviceJsonLd, faqJsonLd, breadcrumbJsonLd, productJsonLd]} />
      <LandingTemplate
        {...coastalHero(page.slug, page.city)}
        city={page.city}
        citySlug={page.slug}
        source={source}
        smsHref={smsHref}
        kicker={`Hibachi catering · ${page.city} & all of SoCal`}
        title={
          <>
            Hibachi Catering in <GeoCityName fallback={page.city} />
          </>
        }
        subhead="The caterer that brings dinner and the show — a private chef, the teppanyaki grill and live fire at your venue or backyard."
        distanceMiles={travel?.miles ?? null}
        travelFee={travel?.fee ?? null}
        reviews={reviews}
        included={included}
        hoods={page.neighborhoods}
        hoodsHeading={`Where we cater in ${page.city}`}
        bestEvening={climate?.bestEvening}
        details={[
          {
            title: "Who books hibachi catering",
            body: (
              <>
                <p>Trays of lukewarm food are catering. A chef cooking live with fire, games, and a crowd around the grill is an event.</p>
                {eventTypes.map((type) => (
                  <p key={type.title}>
                    <strong className="text-ink">{type.title}</strong> {type.description}
                  </p>
                ))}
                <p>
                  Planning a specific occasion? <Link href="/party" className="underline">See our party ideas</Link> — birthdays, pool parties, corporate nights, and more.
                </p>
              </>
            ),
          },
          {
            title: "Parking, stairs & setup",
            body: (
              <>
                {page.logistics.map((paragraph) => (
                  <p key={paragraph.slice(0, 32)}>{paragraph}</p>
                ))}
              </>
            ),
          },
        ]}
        detailsHeading={`${page.city} event details`}
        faqs={faqs}
        faqHeading={`${page.city} catering FAQ`}
        ctaHeading={`Fire up your ${page.city} event.`}
        ctaBody="Headcount, date, venue — done. A $19.90 deposit locks your chef, and we staff the show to the room."
        nearby={[
          ...otherCatering.slice(0, 4).map((other) => ({ label: `${other.city} catering`, href: `/hibachi-catering/${other.slug}` })),
          ...nearby.slice(0, 2).map((other) => ({ label: `${other.city} at home`, href: `/hibachi-at-home/${other.slug}` })),
        ]}
        nearbyLabel="Hibachi catering nearby"
        footnote={
          <>
            Hosting a smaller dinner at home?{" "}
            <Link href={atHomeUrl} className="underline hover:text-flame-700">
              Hibachi at Home in {page.city}
            </Link>{" "}
            has the family-dinner details.
          </>
        }
      />
    </>
  )
}
