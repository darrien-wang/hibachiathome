"use client"

import type React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Phone, Mail, MapPin, Clock, CheckCircle, Star, Users, Heart, Utensils, Calendar } from "lucide-react"
import Link from "next/link"

export default function SanDiegoServiceClient() {
  const sdCities = [
    "San Diego", "La Jolla", "Del Mar", "Encinitas", "Carlsbad", "Oceanside",
    "Vista", "Escondido", "Poway", "Rancho Bernardo", "Mira Mesa", "Scripps Ranch",
    "Mission Valley", "Hillcrest", "Balboa Park", "Point Loma", "Mission Beach",
    "Pacific Beach", "Coronado", "Chula Vista", "National City", "Imperial Beach",
    "Bonita", "Eastlake", "Otay Ranch", "Rancho San Diego"
  ]

  return (
    <div className="page-container min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50">
      {/* Hero Section */}
      <div className="hero-section bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 text-white pt-20 pb-16">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="secondary" className="mb-4 text-lg px-6 py-2">
                Professional Service in San Diego Area
              </Badge>
              <h1 className="text-4xl md:text-6xl font-bold mb-6">Hibachi at Home in San Diego</h1>
              <p className="text-xl md:text-2xl mb-8 opacity-90">
                Experience hibachi at home in San Diego, CA! From La Jolla to Coronado, we bring authentic Japanese teppanyaki to your location.
              </p>
              <p className="text-lg mb-8 opacity-80">
                Serving America's Finest City with premium hibachi catering services. Perfect for beachside celebrations and elegant dinner parties.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button asChild size="lg" className="bg-white text-blue-600 hover:bg-gray-100">
                  <Link href="/book">BOOK NOW</Link>
                </Button>
                <div className="flex items-center gap-2 text-blue-100">
                  <Phone className="h-5 w-5" />
                  <span className="text-lg font-medium">(213) 770-7788</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8">
                <h3 className="text-2xl font-bold mb-4">San Diego Hibachi Experts</h3>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-300" />
                    <span>Professional service throughout San Diego County</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-300" />
                    <span>Premier choice for beachside gatherings and upscale events</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-300" />
                    <span>Perfect for indoor and outdoor venues</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-300" />
                    <span>Fresh seafood and premium ingredients</span>
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
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-800">San Diego Beachside Hibachi Experience</h2>
          <p className="text-xl text-gray-600 max-w-4xl mx-auto mb-12">
            Whether you're hosting a beachfront celebration in Del Mar or an intimate gathering in La Jolla, 
            our professional hibachi chefs bring the authentic Japanese teppanyaki experience to your San Diego location.
          </p>
        </div>

        {/* Cities Covered */}
        <Card className="mb-16 shadow-xl border-0">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-t-lg">
            <CardTitle className="text-2xl text-center">San Diego County Service Cities</CardTitle>
            <CardDescription className="text-center text-blue-100 text-lg">
              We provide professional at-home hibachi service to the following San Diego County cities
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {sdCities.map((city, index) => (
                <Badge key={index} variant="outline" className="text-center py-2 text-sm hover:bg-blue-50 transition-colors">
                  {city}
                </Badge>
              ))}
            </div>
            <div className="mt-8 text-center">
              <p className="text-gray-600 mb-4">Experience Japanese hibachi in America's Finest City.</p>
              <Button asChild>
                <Link href="/book" className="bg-blue-600 hover:bg-blue-700">Book Now</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Contact Section */}
        <Card className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
          <CardContent className="p-8 text-center">
            <h2 className="text-3xl font-bold mb-6">Ready for Your San Diego Hibachi Experience?</h2>
            <p className="text-xl mb-8 opacity-90">
              Contact us to book your San Diego hibachi experience and make your beachside city gathering even more spectacular!
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-white text-blue-600 hover:bg-gray-100">
                <Link href="/book">Book Online</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white text-white bg-transparent hover:bg-white hover:text-blue-600">
                <Link href="/menu">View Menu</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

