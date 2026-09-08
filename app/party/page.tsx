import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { occasionPages } from "@/config/occasion-pages"
import { JsonLd, BUSINESS_ID } from "@/components/structured-data"
import { smsHref } from "@/config/site"

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

// 2026-09-08 redesign ("Realhibachi Party" board): kicker, one headline, one
// line, three chips, then the twelve occasions as tappable photo cards (the
// first one full-width), a gold "not listed?" card and a sticky quote bar.
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

  const sms = smsHref("Hi Real Hibachi! I'm planning a party and would love a quote.")

  return (
    <div className="bg-cream pb-28 text-ink lg:pb-16">
      <JsonLd data={[breadcrumbJsonLd, itemListJsonLd, serviceProviderJsonLd]} />

      <div className="mx-auto max-w-7xl px-5 pt-[calc(var(--header-height,60px)+16px)] lg:px-8 lg:pt-[calc(var(--header-height,72px)+40px)]">
        <div className="flex flex-col gap-2.5 lg:max-w-3xl lg:gap-3.5">
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-flame-700">Fire up your story.</span>
          <h1 className="font-serif text-4xl font-extrabold leading-none lg:text-[56px]">A Reason to Gather Is All You Need</h1>
          <p className="text-[15px] leading-relaxed text-clay-700 lg:text-lg">
            Birthdays, pool parties, reunions, reveals, holidays — whatever brings your people together, we bring the chef, the fire, and the show.
          </p>
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-clay-700 lg:text-[13px]">
            {["500+ parties served", "Full refund up to 72h", "All of Southern California"].map((chip) => (
              <span key={chip} className="rounded-full border border-ink/15 px-3 py-1.5">
                {chip}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5 lg:mt-10 lg:grid-cols-4 lg:gap-4">
          {occasionPages.map((page, i) => (
            <Link
              key={page.slug}
              href={`/party/${page.slug}`}
              className={`group flex flex-col overflow-hidden rounded-[28px] border border-ink/10 bg-white shadow-organic transition hover:border-flame-300 hover:shadow-organic-lg ${
                i === 0 ? "col-span-2" : ""
              }`}
            >
              <div className={`relative w-full overflow-hidden ${i === 0 ? "aspect-[16/9] lg:aspect-[2.4/1]" : "aspect-square lg:aspect-[4/3]"}`}>
                <Image
                  src={page.photos[0].src}
                  alt={page.photos[0].alt}
                  fill
                  sizes={i === 0 ? "(max-width: 1024px) 100vw, 1200px" : "(max-width: 1024px) 50vw, 300px"}
                  className="object-cover saturate-[1.12] transition duration-300 group-hover:scale-105"
                />
              </div>
              <div className="flex flex-col gap-0.5 px-3 pb-3.5 pt-3 lg:px-4 lg:pb-4">
                <h2 className="font-serif text-[17px] font-extrabold leading-tight lg:text-lg">{page.occasion}</h2>
                <p className="text-xs leading-snug text-clay-700 lg:text-[13px]">{page.subline}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2 rounded-[28px] bg-gold-100 p-[18px] text-gold-800 lg:mt-10 lg:flex-row lg:items-center lg:justify-between lg:p-6">
          <p className="text-base font-bold lg:text-lg">Celebrating something we haven&apos;t listed? We&apos;re still in.</p>
          <Link href="/quote?source=occasion_hub" className="inline-flex h-12 items-center justify-center rounded-full bg-flame px-6 text-[15px] font-bold text-white hover:bg-flame-600">
            Get an Instant Quote
          </Link>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 bg-[linear-gradient(180deg,rgba(247,239,226,0)_0%,#f7efe2_30%)] px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 lg:hidden">
        <a href={sms} className="inline-flex h-[50px] items-center rounded-full border border-ink/15 bg-white px-[18px] text-sm font-semibold text-ink">
          Text us
        </a>
        <Link href="/quote?source=occasion_hub" className="flex h-[50px] flex-1 items-center justify-center rounded-full bg-flame text-[15px] font-bold text-white shadow-organic-lg">
          Get an Instant Quote
        </Link>
      </div>
    </div>
  )
}
