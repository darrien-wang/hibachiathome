"use client"

import type React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Phone, Mail, MapPin, Clock, CheckCircle, Star, Users, Heart, Utensils, Calendar } from "lucide-react"
import Link from "next/link"

export default function PalmSpringsServiceClient() {
  // Only Tier 1 + Tier 2 cities with dedicated landing pages + Resort destinations
  const psCities = [
    // Tier 1: Premium desert resort destinations
    "Palm Springs", "Palm Desert", "Rancho Mirage",
    // Tier 2: Secondary markets with good potential
    "Cathedral City", "Indian Wells", "La Quinta", "Indio", "Coachella",
    // Resort/Spa destinations (always included)
    "Desert Hot Springs"
  ]

  return (
    <div className="page-container min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50">
      {/* Hero Section */}
      <div className="hero-section bg-gradient-to-r from-yellow-600 via-orange-600 to-red-600 text-white pt-20 pb-16">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="secondary" className="mb-4 text-lg px-6 py-2">
                Professional Service in Palm Springs Desert Area
              </Badge>
              <h1 className="text-4xl md:text-6xl font-bold mb-6">Hibachi at Home in Palm Springs</h1>
              <p className="text-xl md:text-2xl mb-8 opacity-90">
                Experience hibachi at home in Palm Springs and the Coachella Valley! Perfect for desert resort celebrations and luxury gatherings.
              </p>
              <p className="text-lg mb-8 opacity-80">
                Bringing authentic Japanese teppanyaki experience to the desert's most exclusive communities and resort destinations.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button asChild size="lg" className="bg-white text-orange-600 hover:bg-gray-100">
                  <Link href="/book">BOOK NOW</Link>
                </Button>
                <div className="flex items-center gap-2 text-yellow-100">
                  <Phone className="h-5 w-5" />
                  <span className="text-lg font-medium">(213) 770-7788</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8">
                <h3 className="text-2xl font-bold mb-4">Desert Resort Hibachi</h3>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-300" />
                    <span>Professional service for resorts and luxury homes</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-300" />
                    <span>Perfect for pool parties and outdoor gatherings</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-300" />
                    <span>Premier choice for festivals and special events</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-300" />
                    <span>Exclusive service for premium clients</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">
        {/* Service Description */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-800">Palm Springs Desert Resort Hibachi Experience</h2>
          <p className="text-xl text-gray-600 max-w-4xl mx-auto mb-12">
            From luxury resorts in Rancho Mirage to private estates in Indian Wells, our professional hibachi chefs 
            bring sophisticated Japanese dining to the desert's most exclusive locations.
          </p>
        </div>

        {/* Cities Covered */}
        <Card className="mb-16 shadow-xl border-0">
          <CardHeader className="bg-gradient-to-r from-yellow-600 to-orange-600 text-white rounded-t-lg">
            <CardTitle className="text-2xl text-center">Coachella Valley Service Cities</CardTitle>
            <CardDescription className="text-center text-yellow-100 text-lg">
              We provide professional at-home hibachi service to Palm Springs and Coachella Valley areas
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {psCities.map((city, index) => {
                // Create city mapping for links - Tier 1 + Tier 2 cities only
                const cityLinkMap: { [key: string]: string } = {
                  // Tier 1: Premium desert resort destinations  
                  "Palm Springs": "/service-area/palm-springs/palm-springs-city",
                  "Palm Desert": "/service-area/palm-springs/palm-desert",
                  "Rancho Mirage": "/service-area/palm-springs/rancho-mirage",
                  // Tier 2: Secondary markets with good potential
                  "Cathedral City": "/service-area/palm-springs/cathedral-city",
                  "Indian Wells": "/service-area/palm-springs/indian-wells",
                  "La Quinta": "/service-area/palm-springs/la-quinta",
                  "Indio": "/service-area/palm-springs/indio",
                  "Coachella": "/service-area/palm-springs/coachella",
                  // Resort/Spa destinations (always included)
                  "Desert Hot Springs": "/service-area/palm-springs/desert-hot-springs"
                }
                
                const cityLink = cityLinkMap[city]
                
                if (cityLink) {
                  return (
                    <Link key={index} href={cityLink}>
                      <Badge 
                        variant="outline" 
                        className="text-center py-2 text-sm hover:bg-yellow-50 hover:border-yellow-300 cursor-pointer transition-colors w-full"
                      >
                        {city}
                      </Badge>
                    </Link>
                  )
                }
                
                return (
                  <Badge key={index} variant="outline" className="text-center py-2 text-sm hover:bg-yellow-50 transition-colors">
                    {city}
                  </Badge>
                )
              })}
            </div>
            <div className="mt-8 text-center">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-yellow-800 font-medium">
                  🌵 Serving the Greater Coachella Valley
                  <br />Including resort communities, spa destinations, and vacation rentals throughout the desert region
                </p>
              </div>
              <Button asChild>
                <Link href="/book" className="bg-yellow-600 hover:bg-yellow-700">Book Desert Hibachi Experience</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Contact Section */}
        <Card className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white">
          <CardContent className="p-8 text-center">
            <h2 className="text-3xl font-bold mb-6">Ready for Your Palm Springs Hibachi Experience?</h2>
            <p className="text-xl mb-8 opacity-90">
              Contact us to book your Palm Springs hibachi experience and add Japanese flavor to your desert vacation!
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-white text-orange-600 hover:bg-gray-100">
                <Link href="/book">Book Online</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white text-white bg-transparent hover:bg-white hover:text-orange-600">
                <Link href="/menu">View Menu</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

