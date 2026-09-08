import type { Metadata } from "next"
import { pickReviews } from "@/config/reviews"
import { cityPages } from "@/config/city-pages"
import LandingTemplate from "@/components/city/landing-template"
import GeoCityName from "@/components/city/geo-city-name"
import { JsonLd, BUSINESS_ID } from "@/components/structured-data"
import { smsHref } from "@/config/site"

const BASE_URL = "https://www.realhibachi.com"
const URL = `${BASE_URL}/mobile-hibachi`

export const metadata: Metadata = {
  title: "Mobile Hibachi Los Angeles & SoCal | Chef & Grill Come to You from $59.90",
  description:
    "Mobile hibachi catering across Los Angeles, Orange County, San Diego & all of Southern California. A private chef and teppanyaki grill travel to your backyard or venue. $59.90/adult, setup & cleanup included, $19.90 deposit.",
  alternates: { canonical: URL },
  openGraph: {
    title: "Mobile Hibachi Los Angeles & SoCal | Real Hibachi",
    description:
      "Mobile hibachi catering across Southern California — private chef, teppanyaki grill, and the full fire show at your home or venue. $59.90/adult, published pricing.",
    url: URL,
    siteName: "Real Hibachi",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: `${BASE_URL}/images/hibachi-flame-og.png`,
        width: 1200,
        height: 630,
        alt: "Mobile hibachi chef and grill in Southern California",
      },
    ],
  },
}

const included = [
  "Professional hibachi chef & mobile teppanyaki grill — we bring everything",
  "2 proteins per guest: chicken, steak, shrimp, salmon or tofu",
  "Garlic butter fried rice, vegetables & salad — refills free",
  "Onion volcano, egg toss, fire tricks, crowd games",
  "Complete setup and cleanup — tarp under the grill, spotless when we leave",
]

const showActs = [
  { title: "The Onion Volcano", description: "The classic — a stacked onion tower erupting in flame right on the grill." },
  { title: "Egg Toss & Catch", description: "Eggs flipped off the spatula, caught in hats, pockets, and (sometimes) mouths." },
  { title: "Fire Tricks", description: "Real flames, safely handled — the moment every phone comes out to record." },
  { title: "Crowd Games", description: "Food tosses to your guests, jokes, and a chef who reads the room — kids' table included." },
]

const faqs = [
  {
    question: "What does 'mobile hibachi' include — do you really bring everything?",
    answer:
      "Yes. Our mobile hibachi setup means the chef arrives with the teppanyaki grill, propane, fresh ingredients, utensils for cooking, and a protective tarp. You provide the space, tables, and plates — or rent tables, chairs, and place settings from us. Setup and cleanup are included in the price.",
  },
  {
    question: "Where can a mobile hibachi grill set up?",
    answer:
      "Any flat outdoor spot about 6x8 ft with roughly 10 ft of overhead clearance: a backyard, patio, deck, driveway, apartment courtyard, or roof terrace. Cooking is always outdoors — a live grill throws real smoke — but your guests can eat indoors while the chef cooks outside.",
  },
  {
    question: "How far will your mobile hibachi travel?",
    answer:
      "We serve all of Southern California — Los Angeles, Orange County, San Diego, the Inland Empire, and out to Palm Springs and Temecula. The first 50 miles of travel are free, then $1 per additional mile, calculated from your address and shown in your quote before you pay anything.",
  },
  {
    question: "How much does mobile hibachi cost?",
    answer:
      "$59.90 per adult, $29.90 per child 5–12, kids under 5 eat free, with a $599 event minimum. Monday–Thursday parties get our Weekday Special at any size: $54.90 per adult plus a free appetizer platter. Pricing is published — no phone number required to see your total.",
  },
  {
    question: "Do you need power or water at the site?",
    answer:
      "No. The grill runs on propane we bring, and the chef arrives with everything prepped. If your party is at a park or venue, just confirm open-flame cooking is allowed there and we handle the rest.",
  },
  {
    question: "Can I cancel or reschedule?",
    answer:
      "Yes. Cancel or reschedule at least 72 hours before your event for a full refund of the $19.90 deposit. Changes inside 72 hours may make the deposit non-refundable.",
  },
]

export default function MobileHibachiPage() {
  const reviews = pickReviews("mobile-hibachi")

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${URL}#service`,
    name: "Mobile Hibachi Catering in Southern California",
    serviceType: "Mobile hibachi catering",
    provider: { "@id": BUSINESS_ID },
    description:
      "Mobile hibachi service: a private chef and teppanyaki grill travel to your home, backyard, or venue anywhere in Southern California.",
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
      { "@type": "ListItem", position: 2, name: "Mobile Hibachi", item: URL },
    ],
  }

  // Real, verbatim on-page Google reviews only. No aggregateRating: the live
  // GBP profile can't verify one (see city pages for the same rule).
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${URL}#package`,
    name: "Mobile Hibachi Party Package — Southern California",
    description:
      "Private hibachi chef, mobile teppanyaki grill, live fire show, 2 proteins per guest, fried rice, vegetables, salad, setup and cleanup — anywhere in Southern California.",
    image: `${BASE_URL}/images/hibachi-flame-og.png`,
    brand: { "@type": "Brand", name: "Real Hibachi" },
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: "59.90",
      priceValidUntil: "2027-12-31",
      availability: "https://schema.org/InStock",
      url: URL,
    },
    review: reviews.map((review) => ({
      "@type": "Review",
      reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" },
      author: { "@type": "Person", name: review.name },
      reviewBody: review.text,
    })),
  }

  const topCities = cityPages.slice(0, 12)

  return (
    <>
      <JsonLd data={[serviceJsonLd, faqJsonLd, breadcrumbJsonLd, productJsonLd]} />
      <LandingTemplate
        city="Southern California"
        citySlug="mobile-hibachi"
        source="mobile_hibachi"
        smsHref={smsHref("Hi! I'd like a quote for a mobile hibachi party.")}
        kicker="Mobile hibachi · Los Angeles, OC, San Diego & all of SoCal"
        title={
          <>
            Mobile Hibachi in <GeoCityName fallback="Los Angeles & SoCal" />
          </>
        }
        subhead="The restaurant comes to you: a private chef, the teppanyaki grill and the full fire show in your backyard, driveway or venue."
        reviews={reviews}
        included={included}
        hoods={topCities.map((c) => c.city)}
        hoodsHeading="Where the grill travels"
        bestEvening="April – November"
        details={[
          {
            title: "The show that travels with us",
            body: (
              <>
                {showActs.map((act) => (
                  <p key={act.title}>
                    <strong className="text-ink">{act.title}.</strong> {act.description}
                  </p>
                ))}
              </>
            ),
          },
          {
            title: "Why hosts book mobile hibachi",
            body: (
              <>
                <p>
                  A mobile hibachi party means the restaurant comes to you: a private chef pulls up with the teppanyaki grill, fresh ingredients, and the full fire show, and cooks course by course in your backyard, on your driveway, or at your venue.
                </p>
                <p>
                  No reservations, no parking downtown, no splitting the check across four tables. Mobile hibachi catering from Real Hibachi serves Los Angeles, Orange County, San Diego, and everywhere in between.
                </p>
              </>
            ),
          },
        ]}
        detailsHeading="Mobile hibachi details"
        faqs={faqs}
        faqHeading="Mobile hibachi FAQ"
        ctaHeading="Your place. Our grill."
        ctaBody="See your exact mobile hibachi price in 30 seconds — no phone number, no sign-up. A $19.90 deposit locks your chef."
        nearby={topCities.slice(0, 6).map((c) => ({ label: c.city, href: `/hibachi-at-home/${c.slug}` }))}
        nearbyLabel="Local pages"
      />
    </>
  )
}
