import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { occasionPages, getOccasionPage, getOtherOccasions } from "@/config/occasion-pages"
import OccasionTemplate from "@/components/occasion/occasion-template"
import { JsonLd, BUSINESS_ID } from "@/components/structured-data"
import { phone } from "@/config/site"

const BASE_URL = "https://www.realhibachi.com"
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

// Ads land here (e.g. the "Bachelorette & Girls Night" ad group), so the page
// follows the "Realhibachi Party" board: occasion + price + estimator first,
// the story and the SEO copy (all verbatim from config/occasion-pages) after.
export default async function OccasionPage({ params }: { params: Promise<{ occasion: string }> }) {
  const { occasion } = await params
  const page = getOccasionPage(occasion)
  if (!page) {
    notFound()
  }

  const url = `${BASE_URL}/party/${page.slug}`
  const source = `occasion_${page.slug.replace(/-/g, "_")}`
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
    <>
      <JsonLd data={[serviceJsonLd, faqJsonLd, breadcrumbJsonLd]} />
      <OccasionTemplate
        page={page}
        title={page.headline}
        breadcrumb={[
          { label: "Home", href: "/" },
          { label: "Party Ideas", href: "/party" },
          { label: page.occasion },
        ]}
        intro={page.intro}
        source={source}
        smsHref={smsHref}
        others={others.map((o) => ({ label: o.occasion, href: `/party/${o.slug}` }))}
      />
    </>
  )
}
