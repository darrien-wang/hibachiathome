import type { Metadata } from "next"
import { pickReviews } from "@/config/reviews"
import { cityPages } from "@/config/city-pages"
import LandingTemplate from "@/components/city/landing-template"
import GeoCityName from "@/components/city/geo-city-name"
import { JsonLd, BUSINESS_ID } from "@/components/structured-data"
import { smsHref } from "@/config/site"

const BASE_URL = "https://www.realhibachi.com"
const URL = `${BASE_URL}/private-hibachi-chef`

export const metadata: Metadata = {
  title: "Private Hibachi Chef Los Angeles & SoCal | Hire a Teppanyaki Chef from $59.90",
  description:
    "Hire a private hibachi chef for your home, backyard, or event in Los Angeles, Orange County, San Diego & all of Southern California. Live teppanyaki show, $59.90/adult, chef confirmed by name 48h ahead, $19.90 deposit.",
  alternates: { canonical: URL },
  openGraph: {
    title: "Private Hibachi Chef Los Angeles & SoCal | Real Hibachi",
    description:
      "Hire a private hibachi chef — live teppanyaki cooking and fire show at your home or venue anywhere in Southern California. $59.90/adult, published pricing.",
    url: URL,
    siteName: "Real Hibachi",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: `${BASE_URL}/images/hibachi-flame-og.png`,
        width: 1200,
        height: 630,
        alt: "Private hibachi chef cooking at a backyard party in Southern California",
      },
    ],
  },
}

const included = [
  "A private hibachi chef from our own team — never a gig-app dispatch",
  "Mobile teppanyaki grill, propane and fresh ingredients — all brought to you",
  "2 proteins per guest: chicken, steak, shrimp, salmon or tofu",
  "Garlic butter fried rice, vegetables & salad — refills free",
  "Live show — fire tricks, onion volcano, egg toss, crowd games",
  "Complete setup and cleanup",
]

const chefPromises = [
  {
    title: "Confirmed by name, 48 hours ahead",
    description:
      "Two days before your party you know exactly which chef is coming. If Real Hibachi ever has to cancel on you, we refund double your deposit and give you first priority to rebook.",
  },
  {
    title: "Our own team, not an app",
    description:
      "Every private hibachi chef we send is part of our own SoCal crew — trained on the same menu, the same show, and the same cleanup standard. Nobody is dispatched from a marketplace.",
  },
  {
    title: "A show calibrated to your table",
    description:
      "Kids' birthday, bachelorette weekend, or a quiet anniversary dinner — the chef reads the room and adjusts the jokes, the games, and the pace to match.",
  },
  {
    title: "Your kitchen stays closed",
    description:
      "The chef cooks outdoors on our grill with our ingredients and leaves the area the way it was found — tarp under the station, full cleanup before leaving.",
  },
]

const faqs = [
  {
    question: "How do I hire a private hibachi chef?",
    answer:
      "Get an instant quote online — date, guest count, and address are all we need. A $19.90 deposit locks your date, and your chef is confirmed by name 48 hours before the event. The whole thing takes about two minutes and no phone call is required.",
  },
  {
    question: "How much does a private hibachi chef cost?",
    answer:
      "$59.90 per adult, $29.90 per child 5–12, kids under 5 eat free, with a $599 event minimum — chef, grill, food, show, setup, and cleanup all included. Monday–Thursday parties get the Weekday Special at any size: $54.90 per adult plus a free appetizer platter. Gratuity (20–25%) is the only thing not in the quote.",
  },
  {
    question: "Who are your chefs?",
    answer:
      "Our chefs are our own employees — a local Southern California team trained in teppanyaki cooking and live entertainment. We are licensed and insured, and because chefs aren't pulled from a gig marketplace, the person we confirm is the person who shows up.",
  },
  {
    question: "Can I request a specific chef?",
    answer:
      "Yes — tell us when you book. Guests often re-book the chef from their last party by name. We'll confirm availability for your date, and either way your assigned chef is locked in and named 48 hours ahead.",
  },
  {
    question: "How many chefs does my party need?",
    answer:
      "One chef and one grill comfortably serve up to 28 guests. Larger parties get additional chefs and grills — one crew per 28 guests — under a single booking, so a 60-person event runs as smoothly as a dinner for 10.",
  },
  {
    question: "What does the chef need from me?",
    answer:
      "A flat outdoor spot about 6x8 ft with 10 ft of overhead clearance, plus tables and place settings for your guests (or rent them from us). The chef brings everything else, arrives about 10 minutes early, and handles setup and cleanup.",
  },
  {
    question: "Can I cancel or reschedule my chef?",
    answer:
      "Yes. Cancel or reschedule at least 72 hours before your event and the $19.90 deposit is refunded in full. Changes inside 72 hours may make the deposit non-refundable. And the promise runs both ways — if Real Hibachi ever cancels on you, you get double your deposit back.",
  },
]

export default function PrivateHibachiChefPage() {
  const reviews = pickReviews("private-hibachi-chef")

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${URL}#service`,
    name: "Private Hibachi Chef in Southern California",
    serviceType: "Private hibachi chef",
    provider: { "@id": BUSINESS_ID },
    description:
      "Hire a private hibachi chef for your home, backyard, or event anywhere in Southern California — live teppanyaki cooking and entertainment by our own team.",
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
      { "@type": "ListItem", position: 2, name: "Private Hibachi Chef", item: URL },
    ],
  }

  // Real, verbatim on-page Google reviews only. No aggregateRating — same rule
  // as the city pages.
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${URL}#package`,
    name: "Private Hibachi Chef Experience — Southern California",
    description:
      "A private hibachi chef, mobile teppanyaki grill, live fire show, 2 proteins per guest, fried rice, vegetables, salad, setup and cleanup — at your home or venue in Southern California.",
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
        citySlug="private-hibachi-chef"
        source="private_hibachi_chef"
        smsHref={smsHref("Hi! I'd like a quote for a private hibachi chef.")}
        kicker="Private hibachi chef · our own SoCal team"
        title={
          <>
            Your Private Hibachi Chef in <GeoCityName fallback="LA & SoCal" />
          </>
        }
        subhead="Live teppanyaki cooking, real fire and a performance at your own table — confirmed by name 48 hours ahead."
        reviews={reviews}
        included={included}
        hoods={topCities.map((c) => c.city)}
        hoodsHeading="Where our chefs cook"
        bestEvening="April – November"
        details={[
          {
            title: "What makes our chefs different",
            body: (
              <>
                {chefPromises.map((item) => (
                  <p key={item.title}>
                    <strong className="text-ink">{item.title}.</strong> {item.description}
                  </p>
                ))}
              </>
            ),
          },
          {
            title: "Why hosts hire a private hibachi chef",
            body: (
              <>
                <p>
                  Hire a private hibachi chef and dinner becomes the event: live teppanyaki cooking, real fire, and a performance at your own table — in your backyard, on your patio, or at your venue.
                </p>
                <p>
                  Our chefs are our own Southern California team, confirmed by name 48 hours before every party — never strangers dispatched from an app.
                </p>
              </>
            ),
          },
        ]}
        detailsHeading="Private chef details"
        faqs={faqs}
        faqHeading="Hiring a private hibachi chef — questions"
        ctaHeading="Meet your chef at the grill."
        ctaBody="See your exact price in 30 seconds — no phone number, no sign-up. Your chef is confirmed by name 48 hours before the party."
        nearby={topCities.slice(0, 6).map((c) => ({ label: c.city, href: `/hibachi-at-home/${c.slug}` }))}
        nearbyLabel="Local pages"
      />
    </>
  )
}
