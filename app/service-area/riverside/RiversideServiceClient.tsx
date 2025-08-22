"use client"

import type React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Phone, Mail, MapPin, Clock, CheckCircle, Star, Users, Heart, Utensils, Calendar } from "lucide-react"
import Link from "next/link"

export default function RiversideServiceClient() {
  const riversideCities = [
    "Riverside", "Moreno Valley", "Corona", "Murrieta", "Temecula", "Hemet",
    "San Jacinto", "Perris", "Lake Elsinore", "Wildomar", "Menifee", "Beaumont",
    "Banning", "Cabazon", "Cherry Valley", "Calimesa", "Yucaipa", "Redlands",
    "Highland", "Fontana", "Rialto", "Colton", "Loma Linda", "Grand Terrace"
  ]

  return (
    <div className="page-container min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50">
      {/* Hero Section */}
      <div className="hero-section bg-gradient-to-r from-green-600 via-blue-600 to-purple-600 text-white pt-20 pb-16">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="secondary" className="mb-4 text-lg px-6 py-2">
                Professional Service in Riverside Inland Empire
              </Badge>
              <h1 className="text-4xl md:text-6xl font-bold mb-6">Hibachi at Home in Riverside</h1>
              <p className="text-xl md:text-2xl mb-8 opacity-90">
                Experience hibachi at home in Riverside and the Inland Empire! Serving Corona, Temecula, Murrieta, and surrounding communities.
              </p>
              <p className="text-lg mb-8 opacity-80">
                Bringing authentic Japanese teppanyaki experience to Riverside County's growing communities and family neighborhoods.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button asChild size="lg" className="bg-white text-green-600 hover:bg-gray-100">
                  <Link href="/book">BOOK NOW</Link>
                </Button>
                <div className="flex items-center gap-2 text-green-100">
                  <Phone className="h-5 w-5" />
                  <span className="text-lg font-medium">(213) 770-7788</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8">
                <h3 className="text-2xl font-bold mb-4">Inland Empire Hibachi Service</h3>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-300" />
                    <span>Professional coverage throughout Riverside County</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-300" />
                    <span>Premier choice for family gatherings and community events</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-300" />
                    <span>Professional service for large backyard parties</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-300" />
                    <span>Serving both emerging and established communities</span>
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
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-800">Riverside Inland Empire Hibachi Experience</h2>
          <p className="text-xl text-gray-600 max-w-4xl mx-auto mb-12">
            From family celebrations in Corona to community gatherings in Temecula, our professional hibachi chefs 
            bring authentic Japanese dining to the heart of the Inland Empire's vibrant communities.
          </p>
        </div>

        {/* Cities Covered */}
        <Card className="mb-16 shadow-xl border-0">
          <CardHeader className="bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-t-lg">
            <CardTitle className="text-2xl text-center">Riverside County Service Cities</CardTitle>
            <CardDescription className="text-center text-green-100 text-lg">
              We provide professional at-home hibachi service to Riverside County and Inland Empire areas
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {riversideCities.map((city, index) => (
                <Badge key={index} variant="outline" className="text-center py-2 text-sm hover:bg-green-50 transition-colors">
                  {city}
                </Badge>
              ))}
            </div>
            <div className="mt-8 text-center">
              <p className="text-gray-600 mb-4">Bringing authentic Japanese hibachi experience to Inland Empire families and communities.</p>
              <Button asChild>
                <Link href="/book" className="bg-green-600 hover:bg-green-700">Book Now</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Contact Section */}
        <Card className="bg-gradient-to-r from-green-500 to-blue-500 text-white">
          <CardContent className="p-8 text-center">
            <h2 className="text-3xl font-bold mb-6">Ready for Your Riverside Hibachi Experience?</h2>
            <p className="text-xl mb-8 opacity-90">
              Contact us to book your Riverside area hibachi experience and bring unforgettable Japanese cuisine to your gathering!
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-white text-green-600 hover:bg-gray-100">
                <Link href="/book">Book Online</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white text-white bg-transparent hover:bg-white hover:text-green-600">
                <Link href="/menu">View Menu</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

