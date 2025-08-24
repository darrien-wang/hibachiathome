"use client"

import type React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Phone, Mail, MapPin, Clock, CheckCircle, Star, Users, Heart, Utensils, Calendar } from "lucide-react"
import Link from "next/link"

export default function SanBernardinoServiceClient() {
  const sanBernardinoCities = [
    "San Bernardino", "Redlands", "Fontana", "Rialto", "Highland", "Loma Linda",
    "Colton", "Grand Terrace", "Upland", "Rancho Cucamonga", "Ontario", "Chino",
    "Chino Hills", "Montclair", "Claremont", "Pomona", "La Verne", "Crestline",
    "Lake Arrowhead", "Big Bear Lake", "Running Springs", "Yucaipa", "Calimesa"
  ]

  return (
    <div className="page-container min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Hero Section */}
      <div className="hero-section bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white pt-20 pb-16">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="secondary" className="mb-4 text-lg px-6 py-2">
                Professional Service in San Bernardino County
              </Badge>
              <h1 className="text-4xl md:text-6xl font-bold mb-6">Hibachi at Home in San Bernardino</h1>
              <p className="text-xl md:text-2xl mb-8 opacity-90">
                Experience hibachi at home in San Bernardino and the mountain region! Serving Redlands, Fontana, Highland, and surrounding communities.
              </p>
              <p className="text-lg mb-8 opacity-80">
                Bringing authentic Japanese teppanyaki experience to San Bernardino County's mountain communities and family neighborhoods.
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
                <h3 className="text-2xl font-bold mb-4">San Bernardino County Hibachi Service</h3>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-blue-300" />
                    <span>Professional hibachi chefs</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-blue-300" />
                    <span>All equipment provided</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-blue-300" />
                    <span>Mountain region specialists</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-blue-300" />
                    <span>Family-friendly entertainment</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Service Area Cities */}
      <div className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">San Bernardino County Cities We Serve</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Professional hibachi at home service throughout San Bernardino County, from mountain communities to valley cities.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-12">
            {sanBernardinoCities.map((city) => {
              // Create city mapping for links - includes cities with dedicated pages
              const cityLinkMap: { [key: string]: string } = {
                "San Bernardino": "/service-area/san-bernardino/san-bernardino-city",
                "Redlands": "/service-area/san-bernardino/redlands",
                "Fontana": "/service-area/san-bernardino/fontana",
                "Rialto": "/service-area/san-bernardino/rialto",
                "Highland": "/service-area/san-bernardino/highland",
                "Loma Linda": "/service-area/san-bernardino/loma-linda",
                "Colton": "/service-area/san-bernardino/colton",
                "Grand Terrace": "/service-area/san-bernardino/grand-terrace",
                "Upland": "/service-area/san-bernardino/upland",
                "Rancho Cucamonga": "/service-area/san-bernardino/rancho-cucamonga",
                "Ontario": "/service-area/san-bernardino/ontario",
                "Chino": "/service-area/san-bernardino/chino",
                "Chino Hills": "/service-area/san-bernardino/chino-hills",
                "Montclair": "/service-area/san-bernardino/montclair",
                "Claremont": "/service-area/san-bernardino/claremont",
                "Pomona": "/service-area/san-bernardino/pomona",
                "La Verne": "/service-area/san-bernardino/la-verne",
                "Crestline": "/service-area/san-bernardino/crestline",
                "Lake Arrowhead": "/service-area/san-bernardino/lake-arrowhead",
                "Big Bear Lake": "/service-area/san-bernardino/big-bear-lake",
                "Running Springs": "/service-area/san-bernardino/running-springs",
                "Yucaipa": "/service-area/san-bernardino/yucaipa",
                "Calimesa": "/service-area/san-bernardino/calimesa",
                "Victorville": "/service-area/san-bernardino/victorville",
                "Hesperia": "/service-area/san-bernardino/hesperia",
                "Apple Valley": "/service-area/san-bernardino/apple-valley"
              }
              
              const cityLink = cityLinkMap[city]
              
              if (cityLink) {
                return (
                  <Link key={city} href={cityLink}>
                    <Badge variant="outline" className="text-sm justify-center hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-colors w-full">
                      {city}
                    </Badge>
                  </Link>
                )
              }
              
              return (
                <div key={city} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <MapPin className="h-4 w-4 text-blue-600" />
                  <span className="text-gray-800">{city}</span>
                </div>
              )
            })}
          </div>

          <div className="text-center">
            <p className="text-gray-600 mb-4">Don't see your city? We may still serve your area!</p>
            <Button asChild variant="outline" size="lg">
              <Link href="/book">Check Availability</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Choose Real Hibachi in San Bernardino?</h2>
            <p className="text-lg text-gray-600">Perfect for mountain retreats, family gatherings, and special celebrations</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="text-center">
              <CardHeader>
                <Users className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <CardTitle>Perfect for Mountain Communities</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Specialized service for San Bernardino's unique mountain communities and family neighborhoods.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <Utensils className="h-12 w-12 text-purple-600 mx-auto mb-4" />
                <CardTitle>Authentic Teppanyaki Experience</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Traditional Japanese hibachi cooking techniques with premium ingredients and entertaining presentation.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <Heart className="h-12 w-12 text-pink-600 mx-auto mb-4" />
                <CardTitle>Family-Friendly Entertainment</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Safe, engaging entertainment perfect for all ages in San Bernardino County family settings.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">San Bernardino Hibachi Pricing</h2>
            <p className="text-lg text-gray-600">Transparent, flat-rate pricing for all San Bernardino County locations</p>
          </div>

          <div className="max-w-2xl mx-auto">
            <Card className="text-center p-8">
              <CardHeader>
                <div className="text-5xl font-bold text-blue-600 mb-2">$59.9</div>
                <CardTitle className="text-2xl">Per Person</CardTitle>
                <CardDescription className="text-lg">All-inclusive hibachi experience</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>Professional hibachi chef</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>All cooking equipment included</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>Premium ingredients provided</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>Entertainment & cooking show</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>Travel to San Bernardino County included</span>
                </div>
                <Button asChild size="lg" className="w-full mt-6">
                  <Link href="/book">Book Your San Bernardino Hibachi Experience</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Contact Section */}
      <div className="py-16 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-8">Ready to Book Your San Bernardino Hibachi Experience?</h2>
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <div className="flex items-center gap-3">
              <Phone className="h-6 w-6" />
              <span className="text-xl">(213) 770-7788</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-6 w-6" />
              <span className="text-xl">realhibachiathome@gmail.com</span>
            </div>
          </div>
          <div className="mt-8">
            <Button asChild size="lg" className="bg-white text-blue-600 hover:bg-gray-100">
              <Link href="/book">BOOK NOW</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
