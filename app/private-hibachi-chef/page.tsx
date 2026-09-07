import type { Metadata } from "next"
import Link from "next/link"
import { pickReviews } from "@/config/reviews"
import { Button } from "@/components/ui/button"
import { MapPin, ChefHat, Check } from "lucide-react"
import { cityPages } from "@/config/city-pages"
import AppreciationBanner from "@/components/appreciation-banner"
import CityLandingHero from "@/components/city/city-landing-hero"
import GeoCityName from "@/components/city/geo-city-name"
import { JsonLd, BUSINESS_ID } from "@/components/structured-data"
import { phone, smsHref } from "@/config/site"

const BASE_URL = "https://www.realhibachi.com"
const URL = `${BASE_URL}/private-hibachi-chef`
const QUOTE_HREF = "/quote?source=seo_private_hibachi_chef"

export const metadata: Metadata = {
  title: "Private Hibachi Chef Los Angeles & SoCal | Book from $59.90/Person",
  description:
    "Hire a private hibachi chef for your home or event — our own team, confirmed by name 48h ahead, never gig workers. Live teppanyaki show, published pricing from $59.90/adult. LA, OC & San Diego.",
  alternates: { canonical: URL },
  openGraph: {
    title: "Private Hibachi Chef Los Angeles & SoCal | Real Hibachi",
    description:
      "Hire a private hibachi chef for your home or event — confirmed by name 48h ahead. Published pricing from $59.90/person.",
    url: URL,
    siteName: "Real Hibachi",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: `${BASE_URL}/images/hibachi-flame-og.png`,
        width: 1200,
        height: 630,
        alt: "Private hibachi chef performing at a Southern California home",
      },
    ],
  },
}

const included = [
  "A private hibachi chef from our own team — never a gig-app dispatch",
  "Mobile teppanyaki grill, propane, and fresh ingredients — all brought to you",
  "2 regular proteins per guest (chicken, steak, shrimp, salmon, or tofu)",
  "Garlic butter fried rice, fresh vegetables & house salad",
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
      "$59.90 per adult, $29.90 per child 5–12, kids under 5 eat free, with a $599 event minimum — chef, grill, food, show, setup, and cleanup all included. Monday–Thursday parties with 15+ guests get the Weekday Special at $45.90 per adult. Gratuity (20–25%) is the only thing not in the quote.",
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
            <span className="text-gray-700">Private Hibachi Chef</span>
          </>
        }
        title={
          <>
            Your <span className="text-primary">Private Hibachi Chef</span> in <GeoCityName fallback="LA & SoCal" />
          </>
        }
        subhead="Live teppanyaki cooking, real fire, and a performance at your own table — our own SoCal team, confirmed by name 48 hours ahead."
        citySlug="private-hibachi-chef"
        cityName="Southern California"
        source="private_hibachi_chef"
        smsHref={smsHref("Hi! I'd like a quote for a private hibachi chef.")}
        reviews={pickReviews("private-hibachi-chef")}
      />

      {/* Intro copy — used to open the page; now sits under the price. */}
      <section className="py-10 bg-white">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-lg md:text-xl text-gray-600 mb-4 leading-relaxed">
              Hire a private hibachi chef and dinner becomes the event: live teppanyaki cooking, real fire, and a
              performance at your own table — in your backyard, on your patio, or at your venue.
            </p>
            <p className="text-lg md:text-xl text-gray-600 mb-4 leading-relaxed">
              Our chefs are our own Southern California team, confirmed by name 48 hours before every party — never
              strangers dispatched from an app.
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
                Private Chef, <span className="text-primary">Published Price</span>
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
                That price covers the private hibachi chef, grill, food, show, setup, and cleanup. The first 50 miles of
                travel are free; past that it is $1 per additional mile, shown in your quote before you pay. Gratuity
                (20–25%) is the only thing not included.
              </p>
            </div>
            <div className="bg-[#fffdf8] border border-[#e7dbc6] rounded-2xl p-6">
              <h3 className="text-xl font-bold mb-4">Every booking includes</h3>
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
            <AppreciationBanner source="private_hibachi_chef" />
          </div>
        </div>
      </section>

      {/* Chef promises */}
      <section className="py-16 bg-[#fffdf8] border-y border-[#e7dbc6]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-4">
              What Makes Our Chefs <span className="text-primary">Different</span>
            </h2>
            <p className="text-gray-600">
              Anyone can rent you a grill. A private hibachi chef worth booking comes with guarantees — here are ours,
              in writing.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {chefPromises.map((item) => (
              <div key={item.title} className="flex items-start gap-3 rounded-xl border border-[#e7dbc6] bg-white p-6">
                <ChefHat className="mt-1 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{item.description}</p>
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
            Guests on Our <span className="text-primary">Chefs</span>
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
            Hiring a Private Hibachi Chef — <span className="text-primary">Questions</span>
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
              Private Hibachi Chefs Across <span className="text-primary">Southern California</span>
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
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">Meet Your Chef at the Grill</h2>
          <p className="text-lg text-amber-100 max-w-2xl mx-auto mb-8">
            See your exact price in 30 seconds — no phone number, no sign-up. Your chef is confirmed by name 48 hours
            before the party.
          </p>
          <Button asChild size="lg" className="bg-white text-amber-600 hover:bg-amber-50 text-lg px-8 py-4">
            <Link href={QUOTE_HREF}>Get Instant Quote</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
