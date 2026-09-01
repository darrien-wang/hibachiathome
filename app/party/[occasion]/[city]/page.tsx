import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { MessageSquare, Star, MapPin, Flame } from "lucide-react"
import { getOccasionPage } from "@/config/occasion-pages"
import { getCityPage } from "@/config/city-pages"
import { OCCASION_CITY_COMBOS, getCombo } from "@/config/occasion-city-pages"
import LazyVideo from "@/components/lazy-video"
import CityQuoteCalculator from "@/components/city/city-quote-calculator"
import { JsonLd, BUSINESS_ID } from "@/components/structured-data"

const BASE_URL = "https://www.realhibachi.com"
const PHONE_DISPLAY = "213-770-7788"
const PHONE_RAW = "2137707788"

export async function generateStaticParams() {
  return OCCASION_CITY_COMBOS.map((combo) => ({ occasion: combo.occasion, city: combo.city }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ occasion: string; city: string }>
}): Promise<Metadata> {
  const { occasion: occasionSlug, city: citySlug } = await params
  const combo = getCombo(occasionSlug, citySlug)
  const occasion = getOccasionPage(occasionSlug)
  const city = getCityPage(citySlug)
  if (!combo || !occasion || !city) {
    return { title: "Page Not Found" }
  }
  const url = `${BASE_URL}/party/${occasion.slug}/${city.slug}`
  const title = `${occasion.occasion} Hibachi in ${city.city} | Chef & Show from $59.90/Person`
  const description = `${occasion.occasion} hibachi in ${city.city}, CA: a private chef, mobile grill, and live fire show at your place. Published pricing, instant quote, SoCal-local team.`
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
          alt: title,
        },
      ],
    },
  }
}

export default async function OccasionCityPage({ params }: { params: Promise<{ occasion: string; city: string }> }) {
  const { occasion: occasionSlug, city: citySlug } = await params
  const combo = getCombo(occasionSlug, citySlug)
  const occasion = getOccasionPage(occasionSlug)
  const city = getCityPage(citySlug)
  if (!combo || !occasion || !city) {
    notFound()
  }

  const url = `${BASE_URL}/party/${occasion.slug}/${city.slug}`
  const quoteHref = `/quote?source=combo_${occasion.slug.replace(/-/g, "_")}_${city.slug.replace(/-/g, "_")}`
  const smsHref = `sms:${PHONE_RAW}?body=${encodeURIComponent(
    `Hi Real Hibachi! I'm planning a ${occasion.occasion.toLowerCase()} in ${city.city} and would love a quote.`,
  )}`
  const siblingCombos = OCCASION_CITY_COMBOS.filter(
    (other) => !(other.occasion === occasion.slug && other.city === city.slug),
  ).slice(0, 6)

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${url}#service`,
    name: `${occasion.occasion} Hibachi in ${city.city}, CA`,
    serviceType: "Private hibachi chef catering",
    provider: { "@id": BUSINESS_ID },
    description: `Private hibachi chef and live show for a ${occasion.occasion.toLowerCase()} in ${city.city}, CA.`,
    areaServed: { "@type": "City", name: `${city.city}, CA` },
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
    mainEntity: occasion.faqs.map((faq) => ({
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
      { "@type": "ListItem", position: 2, name: "Party Ideas", item: `${BASE_URL}/party` },
      { "@type": "ListItem", position: 3, name: occasion.occasion, item: `${BASE_URL}/party/${occasion.slug}` },
      { "@type": "ListItem", position: 4, name: city.city, item: url },
    ],
  }

  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={[serviceJsonLd, faqJsonLd, breadcrumbJsonLd]} />

      {/* Hero */}
      <section className="hero-section bg-gradient-to-r from-amber-50 to-orange-50 pb-14">
        <div className="container mx-auto px-4">
          <nav className="text-sm text-gray-500 mb-6" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-primary">
              Home
            </Link>
            {" / "}
            <Link href="/party" className="hover:text-primary">
              Party Ideas
            </Link>
            {" / "}
            <Link href={`/party/${occasion.slug}`} className="hover:text-primary">
              {occasion.occasion}
            </Link>
            {" / "}
            <span className="text-gray-700">{city.city}</span>
          </nav>
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              {occasion.occasion} Hibachi in {city.city}
            </h1>
            <p className="text-2xl font-semibold text-orange-800 mb-3">{occasion.subline}</p>
            <p className="text-sm text-gray-600 mb-8">
              Fire up your story. · $59.90/adult, published · Serving {city.city} and all of Southern California
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

      {/* Local intro + media */}
      <section className="py-14">
        <div className="container mx-auto px-4">
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2">
            <div className="space-y-5">
              {combo.localIntro.map((paragraph) => (
                <p key={paragraph.slice(0, 32)} className="text-lg leading-8 text-gray-700">
                  {paragraph}
                </p>
              ))}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                <span className="inline-flex items-center gap-1">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                  4.9 average rating
                </span>
                <span>500+ parties served</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-orange-700" aria-hidden="true" />
                  SoCal only — a local team
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative col-span-2 h-64 overflow-hidden rounded-2xl">
                <LazyVideo
                  className="absolute inset-0 h-full w-full object-cover"
                  poster={occasion.video.poster}
                  src={occasion.video.src}
                />
              </div>
              {occasion.photos.slice(0, 2).map((photo) => (
                <div key={photo.src} className="relative h-40 overflow-hidden rounded-2xl">
                  <Image src={photo.src} alt={photo.alt} fill sizes="(max-width: 1024px) 50vw, 300px" className="object-cover" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Designed moments */}
      <section className="bg-[#fdf8f2] py-14">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-3xl font-bold">
              The moments we <span className="text-primary">design</span>
            </h2>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {occasion.moments.map((moment) => (
                <div key={moment.title} className="rounded-2xl border border-amber-100 bg-white p-6">
                  <Flame className="h-6 w-6 text-orange-600" aria-hidden="true" />
                  <h3 className="mt-3 text-lg font-semibold text-gray-900">{moment.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-700">{moment.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Calculator + reviews */}
      <section className="py-14">
        <div className="container mx-auto px-4">
          <div className="mx-auto grid max-w-6xl items-start gap-8 lg:grid-cols-2">
            <CityQuoteCalculator citySlug={city.slug} cityName={city.city} />
            <div className="space-y-4">
              {occasion.reviews.slice(0, 2).map((review) => (
                <div key={review.name} className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
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
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-[#fdf8f2] py-14">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-3xl font-bold">
              {occasion.occasion} in {city.city} <span className="text-primary">FAQ</span>
            </h2>
            <div className="mt-8 space-y-5">
              {occasion.faqs.map((faq) => (
                <div key={faq.question} className="rounded-2xl border border-gray-200 bg-white p-6">
                  <h3 className="font-semibold text-gray-900">{faq.question}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-700">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA + cross-links */}
      <section className="bg-gradient-to-r from-amber-50 to-orange-50 py-14">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold">Fire up your {city.city} story.</h2>
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
            More detail:{" "}
            <Link href={`/party/${occasion.slug}`} className="font-medium text-primary underline">
              {occasion.occasion} ideas
            </Link>{" "}
            ·{" "}
            <Link href={`/hibachi-at-home/${city.slug}`} className="font-medium text-primary underline">
              Hibachi at Home in {city.city}
            </Link>
          </p>
          <div className="mx-auto mt-4 flex max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
            {siblingCombos.map((other) => {
              const otherOccasion = getOccasionPage(other.occasion)
              const otherCity = getCityPage(other.city)
              if (!otherOccasion || !otherCity) return null
              return (
                <Link
                  key={`${other.occasion}-${other.city}`}
                  href={`/party/${other.occasion}/${other.city}`}
                  className="text-gray-600 underline hover:text-primary"
                >
                  {otherOccasion.occasion} · {otherCity.city}
                </Link>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
