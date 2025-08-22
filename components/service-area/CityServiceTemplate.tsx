"use client"

import type React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Phone, Mail, MapPin, Clock, CheckCircle, Star, Users, Heart, Utensils, Calendar, Award } from "lucide-react"
import Link from "next/link"

interface CityServiceTemplateProps {
  cityName: string
  region: string
  description: string
  zipCodes?: string[]
  neighborhoods?: string[]
  popularVenues?: string[]
  cityHighlights?: string[]
  storyContent?: string
  nearbyCities?: string[]
}

export default function CityServiceTemplate({
  cityName,
  region,
  description,
  zipCodes = [],
  neighborhoods = [],
  popularVenues = [],
  cityHighlights = [],
  storyContent = "",
  nearbyCities = []
}: CityServiceTemplateProps) {
  const serviceFeatures = [
    {
      icon: Users,
      title: "Professional Japanese Chefs",
      description: `Experienced hibachi chefs serving ${cityName} with authentic teppanyaki skills`
    },
    {
      icon: Utensils,
      title: "Complete Equipment",
      description: "Professional hibachi grill and all cooking equipment provided"
    },
    {
      icon: Clock,
      title: "Flexible Scheduling",
      description: "Available 7 days a week for lunch and dinner service"
    },
    {
      icon: Award,
      title: "Premium Service",
      description: "Fully insured and licensed for your peace of mind"
    }
  ]

  const menuHighlights = [
    "Fresh Garden Salad with Ginger Dressing",
    "Hibachi Vegetables (Zucchini, Onions, Carrots, and Broccoli)",
    "Signature Hibachi Fried Rice",
    "Choice of 2 Proteins (Chicken, Steak, Shrimp, Salmon, etc.)",
    "Live Cooking Performance with Tricks"
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 pt-20">
      {/* Hero Section */}
      <div className="hero-section bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 text-white pt-12 pb-16">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="secondary" className="mb-4 text-lg px-6 py-2">
                Professional Hibachi Service in {cityName}
              </Badge>
              <h1 className="text-4xl md:text-6xl font-bold mb-6">
                Hibachi at Home in {cityName}
              </h1>
              <p className="text-xl md:text-2xl mb-6 opacity-90">
                {description}
              </p>
              <p className="text-lg mb-8 opacity-80">
                Experience authentic Japanese hibachi dining in the comfort of your {cityName} home. 
                Our professional teppanyaki chefs bring the complete restaurant experience to you, 
                complete with tricks, entertainment, and delicious food.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button asChild size="lg" className="bg-white text-orange-600 hover:bg-gray-100">
                  <Link href="/book">BOOK NOW</Link>
                </Button>
                <div className="flex items-center gap-2 text-amber-100">
                  <Phone className="h-5 w-5" />
                  <span className="text-lg font-medium">(213) 770-7788</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8">
                <h3 className="text-2xl font-bold mb-4">Why Choose Us in {cityName}?</h3>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-300" />
                    <span>Most trusted hibachi service in {cityName}</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-300" />
                    <span>Professional Japanese chef team</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-300" />
                    <span>Complete setup and cleanup included</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-300" />
                    <span>Fully licensed and insured</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">
        {/* Service Features */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-800">
            Premium Hibachi Service in {cityName}, {region}
          </h2>
          <p className="text-xl text-gray-600 max-w-4xl mx-auto mb-12">
            Our hibachi chefs bring the authentic Japanese teppanyaki experience directly to your {cityName} location. 
            Perfect for birthday parties, anniversaries, corporate events, and special celebrations.
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            {serviceFeatures.map((feature, index) => {
              const IconComponent = feature.icon
              return (
                <Card key={index} className="text-center border-0 shadow-lg hover:shadow-xl transition-shadow">
                  <CardContent className="p-6">
                    <div className="bg-gradient-to-r from-red-500 to-orange-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <IconComponent className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2 text-gray-800">{feature.title}</h3>
                    <p className="text-gray-600">{feature.description}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Menu Section */}
        <Card className="mb-16 shadow-xl border-0">
          <CardHeader className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-t-lg text-center">
            <CardTitle className="text-3xl font-bold">$59.9 Per Person</CardTitle>
            <CardDescription className="text-white/90 text-xl font-medium">
              Complete Hibachi Experience in {cityName}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid lg:grid-cols-2 gap-8">
              <div>
                <h3 className="text-2xl font-bold mb-4 text-gray-800">What's Included</h3>
                <ul className="space-y-3 mb-6">
                  {menuHighlights.map((item, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-4 text-gray-800">Service Details</h3>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-blue-500" />
                    <span>1-2 hour complete dining experience</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-blue-500" />
                    <span>Minimum 10 guests OR $599 minimum spend required</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-blue-500" />
                    <span>Service available throughout {cityName}</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Award className="h-5 w-5 text-blue-500" />
                    <span>Professional chef and equipment included</span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="text-center mt-8">
              <Button asChild size="lg" className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600">
                <Link href="/book">Book Your {cityName} Hibachi Experience</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Local Information */}
        {(neighborhoods.length > 0 || zipCodes.length > 0 || popularVenues.length > 0) && (
          <div className="grid lg:grid-cols-3 gap-8 mb-16">
            {neighborhoods.length > 0 && (
              <Card className="shadow-lg border-0">
                <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-t-lg">
                  <CardTitle className="text-xl">Popular Neighborhoods</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid gap-2">
                    {neighborhoods.map((neighborhood, index) => (
                      <Badge key={index} variant="outline" className="justify-center py-2">
                        {neighborhood}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {zipCodes.length > 0 && (
              <Card className="shadow-lg border-0">
                <CardHeader className="bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-t-lg">
                  <CardTitle className="text-xl">Service Zip Codes</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 gap-2">
                    {zipCodes.map((zip, index) => (
                      <Badge key={index} variant="outline" className="justify-center py-2">
                        {zip}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {popularVenues.length > 0 && (
              <Card className="shadow-lg border-0">
                <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-t-lg">
                  <CardTitle className="text-xl">Popular Event Venues</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-2">
                    {popularVenues.map((venue, index) => (
                      <div key={index} className="text-sm text-gray-600 border-b border-gray-100 pb-1">
                        {venue}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* City Highlights */}
        {cityHighlights.length > 0 && (
          <Card className="mb-16 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-2xl text-blue-800 text-center">
                About {cityName}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {cityHighlights.map((highlight, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-blue-500" />
                    <span className="text-blue-700">{highlight}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Hibachi Party Story & SEO Content */}
        {storyContent && (
          <Card className="mb-16 bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
            <CardHeader>
              <CardTitle className="text-2xl text-purple-800 text-center flex items-center justify-center gap-2">
                <Heart className="h-6 w-6" />
                Hibachi at Home Success Story in {cityName}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <div className="prose prose-purple max-w-none">
                <p className="text-lg text-purple-700 leading-relaxed mb-6">
                  {storyContent}
                </p>
                <div className="bg-white rounded-lg p-6 shadow-sm">
                  <h3 className="text-xl font-semibold text-purple-800 mb-4">
                    Why Choose Our Private Chef Service in {cityName}?
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4 text-left">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Professional <strong>hibachi at home</strong> experience</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Perfect for <strong>private birthday hibachi party</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Expert <strong>private chef</strong> service</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Complete <strong>hibachi catering</strong> setup</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Authentic <strong>Japanese teppanyaki</strong> cooking</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Unforgettable <strong>hibachi party</strong> entertainment</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Nearby Cities */}
        {nearbyCities.length > 0 && (
          <Card className="mb-16 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
            <CardHeader>
              <CardTitle className="text-2xl text-green-800 text-center">
                We Also Serve Nearby Cities
              </CardTitle>
              <CardDescription className="text-center text-green-600">
                Bringing hibachi at home experience to the greater {cityName} area
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {nearbyCities.map((nearbyCity, index) => {
                  const citySlug = nearbyCity.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '')
                  
                  // Determine correct path based on region and city
                  let cityHref = `/service-area/${citySlug === 'los-angeles' ? 'los-angeles-city' : citySlug}`
                  
                  // Orange County cities that exist under /service-area/orange-county/
                  const ocCities = [
                    'irvine', 'newport-beach', 'huntington-beach', 'costa-mesa', 'anaheim', 'fullerton',
                    'orange', 'santa-ana', 'tustin', 'mission-viejo', 'laguna-beach', 'dana-point',
                    'dove-canyon', 'fountain-valley', 'westminster', 'garden-grove', 'san-juan-capistrano',
                    'lake-forest', 'aliso-viejo', 'laguna-hills', 'laguna-niguel', 'rancho-santa-margarita',
                    'brea', 'placentia', 'yorba-linda', 'cypress', 'los-alamitos', 'seal-beach',
                    'buena-park', 'la-palma', 'stanton', 'la-habra', 'villa-park'
                  ]
                  
                  // San Diego cities that exist under /service-area/san-diego/
                  const sdCities = [
                    'san-diego-city', 'la-jolla', 'del-mar', 'encinitas', 'carlsbad', 'oceanside',
                    'vista', 'escondido', 'poway', 'coronado', 'imperial-beach', 'chula-vista',
                    'national-city', 'bonita', 'rancho-bernardo', 'mira-mesa', 'scripps-ranch',
                    'mission-valley', 'hillcrest', 'point-loma', 'mission-beach', 'pacific-beach',
                    'balboa-park', 'eastlake', 'otay-ranch', 'rancho-san-diego', 'el-cajon'
                  ]
                  
                  if (ocCities.includes(citySlug)) {
                    cityHref = `/service-area/orange-county/${citySlug}`
                  } else if (sdCities.includes(citySlug) || (citySlug === 'san-diego' && sdCities.includes('san-diego-city'))) {
                    cityHref = `/service-area/san-diego/${citySlug === 'san-diego' ? 'san-diego-city' : citySlug}`
                  }
                  
                  return (
                    <Link 
                      key={index} 
                      href={cityHref}
                    >
                      <Badge 
                        variant="outline" 
                        className="w-full justify-center py-2 hover:bg-green-100 hover:border-green-400 cursor-pointer transition-colors"
                      >
                        {nearbyCity}
                      </Badge>
                    </Link>
                  )
                })}
              </div>
              <div className="mt-6 text-center">
                <p className="text-green-700 text-sm">
                  Looking for <strong>private chef</strong> service in a different area? 
                  <Link href="/service-area" className="text-green-600 hover:text-green-800 underline ml-1">
                    View all service areas
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact Section */}
        <Card className="bg-gradient-to-r from-red-500 to-orange-500 text-white">
          <CardContent className="p-8 text-center">
            <h2 className="text-3xl font-bold mb-6">Ready to Book Your {cityName} Hibachi Party?</h2>
            <p className="text-xl mb-8 opacity-90">
              Contact us today to bring an unforgettable hibachi experience to your {cityName} location!
            </p>
            
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="flex flex-col items-center">
                <Phone className="h-8 w-8 mb-2" />
                <h3 className="font-semibold mb-1">Call to Book</h3>
                <p className="text-lg">(213) 770-7788</p>
              </div>
              <div className="flex flex-col items-center">
                <Mail className="h-8 w-8 mb-2" />
                <h3 className="font-semibold mb-1">Email Us</h3>
                <p className="text-lg">realhibachiathome@gmail.com</p>
              </div>
              <div className="flex flex-col items-center">
                <Calendar className="h-8 w-8 mb-2" />
                <h3 className="font-semibold mb-1">Service Hours</h3>
                <p className="text-lg">Daily 11AM-10PM</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-white text-orange-600 hover:bg-gray-100">
                <Link href="/book">Book Online Now</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white text-white bg-transparent hover:bg-white hover:text-orange-600">
                <Link href="/menu">View Full Menu</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
