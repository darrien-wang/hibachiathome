// Server-renderable JSON-LD structured data for SEO / GEO (AI search engines).
import { phone } from "@/config/site"
// Keep all business facts here consistent with config/site.ts and live pages —
// AI engines cross-check these values against page text and third-party listings.

const BASE_URL = "https://www.realhibachi.com"

export const BUSINESS_ID = `${BASE_URL}/#business`

export const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "FoodEstablishment",
  "@id": BUSINESS_ID,
  name: "Real Hibachi",
  alternateName: "Real Hibachi at Home",
  description:
    "Real Hibachi brings a private hibachi chef, mobile teppanyaki grill, fresh ingredients, live cooking show, setup, and cleanup to homes and events across Southern California. Flat rate $59.90 per adult with a $599 event minimum.",
  url: BASE_URL,
  telephone: phone.voice.e164,
  email: "support@realhibachi.com",
  priceRange: "$$",
  servesCuisine: ["Japanese", "Hibachi", "Teppanyaki"],
  image: `${BASE_URL}/images/hibachi-flame-og.png`,
  logo: "https://www.realhibachi.com/images/logo-realhibachi.png",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Los Angeles",
    addressRegion: "CA",
    addressCountry: "US",
  },
  areaServed: [
    { "@type": "AdministrativeArea", name: "Los Angeles County, CA" },
    { "@type": "AdministrativeArea", name: "Orange County, CA" },
    { "@type": "AdministrativeArea", name: "San Diego County, CA" },
    { "@type": "AdministrativeArea", name: "Riverside County, CA" },
    { "@type": "AdministrativeArea", name: "San Bernardino County, CA" },
    { "@type": "AdministrativeArea", name: "Ventura County, CA" },
  ],
  sameAs: [
    "https://www.instagram.com/realhibachi/",
    "https://www.facebook.com/profile.php?id=61576199137704",
  ],
}

export const webSiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${BASE_URL}/#website`,
  name: "Real Hibachi",
  url: BASE_URL,
  publisher: { "@id": BUSINESS_ID },
}

export const hibachiAtHomeServiceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": `${BASE_URL}/hibachi-at-home#service`,
  name: "Hibachi at Home — Private Hibachi Chef & Mobile Teppanyaki Catering",
  serviceType: "Private hibachi chef catering",
  provider: { "@id": BUSINESS_ID },
  areaServed: localBusinessJsonLd.areaServed,
  description:
    "A private hibachi chef comes to your home or event space with a mobile teppanyaki grill, fresh ingredients, and a live cooking show. Includes setup, entertainment, and cleanup. Each guest gets fried rice, fresh vegetables, house salad, and 2 proteins.",
  offers: [
    {
      "@type": "Offer",
      name: "Standard Plan",
      priceCurrency: "USD",
      price: "59.90",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "59.90",
        priceCurrency: "USD",
        unitText: "per adult ($29.90 per child 5–12, $5 per kid under 5, $599 event minimum)",
      },
      availability: "https://schema.org/InStock",
      url: `${BASE_URL}/hibachi-at-home`,
    },
  ],
}

export function JsonLd({ data }: { data: object | object[] }) {
  const items = Array.isArray(data) ? data : [data]
  return (
    <>
      {items.map((item, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
    </>
  )
}
