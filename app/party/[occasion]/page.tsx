import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { MessageSquare, Star, MapPin, Check, Flame } from "lucide-react"
import { occasionPages, getOccasionPage, getOtherOccasions } from "@/config/occasion-pages"
import LazyVideo from "@/components/lazy-video"
import { JsonLd, BUSINESS_ID } from "@/components/structured-data"
import { phone } from "@/config/site"

const BASE_URL = "https://www.realhibachi.com"
const PHONE_DISPLAY = phone.sms.display
const PHONE_RAW = phone.sms.e164

export async function generateStaticParams() {
  return occasionPages.map((page) => ({ occasion: page.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ occasion: string }> }): Promise<Metadata> {
  const { occasion } = await params
  const page = getOccasionPage(occasion)
  if (!page) {
    return { title: "Page Not Found" }
  }
  const url = `${BASE_URL}/party/${page.slug}`
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
          alt: page.headline,
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
  "Complete setup and cleanup",
]

export default async function OccasionPage({ params }: { params: Promise<{ occasion: string }> }) {
  const { occasion } = await params
  const page = getOccasionPage(occasion)
  if (!page) {
    notFound()
  }

  const url = `${BASE_URL}/party/${page.slug}`
  const quoteHref = `/quote?source=occasion_${page.slug.replace(/-/g, "_")}`
  const smsHref = `sms:${PHONE_RAW}?body=${encodeURIComponent(
    `Hi Real Hibachi! I'm planning a ${page.occasion.toLowerCase()} and would love a quote.`,
  )}`
  const others = getOtherOccasions(page.slug)

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${url}#service`,
    name: page.headline,
    serviceType: "Private hibachi chef catering",
    provider: { "@id": BUSINESS_ID },
    description: page.metaDescription,
    areaServed: { "@type": "State", name: "Southern California" },
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
    mainEntity: page.faqs.map((faq) => ({
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
      { "@type": "ListItem", position: 3, name: page.occasion, item: url },
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
            <span className="text-gray-700">{page.occasion}</span>
          </nav>
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">{page.headline}</h1>
            <p className="text-2xl font-semibold text-orange-800 mb-3">{page.subline}</p>
            <p className="text-sm text-gray-600 mb-8">
              Fire up your story. · Serving all of Southern California · From $59.90/adult
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

      {/* Story intro + media */}
      <section className="py-14">
        <div className="container mx-auto px-4">
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2">
            <div className="space-y-5">
              {page.intro.map((paragraph) => (
                <p key={paragraph.slice(0, 32)} className="text-lg leading-8 text-gray-700">
                  {paragraph}
                </p>
              ))}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                <span className="inline-flex items-center gap-1">
                  <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  Full deposit refund up to 72h
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
                  poster={page.video.poster}
                  src={page.video.src}
                />
              </div>
              {page.photos.slice(0, 2).map((photo) => (
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
            <p className="mx-auto mt-2 max-w-2xl text-center text-gray-600">
              Every {page.occasion.toLowerCase()} has a highlight. Our chefs build the show around yours.
            </p>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {page.moments.map((moment) => (
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

      {/* Third photo + what's included + price anchor */}
      <section className="py-14">
        <div className="container mx-auto px-4">
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2">
            <div className="relative h-80 overflow-hidden rounded-2xl">
              <Image
                src={page.photos[2]?.src ?? page.photos[0].src}
                alt={page.photos[2]?.alt ?? page.photos[0].alt}
                fill
                sizes="(max-width: 1024px) 100vw, 560px"
                className="object-cover"
              />
            </div>
            <div>
              <h2 className="text-3xl font-bold">
                Everything's <span className="text-primary">included</span>
              </h2>
              <ul className="mt-6 space-y-3">
                {included.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-gray-700">
                    <Check className="mt-1 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-6 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5">
                <p className="text-2xl font-bold text-orange-800">
                  $59.90<span className="text-base font-semibold">/adult</span>
                  <span className="ml-2 text-base font-semibold text-amber-700">$29.90/child</span>
                </p>
                <p className="mt-1 text-sm text-gray-700">
                  $599 event minimum · $19.90 refundable deposit locks your date · exact quote in 30 seconds
                </p>
                <Button asChild className="mt-4 h-11 w-full rounded-full bg-[hsl(24_79%_55%)] text-white hover:bg-[hsl(24_79%_48%)] sm:w-auto sm:px-8">
                  <Link href={quoteHref}>Get Your Instant Quote</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section className="bg-[#fdf8f2] py-14">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-3xl font-bold">What Our Guests Say</h2>
            <div className="mt-1.5 flex items-center justify-center gap-1 text-sm text-gray-600">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
              ))}
              <span className="ml-1">5-star Google reviews</span>
            </div>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {page.reviews.map((review) => (
                <div key={review.name} className="rounded-2xl border border-amber-100 bg-white p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-base font-bold text-white">
                      {review.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{review.name}</p>
                      <p className="text-xs text-gray-500">Google review</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-gray-700">{review.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-14">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-3xl font-bold">
              {page.occasion} <span className="text-primary">FAQ</span>
            </h2>
            <div className="mt-8 space-y-6">
              {page.faqs.map((faq) => (
                <div key={faq.question} className="rounded-2xl border border-gray-200 p-6">
                  <h3 className="font-semibold text-gray-900">{faq.question}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-700">{faq.answer}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-sm text-gray-600">
              More questions?{" "}
              <Link href="/faq" className="font-medium text-primary underline">
                See the full FAQ
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Other occasions + closing CTA */}
      <section className="bg-gradient-to-r from-amber-50 to-orange-50 py-14">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold">Fire up your story.</h2>
          <p className="mx-auto mt-2 max-w-xl text-gray-700">
            Whatever you're celebrating, if it's worth gathering for, it's worth a show.
          </p>
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
          <div className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
            {others.map((other) => (
              <Link key={other.slug} href={`/party/${other.slug}`} className="text-gray-600 underline hover:text-primary">
                {other.occasion}
              </Link>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-3xl text-sm font-medium text-gray-700">
            Where we cook it
          </p>
          <div className="mx-auto mt-2 flex max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
            {[
              { slug: "los-angeles", name: "Los Angeles" },
              { slug: "san-diego", name: "San Diego" },
              { slug: "irvine", name: "Irvine" },
              { slug: "anaheim", name: "Anaheim" },
              { slug: "long-beach", name: "Long Beach" },
              { slug: "pasadena", name: "Pasadena" },
              { slug: "riverside", name: "Riverside" },
              { slug: "santa-monica", name: "Santa Monica" },
            ].map((cityLink) => (
              <Link
                key={cityLink.slug}
                href={`/hibachi-at-home/${cityLink.slug}`}
                className="text-gray-600 underline hover:text-primary"
              >
                {cityLink.name}
              </Link>
            ))}
            <Link href="/locations" className="font-medium text-primary underline">
              All 33 cities
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
