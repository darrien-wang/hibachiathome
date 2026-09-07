import type { Metadata } from "next"
import Link from "next/link"
import { pickReviews } from "@/config/reviews"
import { Button } from "@/components/ui/button"
import { MapPin, Check, Flame } from "lucide-react"
import { cityPages } from "@/config/city-pages"
import AppreciationBanner from "@/components/appreciation-banner"
import CityLandingHero from "@/components/city/city-landing-hero"
import GeoCityName from "@/components/city/geo-city-name"
import { JsonLd, BUSINESS_ID } from "@/components/structured-data"
import { phone, smsHref } from "@/config/site"

const BASE_URL = "https://www.realhibachi.com"
const URL = `${BASE_URL}/mobile-hibachi`
const QUOTE_HREF = "/quote?source=seo_mobile_hibachi"

export const metadata: Metadata = {
  title: "Mobile Hibachi Catering Los Angeles & SoCal | From $59.90/Person",
  description:
    "Mobile hibachi that comes to you — chef, teppanyaki grill, and live fire show at your home, backyard, or venue. $59.90/adult, published pricing, first 50 miles free. Serving LA, OC & San Diego.",
  alternates: { canonical: URL },
  openGraph: {
    title: "Mobile Hibachi Catering Los Angeles & SoCal | Real Hibachi",
    description:
      "Mobile hibachi that comes to you — chef, grill, and live fire show at your home or venue. Published pricing from $59.90/person.",
    url: URL,
    siteName: "Real Hibachi",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: `${BASE_URL}/images/hibachi-flame-og.png`,
        width: 1200,
        height: 630,
        alt: "Mobile hibachi chef cooking at a Southern California home",
      },
    ],
  },
}

const included = [
  "Professional hibachi chef & mobile teppanyaki grill — we bring everything",
  "2 regular proteins per guest (chicken, steak, shrimp, salmon, or tofu)",
  "Garlic butter fried rice, fresh vegetables & house salad",
  "Live cooking show — fire tricks, egg toss, chef entertainment",
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
      "We serve all of Southern California — Los Angeles, Orange County, San Diego, the Inland Empire, and out to Palm Springs and Temecula. The first 50 miles from our base are free, then $1 per additional mile, calculated from your address and shown in your quote before you pay anything.",
  },
  {
    question: "How much does mobile hibachi cost?",
    answer:
      "$59.90 per adult, $29.90 per child 5–12, kids under 5 eat free, with a $599 event minimum. Monday–Thursday parties with 15+ guests get our Weekday Special at $45.90 per adult. Pricing is published — no phone number required to see your total.",
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

  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={[serviceJsonLd, faqJsonLd, breadcrumbJsonLd, productJsonLd]} />

      {/* Hero — first screen: price, estimator, proof. See components/city/city-landing-hero.tsx */}
      <CityLandingHero
        breadcrumb={
          <>
            <Link href="/" className="hover:text-primary">
              Home
            </Link>
            {" / "}
            <span className="text-gray-700">Mobile Hibachi</span>
          </>
        }
        title={
          <>
            Mobile Hibachi in <span className="text-primary"><GeoCityName fallback="Los Angeles & SoCal" /></span>
          </>
        }
        subhead="The restaurant comes to you: a private chef, the teppanyaki grill, and the full fire show in your backyard, driveway, or venue."
        citySlug="mobile-hibachi"
        cityName="Southern California"
        source="mobile_hibachi"
        smsHref={smsHref("Hi! I'd like a quote for a mobile hibachi party.")}
        reviews={pickReviews("mobile-hibachi")}
      />

      {/* Intro copy — used to open the page; now sits under the price. */}
      <section className="py-10 bg-white">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-lg md:text-xl text-gray-600 mb-4 leading-relaxed">
              A mobile hibachi party means the restaurant comes to you: a private chef pulls up with the teppanyaki
              grill, fresh ingredients, and the full fire show, and cooks course by course in your backyard, on your
              driveway, or at your venue.
            </p>
            <p className="text-lg md:text-xl text-gray-600 mb-4 leading-relaxed">
              No reservations, no parking downtown, no splitting the check across four tables. Mobile hibachi catering
              from Real Hibachi serves Los Angeles, Orange County, San Diego, and everywhere in between.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing & What's Included */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8 items-start">
            <div>
              <h2 className="text-3xl font-serif font-bold text-gray-900 mb-4">
                Mobile Hibachi <span className="text-primary">Pricing</span>
              </h2>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-5xl font-black text-gray-900">$59.90</span>
                <span className="text-lg text-gray-500">/adult</span>
              </div>
              <p className="text-gray-600 mb-1">$29.90 per child 5–12 · kids under 5 eat free · $599 event minimum</p>
              <p className="text-gray-600 mb-4">
                Weekday Special: <strong>$45.90/adult</strong> for Mon–Thu parties with 15+ guests.
              </p>
              <p className="text-sm text-gray-500">
                The first 50 miles of travel are free — that covers most of LA and Orange County. Beyond that it is $1
                per additional mile, calculated from your address and shown upfront in your quote. All fees are in the
                quote; gratuity (20–25%) is the only thing that isn&apos;t.
              </p>
            </div>
            <div className="bg-[#fffdf8] border border-[#e7dbc6] rounded-2xl p-6">
              <h3 className="text-xl font-bold mb-4">Every mobile hibachi booking includes</h3>
              <ul className="space-y-3">
                {included.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-gray-700">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="max-w-4xl mx-auto mt-8">
            <AppreciationBanner source="mobile_hibachi" />
          </div>
        </div>
      </section>

      {/* The Show */}
      <section className="py-16 bg-[#fffdf8] border-y border-[#e7dbc6]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-4">
              The Show That Travels <span className="text-primary">With Us</span>
            </h2>
            <p className="text-gray-600">
              A mobile hibachi chef isn&apos;t just dinner — it&apos;s the entertainment. Here&apos;s what your guests
              actually see at the grill.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {showActs.map((act) => (
              <div key={act.title} className="flex items-start gap-3 rounded-xl border border-[#e7dbc6] bg-white p-6">
                <Flame className="mt-1 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">{act.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{act.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-serif font-bold text-center text-gray-900 mb-10">
            What Hosts <span className="text-primary">Say</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {reviews.map((review) => (
              <div key={review.name} className="rounded-xl border border-[#e7dbc6] bg-[#fffdf8] p-6">
                <p className="text-gray-700 italic mb-4">&ldquo;{review.text}&rdquo;</p>
                <p className="font-semibold text-gray-900">— {review.name}</p>
                <p className="text-xs text-gray-500 mt-1">Google review</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-serif font-bold text-center text-gray-900 mb-10">
            Mobile Hibachi <span className="text-primary">Questions</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {faqs.map((faq) => (
              <div key={faq.question} className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                <h3 className="font-bold text-lg mb-2 text-gray-900">{faq.question}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Button asChild variant="outline" className="rounded-full border-2 border-amber-500 text-amber-600 hover:bg-amber-50">
              <Link href="/faq">View All FAQs</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Cities */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-4">
              Mobile Hibachi Across <span className="text-primary">Southern California</span>
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Find your city for local pricing, travel details, and neighborhood coverage.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto">
            {cityPages.map((city) => (
              <Link
                key={city.slug}
                href={`/hibachi-at-home/${city.slug}`}
                className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-white px-5 py-2.5 text-primary font-medium hover:bg-primary hover:text-white transition-colors"
              >
                <MapPin className="h-4 w-4" />
                {city.city}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-gradient-to-r from-amber-600 to-orange-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">Your Place. Our Grill.</h2>
          <p className="text-lg text-amber-100 max-w-2xl mx-auto mb-8">
            See your exact mobile hibachi price in 30 seconds — no phone number, no sign-up.
          </p>
          <Button asChild size="lg" className="bg-white text-amber-600 hover:bg-amber-50 text-lg px-8 py-4">
            <Link href={QUOTE_HREF}>Get Instant Quote</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
