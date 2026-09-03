import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { MessageSquare, Star, Check, Users, CalendarDays, Sparkles } from "lucide-react"
import { getCityPage, getNearbyCityPages } from "@/config/city-pages"
import { CATERING_CITIES } from "@/config/catering-cities"
import { pickReviews } from "@/config/reviews"
import CityQuoteCalculator from "@/components/city/city-quote-calculator"
import { JsonLd, BUSINESS_ID } from "@/components/structured-data"

const BASE_URL = "https://www.realhibachi.com"
const PHONE_DISPLAY = "213-770-7788"
const PHONE_RAW = "2137707788"

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
  "2 proteins per guest (chicken, steak, shrimp, salmon, or tofu)",
  "Garlic butter fried rice, fresh vegetables & house salad",
  "Live fire show, games, and chef entertainment",
  "Complete setup and cleanup — your venue stays spotless",
]

const eventTypes = [
  {
    icon: Users,
    title: "Big group? That's the point.",
    description:
      "One chef serves up to ~25 guests with the full show; larger events get a second chef and grill so every table has a front row. Tell us the headcount and we bring the right crew.",
  },
  {
    icon: CalendarDays,
    title: "Corporate & team events",
    description:
      "Office parties, launch dinners, wrap parties — a hibachi show is the team event people actually talk about after. Weekday dates often qualify for the $45.90/adult Weekday Special.",
  },
  {
    icon: Sparkles,
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
  const quoteHref = `/quote?source=catering_${page.slug.replace(/-/g, "_")}`
  const smsHref = `sms:${PHONE_RAW}?body=${encodeURIComponent(
    `Hi Real Hibachi! I'm planning an event in ${page.city} and would love a catering quote.`,
  )}`
  const nearby = getNearbyCityPages(page)
  const reviews = pickReviews(`${page.slug}-catering`)

  const faqs = [
    {
      question: `How much does hibachi catering cost in ${page.city}?`,
      answer: `$59.90 per adult and $29.90 per child (5–12), with a $599 event minimum — food, chef, live show, setup, and cleanup included. Monday–Thursday events with 15+ guests qualify for the $45.90/adult Weekday Special. The first 50 miles of travel are free; anything beyond is $1/mile, shown upfront in your quote.`,
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
        unitText: "per adult ($29.90 per child 5–12, $599 event minimum)",
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

  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={[serviceJsonLd, faqJsonLd, breadcrumbJsonLd, productJsonLd]} />

      {/* Hero */}
      <section className="hero-section bg-gradient-to-r from-amber-50 to-orange-50 pb-14">
        <div className="container mx-auto px-4">
          <nav className="text-sm text-gray-500 mb-6" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-primary">
              Home
            </Link>
            {" / "}
            <span className="text-gray-700">Hibachi Catering {page.city}</span>
          </nav>
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Hibachi Catering in {page.city}</h1>
            <p className="text-2xl font-semibold text-orange-800 mb-3">
              The caterer that brings dinner <em>and</em> the show.
            </p>
            <p className="text-sm text-gray-600 mb-8">
              Fire up your story. · $59.90/adult, published · $599 event minimum · Setup & cleanup included
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild className="h-12 rounded-full bg-[hsl(24_79%_55%)] px-8 text-white hover:bg-[hsl(24_79%_48%)]">
                <Link href={quoteHref}>Get an Instant Quote</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-12 rounded-full border-2 border-[hsl(24_79%_55%)] bg-white px-8 text-[hsl(24_79%_55%)] hover:bg-[hsl(24_79%_96%)]"
              >
                <a href={smsHref}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Text {PHONE_DISPLAY}
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Event types */}
      <section className="py-14">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-3xl font-bold">
              Catering that <span className="text-primary">performs</span>
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-center text-gray-600">
              Trays of lukewarm food are catering. A chef cooking live with fire, games, and a crowd around the grill is
              an event.
            </p>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {eventTypes.map((type) => (
                <div key={type.title} className="rounded-2xl border border-amber-100 bg-white p-6 shadow-sm">
                  <type.icon className="h-6 w-6 text-orange-600" aria-hidden="true" />
                  <h3 className="mt-3 text-lg font-semibold text-gray-900">{type.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-700">{type.description}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-sm text-gray-600">
              Planning a specific occasion?{" "}
              <Link href="/party" className="font-medium text-primary underline">
                See our party ideas
              </Link>{" "}
              — birthdays, pool parties, corporate nights, and more.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing + calculator */}
      <section className="bg-[#fffdf8] border-y border-[#e7dbc6] py-14">
        <div className="container mx-auto px-4">
          <div className="mx-auto grid max-w-5xl items-start gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-serif font-bold text-gray-900 mb-4">
                Published <span className="text-primary">Pricing</span>
              </h2>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-5xl font-black text-gray-900">$59.90</span>
                <span className="text-lg text-gray-500">/adult</span>
              </div>
              <p className="text-gray-600 mb-1">$29.90 per child 5–12 · $5 for kids under 5 · $599 event minimum</p>
              <p className="text-gray-600 mb-4">
                Weekday Special: <strong>$45.90/adult</strong> for Mon–Thu events with 15+ guests.
              </p>
              <ul className="space-y-2.5">
                {included.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-gray-700">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <CityQuoteCalculator citySlug={page.slug} cityName={page.city} />
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section className="py-14 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-serif font-bold text-gray-900">
              What Hosts <span className="text-primary">Say</span>
            </h2>
            <div className="mt-2 flex items-center justify-center gap-1 text-sm text-gray-600">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
              ))}
              <span className="ml-1">5-star Google reviews from Southern California events</span>
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">
            {reviews.map((review) => (
              <div key={review.name} className="rounded-2xl border border-amber-100 bg-white p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-base font-bold text-white">
                    {review.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{review.name}</p>
                    <p className="text-xs text-gray-500">Google review</p>
                  </div>
                </div>
                <div className="mt-2 flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                  ))}
                </div>
                <p className="mt-2 text-sm leading-6 text-gray-700">{review.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-14">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-3xl font-serif font-bold">
              {page.city} Catering <span className="text-primary">FAQ</span>
            </h2>
            <div className="mt-8 space-y-5">
              {faqs.map((faq) => (
                <div key={faq.question} className="rounded-2xl border border-gray-200 p-6">
                  <h3 className="font-semibold text-gray-900">{faq.question}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-700">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Cross-links + CTA */}
      <section className="bg-gradient-to-r from-amber-50 to-orange-50 py-14">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold">Fire up your {page.city} event.</h2>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild className="h-12 rounded-full bg-[hsl(24_79%_55%)] px-8 text-white hover:bg-[hsl(24_79%_48%)]">
              <Link href={quoteHref}>Get an Instant Quote</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-12 rounded-full border-2 border-[hsl(24_79%_55%)] bg-white px-8 text-[hsl(24_79%_55%)] hover:bg-[hsl(24_79%_96%)]"
            >
              <a href={smsHref}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Text {PHONE_DISPLAY}
              </a>
            </Button>
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-sm text-gray-600">
            Hosting a smaller dinner at home?{" "}
            <Link href={atHomeUrl} className="font-medium text-primary underline">
              Hibachi at Home in {page.city}
            </Link>{" "}
            has the family-dinner details.
          </p>
          <div className="mx-auto mt-4 flex max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
            {CATERING_CITIES.filter((slug) => slug !== page.slug).map((slug) => {
              const other = getCityPage(slug)
              if (!other) return null
              return (
                <Link key={slug} href={`/hibachi-catering/${slug}`} className="text-gray-600 underline hover:text-primary">
                  {other.city} catering
                </Link>
              )
            })}
            {nearby.slice(0, 3).map((other) => (
              <Link
                key={other.slug}
                href={`/hibachi-at-home/${other.slug}`}
                className="text-gray-600 underline hover:text-primary"
              >
                {other.city} at home
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
