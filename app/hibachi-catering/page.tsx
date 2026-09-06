import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { MapPin, Phone, Users, Clock, ChefHat, Check, PartyPopper } from "lucide-react"
import { CATERING_CITIES } from "@/config/catering-cities"
import { getCityPage } from "@/config/city-pages"
import { occasionPages } from "@/config/occasion-pages"
import { pickReviews } from "@/config/reviews"
import AppreciationBanner from "@/components/appreciation-banner"
import { JsonLd, BUSINESS_ID } from "@/components/structured-data"
import { phone } from "@/config/site"

const BASE_URL = "https://www.realhibachi.com"
const URL = `${BASE_URL}/hibachi-catering`
const QUOTE_HREF = "/quote?source=seo_hibachi_catering_hub"

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
      "$59.90 per adult, $29.90 per child 5–12, kids under 5 eat free, with a $599 event minimum. Monday–Thursday events with 15+ guests get the Weekday Special at $45.90 per adult. Pricing is published and your exact total — including any travel fee — appears in the instant quote before you pay anything.",
  },
  {
    question: "Do you cater corporate events and offices?",
    answer:
      "Yes — office parties, team celebrations, and client events are a growing part of our calendar. The grill needs an outdoor spot (courtyard, patio, parking area) with about 10 ft of overhead clearance. We are licensed and insured, and can provide documentation your building manager may ask for.",
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
      "Weekend evening slots go first — two to three weeks ahead is comfortable for most dates, and longer for December and graduation season. Weekday and daytime slots are often available on shorter notice. A $19.90 refundable deposit locks your date.",
  },
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
    <div className="min-h-screen bg-white">
      <JsonLd data={[serviceJsonLd, faqJsonLd, breadcrumbJsonLd]} />

      {/* Hero */}
      <section className="hero-section bg-gradient-to-r from-amber-50 to-orange-50 pb-16">
        <div className="container mx-auto px-4">
          <nav className="text-sm text-gray-500 mb-6 pt-6" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-primary">
              Home
            </Link>
            {" / "}
            <span className="text-gray-700">Hibachi Catering</span>
          </nav>
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-serif font-bold text-gray-900 mb-6">
              Hibachi Catering Across <span className="text-primary">Southern California</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-600 mb-4 leading-relaxed">
              Hibachi catering turns any gathering into dinner and a show: our chefs bring the teppanyaki grills to your
              home, office, or venue and cook live for parties of 10 to 100+.
            </p>
            <p className="text-lg md:text-xl text-gray-600 mb-4 leading-relaxed">
              One chef and grill per 28 guests, published pricing, and a single booking no matter how big the guest
              list — serving Los Angeles, Orange County, San Diego, and the Inland Empire.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8 mb-8">
              <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-lg px-8 py-4">
                <Link href={QUOTE_HREF}>Get Instant Quote</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-lg px-8 py-4">
                <Link href={phone.voice.tel}>
                  <Phone className="h-5 w-5 mr-2" />
                  Call {phone.voice.display}
                </Link>
              </Button>
            </div>
            <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-600">
              <span className="flex items-center">
                <Check className="h-4 w-4 text-primary mr-1" />
                Full deposit refund up to 72h
              </span>
              <span className="flex items-center">
                <Users className="h-4 w-4 text-primary mr-1" />
                1 Chef & Grill per 28 Guests
              </span>
              <span className="flex items-center">
                <ChefHat className="h-4 w-4 text-primary mr-1" />
                Licensed & Insured
              </span>
              <span className="flex items-center">
                <Clock className="h-4 w-4 text-primary mr-1" />
                Setup & Cleanup Included
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing & What's Included */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8 items-start">
            <div>
              <h2 className="text-3xl font-serif font-bold text-gray-900 mb-4">
                Catering Pricing, <span className="text-primary">Published</span>
              </h2>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-5xl font-black text-gray-900">$59.90</span>
                <span className="text-lg text-gray-500">/adult</span>
              </div>
              <p className="text-gray-600 mb-1">$29.90 per child 5–12 · kids under 5 eat free · $599 event minimum</p>
              <p className="text-gray-600 mb-4">
                Weekday Special: <strong>$45.90/adult</strong> for Mon–Thu events with 15+ guests.
              </p>
              <p className="text-sm text-gray-500">
                No per-guest setup surcharge and no fee to add more grills — the per-person price is the price at 10
                guests or 100. The first 50 miles of travel are free, then $1 per additional mile, shown in your quote
                before you pay. Gratuity (20–25%) is the only thing not included.
              </p>
            </div>
            <div className="bg-[#fffdf8] border border-[#e7dbc6] rounded-2xl p-6">
              <h3 className="text-xl font-bold mb-4">Every catering booking includes</h3>
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
            <AppreciationBanner source="hibachi_catering_hub" />
          </div>
        </div>
      </section>

      {/* Occasions */}
      <section className="py-16 bg-[#fffdf8] border-y border-[#e7dbc6]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-4">
              Occasions We <span className="text-primary">Cater</span>
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Every occasion gets its own playbook — see how a hibachi party fits yours.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto">
            {occasionPages.map((occasion) => (
              <Link
                key={occasion.slug}
                href={`/party/${occasion.slug}`}
                className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-white px-5 py-2.5 text-primary font-medium hover:bg-primary hover:text-white transition-colors"
              >
                <PartyPopper className="h-4 w-4" />
                {occasion.occasion}
              </Link>
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
            Hibachi Catering <span className="text-primary">Questions</span>
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

      {/* Catering city pages */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-4">
              Hibachi Catering by <span className="text-primary">City</span>
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Local pricing, travel details, and neighborhood coverage for each metro we cater.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto">
            {cateringCityPages.map((city) => (
              <Link
                key={city.slug}
                href={`/hibachi-catering/${city.slug}`}
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
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">Feed Everyone. Entertain Everyone.</h2>
          <p className="text-lg text-amber-100 max-w-2xl mx-auto mb-8">
            See your exact hibachi catering price in 30 seconds — any party size, no phone number, no sign-up.
          </p>
          <Button asChild size="lg" className="bg-white text-amber-600 hover:bg-amber-50 text-lg px-8 py-4">
            <Link href={QUOTE_HREF}>Get Instant Quote</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
