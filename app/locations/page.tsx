import type { Metadata } from "next"
import { cityPages, getCityPage } from "@/config/city-pages"
import { getCityTravel } from "@/config/city-travel"
import { CATERING_CITIES } from "@/config/catering-cities"
import { JsonLd } from "@/components/structured-data"
import LocationsClient, { type LocationRegion } from "./LocationsClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Service Areas | Southern California",
  description:
    "Professional hibachi at home service across Southern California: Los Angeles, Orange County, San Diego, Riverside, San Bernardino & Ventura counties. Authentic Japanese teppanyaki chefs for private events and parties.",
  keywords:
    "hibachi service locations, Los Angeles hibachi, Orange County hibachi, San Diego hibachi, Inland Empire hibachi, private teppanyaki chef areas",
  alternates: { canonical: "https://www.realhibachi.com/locations" },
  openGraph: {
    title: "Hibachi at Home Service Areas | Southern California",
    description:
      "Premium hibachi at home service across all of Southern California. Professional Japanese teppanyaki chefs at your location.",
    url: "https://www.realhibachi.com/locations",
    siteName: "Real Hibachi",
    type: "website",
  },
}

// County → region on the page. Riverside + San Bernardino read as one
// "Inland Empire & Desert" group (Riverside/Corona are inside the free 50
// miles; the desert and mountain routes carry a travel fee).
const REGION_OF: Record<string, { id: string; name: string; short: string }> = {
  "Los Angeles County": { id: "la", name: "Los Angeles County", short: "Los Angeles" },
  "Orange County": { id: "oc", name: "Orange County", short: "Orange County" },
  "San Diego County": { id: "sd", name: "San Diego County", short: "San Diego" },
  "Riverside County": { id: "ie", name: "Inland Empire & Desert", short: "Inland Empire" },
  "San Bernardino County": { id: "ie", name: "Inland Empire & Desert", short: "Inland Empire" },
  "Ventura County": { id: "vc", name: "Ventura County", short: "Ventura" },
}
const ORDER = ["la", "oc", "sd", "ie", "vc"]

export default function LocationsPage() {
  const byId = new Map<string, LocationRegion>()
  for (const page of cityPages) {
    const meta = REGION_OF[page.county] ?? { id: "other", name: page.county, short: page.county.replace(" County", "") }
    const travel = getCityTravel(page.slug)
    const far = travel ? travel.fee > 0 : true
    const region = byId.get(meta.id) ?? { ...meta, note: "", cities: [] }
    region.cities.push({ name: page.city, slug: page.slug, far })
    byId.set(meta.id, region)
  }
  const regions = [...byId.values()]
    .sort((a, b) => (ORDER.indexOf(a.id) === -1 ? 99 : ORDER.indexOf(a.id)) - (ORDER.indexOf(b.id) === -1 ? 99 : ORDER.indexOf(b.id)))
    .map((r) => {
      const farCount = r.cities.filter((c) => c.far).length
      const note =
        farCount === 0 ? "travel included" : farCount === r.cities.length ? "travel fee shown in quote" : "most travel included · outlying routes carry a travel fee"
      return { ...r, note }
    })

  const catering = CATERING_CITIES.map((slug) => getCityPage(slug))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => ({ name: p.city, slug: p.slug }))

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How far do you travel?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The first 50 miles of travel are included. Beyond that a travel fee of $1 per extra mile is calculated from your address and shown in your quote before any deposit.",
        },
      },
      {
        "@type": "Question",
        name: "Do you serve San Diego and the desert?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes — San Diego, La Jolla, Oceanside, Palm Springs, La Quinta, Joshua Tree and Big Bear Lake are all regular routes. These usually carry a travel fee, listed in the quote.",
        },
      },
      {
        "@type": "Question",
        name: "What if my city isn't listed?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "We're expanding our service areas regularly. Enter your address in the quote tool or contact us to check if we can accommodate your location.",
        },
      },
    ],
  }

  return (
    <>
      <JsonLd data={faqJsonLd} />
      <LocationsClient regions={regions} catering={catering} />
    </>
  )
}
