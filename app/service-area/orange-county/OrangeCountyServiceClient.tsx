"use client"

import type React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Phone, Mail, MapPin, Clock, CheckCircle, Star, Users, Heart, Utensils, Calendar } from "lucide-react"
import Link from "next/link"

export default function OrangeCountyServiceClient() {
  const ocCities = [
    "Irvine", "Newport Beach", "Huntington Beach", "Costa Mesa", "Fountain Valley",
    "Westminster", "Garden Grove", "Orange", "Santa Ana", "Tustin", "Laguna Beach",
    "Dana Point", "San Juan Capistrano", "Mission Viejo", "Lake Forest", "Aliso Viejo",
    "Laguna Hills", "Laguna Niguel", "Rancho Santa Margarita", "Anaheim", "Fullerton",
    "Brea", "Placentia", "Yorba Linda", "Cypress", "Los Alamitos", "Seal Beach", 
    "Buena Park", "La Palma", "Stanton", "La Habra", "Villa Park"
  ]

  return (
    <div className="page-container min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50">
      {/* Hero Section */}
      <div className="hero-section bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 text-white pt-20 pb-16">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="secondary" className="mb-4 text-lg px-6 py-2">
                Professional Service in Orange County Area
              </Badge>
              <h1 className="text-4xl md:text-6xl font-bold mb-6">Hibachi at Home in Orange County</h1>
              <p className="text-xl md:text-2xl mb-8 opacity-90">
                Experience hibachi at home in Orange County, CA! Professional Japanese teppanyaki chefs bringing authentic flavors to your location.
              </p>
              <p className="text-lg mb-8 opacity-80">
                Serving Irvine, Newport Beach, Anaheim, Huntington Beach, and all Orange County cities with premium hibachi catering services.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button asChild size="lg" className="bg-white text-orange-600 hover:bg-gray-100">
                  <Link href="/book">BOOK NOW</Link>
                </Button>
                <div className="flex items-center gap-2 text-orange-100">
                  <Phone className="h-5 w-5" />
                  <span className="text-lg font-medium">(213) 770-7788</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8">
                <h3 className="text-2xl font-bold mb-4">Orange County Hibachi Experts</h3>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-300" />
                    <span>Highest rated hibachi service in Orange County</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-300" />
                    <span>Covering all major cities from Irvine to Anaheim</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-300" />
                    <span>Premier choice for upscale communities</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-300" />
                    <span>Perfect for all occasions and party sizes</span>
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
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-800">Professional Orange County Hibachi Service</h2>
          <p className="text-xl text-gray-600 max-w-4xl mx-auto mb-8">
            We bring our mobile hibachi chef and grill to your Orange County location. From intimate gatherings in Newport Beach 
            to large celebrations in Irvine, our professional chefs deliver an unforgettable dining experience right at your home.
          </p>
          
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <Card className="shadow-lg border-0">
              <CardHeader className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-t-lg text-center">
                <div className="text-4xl font-bold mb-2">$59.9</div>
                <CardTitle className="text-2xl">Standard Package</CardTitle>
                <CardDescription className="text-orange-100">Per person - Complete hibachi experience</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-3">
                    <Utensils className="h-5 w-5 text-orange-500" />
                    <span>Appetizer salad with special dipping sauce</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Utensils className="h-5 w-5 text-orange-500" />
                    <span>Fresh hibachi vegetables</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Utensils className="h-5 w-5 text-orange-500" />
                    <span>Signature hibachi fried rice</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Utensils className="h-5 w-5 text-orange-500" />
                    <span>2 protein choices</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Utensils className="h-5 w-5 text-orange-500" />
                    <span>Amazing hibachi performance</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0">
              <CardHeader className="bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-t-lg text-center">
                <div className="text-3xl font-bold mb-2">Premium Custom</div>
                <CardTitle className="text-2xl">Luxury Package</CardTitle>
                <CardDescription className="text-red-100">Contact us for custom pricing</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-3">
                    <Star className="h-5 w-5 text-red-500" />
                    <span>Premium seafood choices (lobster, scallops)</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Star className="h-5 w-5 text-red-500" />
                    <span>Wagyu steak upgrade</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Star className="h-5 w-5 text-red-500" />
                    <span>Custom menu options</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Star className="h-5 w-5 text-red-500" />
                    <span>Extended performance and service time</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Star className="h-5 w-5 text-red-500" />
                    <span>Dedicated customer support</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Cities Covered */}
        <Card className="mb-16 shadow-xl border-0">
          <CardHeader className="bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-t-lg">
            <CardTitle className="text-2xl text-center">Orange County Service Cities</CardTitle>
            <CardDescription className="text-center text-orange-100 text-lg">
              We provide professional at-home hibachi service to the following Orange County cities
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {ocCities.map((city, index) => {
                const citySlug = city.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '')
                const cityHref = `/service-area/orange-county/${citySlug}`
                
                return (
                  <Link key={index} href={cityHref}>
                    <Badge variant="outline" className="text-center py-2 text-sm hover:bg-orange-50 hover:border-orange-300 cursor-pointer transition-colors w-full">
                      {city}
                    </Badge>
                  </Link>
                )
              })}
            </div>
            <div className="mt-8 text-center">
              <p className="text-gray-600 mb-4">Service covers the entire Orange County area, adding Japanese flavor to your special events.</p>
              <Button asChild variant="outline">
                <Link href="/service-area">View All Service Areas</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Contact Section */}
        <Card className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
          <CardContent className="p-8 text-center">
            <h2 className="text-3xl font-bold mb-6">Ready to Book Your Orange County Hibachi Experience?</h2>
            <p className="text-xl mb-8 opacity-90">
              Contact us to book your Orange County hibachi experience and bring an unforgettable Japanese culinary feast to your gathering!
            </p>
            
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="flex flex-col items-center">
                <Phone className="h-8 w-8 mb-2" />
                <h3 className="font-semibold mb-1">Call Now</h3>
                <p className="text-lg">(213) 770-7788</p>
              </div>
              <div className="flex flex-col items-center">
                <Mail className="h-8 w-8 mb-2" />
                <h3 className="font-semibold mb-1">Email Booking</h3>
                <p className="text-lg">realhibachiathome@gmail.com</p>
              </div>
              <div className="flex flex-col items-center">
                <MapPin className="h-8 w-8 mb-2" />
                <h3 className="font-semibold mb-1">Service Area</h3>
                <p className="text-lg">Entire Orange County</p>
              </div>
            </div>

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

