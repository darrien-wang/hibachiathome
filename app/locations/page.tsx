import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { MapPin } from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Hibachi at Home Service Locations | Los Angeles & Orange County | Real Hibachi",
  description: "Professional hibachi at home service in Los Angeles and Orange County. Authentic Japanese teppanyaki chefs serving Beverly Hills, Santa Monica, Irvine, and surrounding areas.",
  keywords: "hibachi service locations Los Angeles, teppanyaki at home Orange County, Japanese chef service areas LA, hibachi catering locations California",
  openGraph: {
    title: "Hibachi at Home Service Locations | Los Angeles & Orange County",
    description: "Premium hibachi at home service covering Los Angeles and Orange County. Professional Japanese teppanyaki chefs at your location.",
    url: "https://realhibachi.com/locations",
    siteName: "Real Hibachi",
    type: "website",
  },
}

const locations = [
  {
    id: "los-angeles",
    name: "Los Angeles",
    state: "CA",
    description: "Serving Los Angeles, Orange County and surrounding areas within a 50-mile radius",
    areas: [
      "Los Angeles",
      "Orange County",
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
  },
]

export default function LocationsPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-4">Hibachi at Home Service Locations</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Currently serving Southern California with premium hibachi at home service in Los Angeles and Orange County. Our professional chefs bring authentic Japanese teppanyaki experience directly to your location.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
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
                  <Link href="/locations/la-orange-county">Learn More About {location.name} Service</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="rounded-lg overflow-hidden border h-[400px] relative">
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <p className="text-gray-500">Map placeholder - Interactive map will be displayed here</p>
          </div>
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
