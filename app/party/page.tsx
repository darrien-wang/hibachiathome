import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Star, MapPin } from "lucide-react"
import { occasionPages } from "@/config/occasion-pages"
import { JsonLd, BUSINESS_ID } from "@/components/structured-data"

const BASE_URL = "https://www.realhibachi.com"
const URL = `${BASE_URL}/party`

export const metadata: Metadata = {
  title: "Party Ideas | A Hibachi Chef for Every Occasion",
  description:
    "Birthdays, pool parties, reunions, holidays — if it's worth gathering for, it's worth a show. A private hibachi chef comes to you, anywhere in Southern California.",
  alternates: { canonical: URL },
  openGraph: {
    title: "Party Ideas | A Hibachi Chef for Every Occasion | Real Hibachi",
    description:
      "Birthdays, pool parties, reunions, holidays — a private hibachi chef and live fire show at your place, anywhere in Southern California.",
    url: URL,
    siteName: "Real Hibachi",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: `${BASE_URL}/images/hibachi-flame-og.png`,
        width: 1200,
        height: 630,
        alt: "Real Hibachi party occasions",
      },
    ],
  },
}

export default function PartyHubPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "Party Ideas", item: URL },
    ],
  }

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Real Hibachi party occasions",
    itemListElement: occasionPages.map((page, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: page.headline,
      url: `${BASE_URL}/party/${page.slug}`,
    })),
  }

  const serviceProviderJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${URL}#service`,
    name: "Private hibachi chef for any occasion",
    serviceType: "Private hibachi chef catering",
    provider: { "@id": BUSINESS_ID },
    areaServed: { "@type": "State", name: "Southern California" },
  }

  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={[breadcrumbJsonLd, itemListJsonLd, serviceProviderJsonLd]} />

      <section className="bg-gradient-to-r from-amber-50 to-orange-50 pt-12 pb-14">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold">A Reason to Gather Is All You Need</h1>
          <p className="mx-auto mt-4 max-w-2xl text-2xl font-semibold text-orange-800">Fire up your story.</p>
          <p className="mx-auto mt-3 max-w-2xl text-gray-700">
            Birthdays, pool parties, reunions, reveals, holidays — whatever brings your people together, we bring the
            chef, the fire, and the show.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-gray-600">
            <span className="inline-flex items-center gap-1">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
              4.9 average rating · 500+ parties
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-4 w-4 text-orange-700" aria-hidden="true" />
              Serving all of Southern California
            </span>
          </div>
        </div>
      </section>

      <section className="py-14">
        <div className="container mx-auto px-4">
          <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {occasionPages.map((page) => (
              <Link
                key={page.slug}
                href={`/party/${page.slug}`}
                className="group overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm transition hover:shadow-lg"
              >
                <div className="relative h-48 overflow-hidden">
                  <Image
                    src={page.photos[0].src}
                    alt={page.photos[0].alt}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
                    className="object-cover transition duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="p-5">
                  <h2 className="text-lg font-semibold text-gray-900 group-hover:text-primary">{page.occasion}</h2>
                  <p className="mt-1 text-sm leading-6 text-gray-600">{page.subline}</p>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-12 text-center">
            <p className="text-gray-700">Celebrating something we haven't listed? We're still in.</p>
            <Button asChild className="mt-4 h-12 rounded-full bg-[hsl(24_79%_55%)] px-8 text-white hover:bg-[hsl(24_79%_48%)]">
              <Link href="/quote?source=occasion_hub">Get an Instant Quote</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
