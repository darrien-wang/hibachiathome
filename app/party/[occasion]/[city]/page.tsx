import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getOccasionPage } from "@/config/occasion-pages"
import { getCityPage } from "@/config/city-pages"
import { OCCASION_CITY_COMBOS, getCombo } from "@/config/occasion-city-pages"
import OccasionTemplate from "@/components/occasion/occasion-template"
import { JsonLd, BUSINESS_ID } from "@/components/structured-data"
import { phone } from "@/config/site"

const BASE_URL = "https://www.realhibachi.com"
const PHONE_RAW = phone.sms.e164

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
  const source = `combo_${occasion.slug.replace(/-/g, "_")}_${city.slug.replace(/-/g, "_")}`
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

  const others = siblingCombos.flatMap((other) => {
    const otherOccasion = getOccasionPage(other.occasion)
    const otherCity = getCityPage(other.city)
    if (!otherOccasion || !otherCity) return []
    return [{ label: `${otherOccasion.occasion} · ${otherCity.city}`, href: `/party/${other.occasion}/${other.city}` }]
  })

  return (
    <>
      <JsonLd data={[serviceJsonLd, faqJsonLd, breadcrumbJsonLd]} />
      <OccasionTemplate
        page={occasion}
        title={
          <>
            {occasion.occasion} Hibachi in {city.city}
          </>
        }
        breadcrumb={[
          { label: "Home", href: "/" },
          { label: "Party Ideas", href: "/party" },
          { label: occasion.occasion, href: `/party/${occasion.slug}` },
          { label: city.city },
        ]}
        intro={combo.localIntro}
        source={source}
        smsHref={smsHref}
        others={others}
        othersHeading="More parties nearby"
        faqHeading={`${occasion.occasion} in ${city.city} FAQ`}
        footnote={
          <>
            More detail:{" "}
            <Link href={`/party/${occasion.slug}`} className="underline hover:text-flame-700">
              {occasion.occasion} ideas
            </Link>{" "}
            ·{" "}
            <Link href={`/hibachi-at-home/${city.slug}`} className="underline hover:text-flame-700">
              Hibachi at Home in {city.city}
            </Link>
          </>
        }
      />
    </>
  )
}
