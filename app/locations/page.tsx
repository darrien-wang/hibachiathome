import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { MapPin } from "lucide-react"
import type { Metadata } from "next"
import { cityPages } from "@/config/city-pages"

export const metadata: Metadata = {
  title: "Hibachi at Home Service Areas | Southern California",
  description:
    "Professional hibachi at home service across Southern California: Los Angeles, Orange County, San Diego, Riverside, San Bernardino & Ventura counties. Authentic Japanese teppanyaki chefs for private events and parties.",
  keywords:
    "hibachi service locations, Los Angeles hibachi, Orange County hibachi, San Diego hibachi, Inland Empire hibachi, private teppanyaki chef areas",
  openGraph: {
    title: "Hibachi at Home Service Areas | Southern California",
    description:
      "Premium hibachi at home service across all of Southern California. Professional Japanese teppanyaki chefs at your location.",
    url: "https://www.realhibachi.com/locations",
    siteName: "Real Hibachi",
    type: "website",
  },
}

const locations = [
  {
    id: "southern-california",
    name: "Southern California",
    state: "CA",
    description:
      "Serving Los Angeles, Orange County, San Diego, Riverside, San Bernardino, and Ventura counties",
    areas: [
      "Los Angeles",
      "Orange County",
      "San Diego",
      "Riverside",
      "San Bernardino",
      "Ventura",
      "Beverly Hills",
      "Santa Monica",
      "Pasadena",
      "Irvine",
      "Newport Beach",
      "Anaheim",
      "Long Beach",
      "Burbank",
      "Glendale",
      "West Hollywood",
    ],
    featured: true,
    learnMoreHref: "/locations/la-orange-county",
  },
]

export default function LocationsPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-4">Hibachi at Home Service Locations</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            We serve all of Southern California. Our professional chefs bring authentic Japanese teppanyaki
            experiences directly to your location.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 mb-12 max-w-2xl mx-auto">
          {locations.map((location) => (
            <Card key={location.id}>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MapPin className="h-5 w-5 mr-2 text-primary" />
                  {location.name}, {location.state}
                </CardTitle>
                <CardDescription>{location.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <h3 className="font-medium mb-2">Areas Served:</h3>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1 mb-6">
                  {location.areas.map((area) => (
                    <li key={area} className="text-gray-600 text-sm">
                      • {area}
                    </li>
                  ))}
                </ul>
                <Button asChild variant="outline" className="w-full">
                  <Link href={location.learnMoreHref}>Learn More About {location.name} Service</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mb-12">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Find Your City</h2>
            <p className="text-gray-600">
              Local pricing, popular occasions, and neighborhood coverage for every city we serve.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {cityPages.map((city) => (
              <Link
                key={city.slug}
                href={`/hibachi-at-home/${city.slug}`}
                className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-white px-5 py-2.5 text-primary font-medium hover:bg-primary hover:text-white transition-colors"
              >
                <MapPin className="h-4 w-4" />
                {city.city}
              </Link>
            ))}
          </div>
        </div>

        <div className="mb-12">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Hibachi Catering by Metro</h2>
            <p className="text-gray-600">Bigger events, corporate parties, and full-service catering pages.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { slug: "los-angeles", name: "Los Angeles" },
              { slug: "san-diego", name: "San Diego" },
              { slug: "long-beach", name: "Long Beach" },
              { slug: "pasadena", name: "Pasadena" },
              { slug: "riverside", name: "Riverside" },
              { slug: "anaheim", name: "Anaheim" },
              { slug: "irvine", name: "Irvine" },
              { slug: "huntington-beach", name: "Huntington Beach" },
            ].map((metro) => (
              <Link
                key={metro.slug}
                href={`/hibachi-catering/${metro.slug}`}
                className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-5 py-2.5 font-medium text-amber-800 transition-colors hover:bg-amber-100"
              >
                {metro.name} Catering
              </Link>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-gray-600">
            Planning a specific celebration?{" "}
            <Link href="/party" className="font-medium text-primary underline">
              Browse party ideas by occasion
            </Link>
            .
          </p>
        </div>

        <div className="mt-12 text-center">
          <h2 className="text-2xl font-bold mb-4">Don't see your area?</h2>
          <p className="text-gray-600 mb-4">
            We're expanding our service areas regularly. Contact us to check if we can accommodate your location.
          </p>
          <Button asChild>
            <Link href="/contact">Contact Us</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
