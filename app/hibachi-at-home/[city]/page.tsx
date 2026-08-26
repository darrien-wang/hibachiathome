import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MapPin, Phone, Star, Users, Clock, ChefHat, Check } from "lucide-react"
import { cityPages, getCityPage, getNearbyCityPages } from "@/config/city-pages"
import { regularProteins, premiumProteins, sides } from "@/config/menu-items"
import { JsonLd, BUSINESS_ID } from "@/components/structured-data"

const BASE_URL = "https://www.realhibachi.com"

export async function generateStaticParams() {
  return cityPages.map((page) => ({ city: page.slug }))
}

export async function generateMetadata({ params }: { params: { city: string } }): Promise<Metadata> {
  const page = getCityPage(params.city)

  if (!page) {
    return { title: "Page Not Found" }
  }

  const url = `${BASE_URL}/hibachi-at-home/${page.slug}`

  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      title: `${page.metaTitle} | Real Hibachi`,
      description: page.metaDescription,
      url,
      siteName: "Real Hibachi",
      locale: "en_US",
      type: "website",
      images: [
        {
          url: `${BASE_URL}/images/hibachi-flame-og.png`,
          width: 1200,
          height: 630,
          alt: `Hibachi at home private chef in ${page.city}, CA`,
        },
      ],
    },
  }
}

const included = [
  "Professional hibachi chef & mobile teppanyaki grill",
  "2 regular proteins per guest (chicken, steak, shrimp, salmon, or tofu)",
  "Garlic butter fried rice, fresh vegetables & house salad",
  "Live cooking show — fire tricks, egg toss, sake service",
  "Complete setup and cleanup",
]

// Category norms we can point at without naming anyone: several mobile hibachi
// services in Southern California publish $150 deposits, $8–$10 per-guest table
// and chair setup fees, or no price at all until you hand over contact details.
// Every claim on our side of this list has to stay true to config/pricing.ts.
const noSurprises = [
  {
    title: "A $19.90 deposit — not $150",
    description:
      "That is all it takes to lock your date, and it is fully refundable with 72+ hours notice. Plenty of mobile hibachi services ask for $150 or more up front.",
  },
  {
    title: "Setup and cleanup are in the price",
    description:
      "No per-guest setup surcharge. Some services add $8–$10 per guest for table and chair setup, or leave the teardown to you.",
  },
  {
    title: "The first 50 miles are free",
    description:
      "No travel fee at all inside 50 miles of our base, which covers most of Los Angeles and Orange County. Beyond that it is $1 per additional mile, calculated from your address and shown in your quote before you pay. Other services in this market start charging at 20 miles, or add a flat fee around $75.",
  },
  {
    title: "The price is on this page",
    description:
      "$59.90 per adult, published, no form required. Several services in this market quote only after you hand over your contact details.",
  },
]

const steps = [
  {
    title: "Get an instant quote",
    description: "Tell us your date, guest count, and address — pricing and any travel fee appear upfront.",
  },
  {
    title: "Lock your date",
    description: "A $19.90 deposit reserves your chef. Full refund with 72+ hours notice.",
  },
  {
    title: "We bring the restaurant",
    description: "The chef arrives ~10 minutes early, sets up, performs, feeds everyone, and cleans up.",
  },
]

export default function CityPage({ params }: { params: { city: string } }) {
  const page = getCityPage(params.city)

  if (!page) {
    notFound()
  }

  const nearby = getNearbyCityPages(page)
  const url = `${BASE_URL}/hibachi-at-home/${page.slug}`
  const quoteHref = `/quoteA?source=city_${page.slug.replace(/-/g, "_")}`

  // City-specific questions first, then the ones every city gets asked.
  const faqs = [
    ...page.faqs,
    {
      question: `How much space do you need in ${page.city}?`,
      answer: `About a 6x8 ft flat area for the grill plus roughly 10 ft of overhead clearance, in open air — a patio, deck, driveway, or yard all work. Enclosed rooms and covered balconies do not. Send a photo when you book and we'll confirm the setup spot before your date.`,
    },
    {
      question: `Is this an indoor or outdoor party?`,
      answer: `The cooking is outdoors; the eating does not have to be. A live teppanyaki grill throws real smoke and grease and will set off a smoke alarm indoors, so the grill always stays outside — on a patio, deck, driveway, yard, or roof terrace, with about 10 ft of overhead clearance. Your guests can absolutely sit and eat inside. Plenty of ${page.city} parties run exactly that way: the chef cooks on the patio and plates come indoors, which is what we'd suggest on a hot afternoon or a cold night.`,
    },
    {
      question: `Can we book a lunch or daytime slot?`,
      answer: `Yes. Because the party is outdoors, the right answer depends on your city and the season — midday stays comfortable near the coast for most of the year, while inland and Valley cities are best at lunch roughly October through May and better at sunset in high summer. Daytime slots are usually easier to get than weekend evenings. Tell us your date and preferred time and we'll tell you honestly whether it works.`,
    },
    {
      question: `What happens if we need to cancel or reschedule?`,
      answer: `Cancel or reschedule at least 72 hours before your event and your $19.90 deposit is refunded in full. Inside 72 hours the deposit may become non-refundable. If rain is the problem, a 10'x10' pop-up tent over the chef's station usually saves the party — you provide the tent, we do not supply them — and guests can eat indoors while the chef cooks outside.`,
    },
  ]

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${url}#service`,
    name: `Hibachi at Home in ${page.city}, CA`,
    serviceType: "Private hibachi chef catering",
    provider: { "@id": BUSINESS_ID },
    description: page.metaDescription,
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
        unitText: "per adult ($29.95 per child under 13, $599 event minimum)",
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
      { "@type": "ListItem", position: 2, name: "Hibachi at Home", item: `${BASE_URL}/hibachi-at-home` },
      { "@type": "ListItem", position: 3, name: page.city, item: url },
    ],
  }

  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={[serviceJsonLd, faqJsonLd, breadcrumbJsonLd]} />

      {/* Hero */}
      <section className="bg-gradient-to-r from-amber-50 to-orange-50 pt-10 pb-16">
        <div className="container mx-auto px-4">
          <nav className="text-sm text-gray-500 mb-6" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-primary">
              Home
            </Link>
            {" / "}
            <Link href="/hibachi-at-home" className="hover:text-primary">
              Hibachi at Home
            </Link>
            {" / "}
            <span className="text-gray-700">{page.city}</span>
          </nav>
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-serif font-bold text-gray-900 mb-6">
              Hibachi at Home in <span className="text-primary">{page.city}</span>
            </h1>
            {page.intro.map((paragraph) => (
              <p key={paragraph.slice(0, 32)} className="text-lg md:text-xl text-gray-600 mb-4 leading-relaxed">
                {paragraph}
              </p>
            ))}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8 mb-8">
              <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-lg px-8 py-4">
                <Link href={quoteHref}>Get Instant Quote</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-lg px-8 py-4">
                <Link href="tel:+12137707788">
                  <Phone className="h-5 w-5 mr-2" />
                  Call (213) 770-7788
                </Link>
              </Button>
            </div>
            <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-600">
              <span className="flex items-center">
                <Star className="h-4 w-4 text-yellow-500 mr-1" />
                4.9/5 Rating
              </span>
              <span className="flex items-center">
                <Users className="h-4 w-4 text-primary mr-1" />
                500+ Events
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
                Simple Flat-Rate <span className="text-primary">Pricing</span>
              </h2>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-5xl font-black text-gray-900">$59.90</span>
                <span className="text-lg text-gray-500">/adult</span>
              </div>
              <p className="text-gray-600 mb-1">$29.95 per child under 13 · $599 event minimum</p>
              <p className="text-gray-600 mb-4">
                Weekday Special: <strong>$45.90/adult</strong> for Mon–Thu parties with 15+ guests.
              </p>
              <p className="text-sm text-gray-500">
                The first 50 miles from our base are free — most {page.city} addresses have no travel fee at all. Past that it is $1 for each mile beyond the free 50, calculated from your address and shown upfront in your quote.
              </p>
            </div>
            <div className="bg-[#fffdf8] border border-[#e7dbc6] rounded-2xl p-6">
              <h3 className="text-xl font-bold mb-4">Every {page.city} booking includes</h3>
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
        </div>
      </section>

      {/* No Surprise Line Items */}
      <section className="py-16 bg-[#fffdf8] border-y border-[#e7dbc6]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-4">
              What Your {page.city} Quote <span className="text-primary">Actually Includes</span>
            </h2>
            <p className="text-gray-600">
              Mobile hibachi pricing in Southern California clusters around the same headline number. The
              difference between services shows up in the line items underneath it, so here are ours.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {noSurprises.map((item) => (
              <div key={item.title} className="flex items-start gap-3 rounded-xl border border-[#e7dbc6] bg-white p-6">
                <Check className="mt-1 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Occasions */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-4">
              Popular in <span className="text-primary">{page.city}</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {page.occasions.map((occasion) => (
              <Card key={occasion.title} className="h-full">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold mb-2">{occasion.title}</h3>
                  <p className="text-gray-600">{occasion.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Where We Cook */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-4">
              Where We Cook in <span className="text-primary">{page.city}</span>
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              We have set the grill up in most kinds of {page.city} space there is. These are the three we see most.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {page.venues.map((venue) => (
              <Card key={venue.title} className="h-full">
                <CardContent className="p-6">
                  <h3 className="text-lg font-bold mb-2">{venue.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{venue.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Parking, Space & Setup */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-6">
              Parking, Space & Setup in <span className="text-primary">{page.city}</span>
            </h2>
            <div className="space-y-5">
              {page.logistics.map((paragraph) => (
                <p key={paragraph.slice(0, 32)} className="text-gray-600 leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
            <p className="mt-6 text-sm text-gray-500">
              Not sure your space works? Send a photo with your quote request and we will confirm the setup spot
              before your date.
            </p>
          </div>
        </div>
      </section>

      {/* Areas Served */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-4">
              Serving {page.city} & <span className="text-primary">Nearby Areas</span>
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Our chefs cook throughout {page.city} and the surrounding {page.county} communities.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto">
            {page.neighborhoods.map((area) => (
              <span
                key={area}
                className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-700"
              >
                <MapPin className="h-3.5 w-3.5 text-primary" />
                {area}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Menu */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-4">
              The {page.city} Hibachi <span className="text-primary">Menu</span>
            </h2>
            <p className="text-gray-600">
              Every guest picks two proteins, and everyone gets the full plate — garlic butter fried rice, grilled
              vegetables, house salad, and our signature sauces. Guests can each choose differently; the chef cooks
              to order at your table.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="rounded-xl border border-gray-200 p-6">
              <h3 className="font-bold text-gray-900 mb-3">Included proteins — pick 2 per guest</h3>
              <ul className="space-y-2 text-gray-600 text-sm">
                {regularProteins.map((item) => (
                  <li key={item.id} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{item.name}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-gray-200 p-6">
              <h3 className="font-bold text-gray-900 mb-3">Premium upgrades</h3>
              <ul className="space-y-2 text-gray-600 text-sm">
                {premiumProteins.map((item) => (
                  <li key={item.id} className="flex items-baseline justify-between gap-3">
                    <span>{item.name.replace(" Upgrade", "")}</span>
                    <span className="font-semibold text-gray-900 whitespace-nowrap">+${item.price}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-gray-500">Per guest, added to the flat rate. Entirely optional.</p>
            </div>
            <div className="rounded-xl border border-gray-200 p-6">
              <h3 className="font-bold text-gray-900 mb-3">Extra sides</h3>
              <ul className="space-y-2 text-gray-600 text-sm">
                {sides.map((item) => (
                  <li key={item.id} className="flex items-baseline justify-between gap-3">
                    <span>{item.name}</span>
                    <span className="font-semibold text-gray-900 whitespace-nowrap">+${item.price}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-gray-500">Ordered by the tray for the table, not per guest.</p>
            </div>
          </div>
          <p className="text-center mt-8 text-gray-600 max-w-3xl mx-auto text-sm">
            Vegetarian, vegan, and gluten-free guests are accommodated at the same per-person rate — just tell us
            when you book. Our recipes contain no nuts and no sesame. See the{" "}
            <Link href="/menu" className="text-primary hover:underline">
              full menu
            </Link>{" "}
            for photos and details.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900">
              How It <span className="text-primary">Works</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {steps.map((step, index) => (
              <div key={step.title} className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white text-xl font-bold">
                  {index + 1}
                </div>
                <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                <p className="text-gray-600 text-sm">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* City FAQ */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900">
              {page.city} Hibachi <span className="text-primary">FAQ</span>
            </h2>
          </div>
          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq) => (
              <div key={faq.question} className="rounded-lg border bg-white p-6">
                <h3 className="font-bold text-lg text-gray-900 mb-2">{faq.question}</h3>
                <p className="text-gray-600">{faq.answer}</p>
              </div>
            ))}
          </div>
          <p className="text-center mt-8 text-gray-500">
            More questions?{" "}
            <Link href="/faq" className="text-primary hover:underline">
              See the full FAQ
            </Link>
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-primary text-white">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-6">
              Ready to Book Hibachi at Home in {page.city}?
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Get your instant quote — date, guest count, address, done. A $19.90 deposit locks your chef.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" variant="secondary" className="text-lg px-8 py-4">
                <Link href={quoteHref}>Get Instant Quote</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-white hover:text-primary bg-transparent text-lg px-8 py-4"
              >
                <Link href="tel:+12137707788">
                  <Phone className="h-5 w-5 mr-2" />
                  Call (213) 770-7788
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Nearby Cities */}
      {nearby.length > 0 && (
        <section className="py-12 bg-gray-50">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-2xl font-serif font-bold text-gray-900 mb-6">
              Hibachi at Home in Nearby Cities
            </h2>
            <div className="flex flex-wrap justify-center gap-4">
              {nearby.map((nearbyPage) => (
                <Link
                  key={nearbyPage.slug}
                  href={`/hibachi-at-home/${nearbyPage.slug}`}
                  className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-white px-5 py-2.5 text-primary font-medium hover:bg-primary hover:text-white transition-colors"
                >
                  <MapPin className="h-4 w-4" />
                  {nearbyPage.city}
                </Link>
              ))}
              <Link
                href="/locations"
                className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 transition-colors"
              >
                All service areas
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
