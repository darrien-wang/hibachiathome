"use client"

import type React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Phone, Mail, MapPin, Clock, CheckCircle, Star, Users, Heart } from "lucide-react"
import Link from "next/link"

export default function ServiceAreaClient() {
  // 主要服务区域
  const serviceAreas = [
    {
      region: "Los Angeles",
      cities: [
        "Los Angeles", "Beverly Hills", "West Hollywood", "Santa Monica", "Venice", 
        "Culver City", "Manhattan Beach", "Hermosa Beach", "Redondo Beach", "Torrance", 
        "El Segundo", "Burbank", "Glendale", "Pasadena", "Arcadia", "Monrovia", 
        "San Gabriel", "Alhambra", "Monterey Park", "South Pasadena", "Sherman Oaks", 
        "Studio City", "North Hollywood", "Encino", "Tarzana", "Woodland Hills",
        "Inglewood", "Hawthorne", "Gardena", "Carson", "Long Beach", "Lakewood",
        "Downey", "Whittier", "Cerritos", "Norwalk", "Bellflower", "Compton"
      ],
      color: "from-amber-500 to-orange-500",
      featured: true
    },
    {
      region: "Orange County",
      cities: [
        "Irvine", "Newport Beach", "Huntington Beach", "Costa Mesa", "Fountain Valley",
        "Westminster", "Garden Grove", "Orange", "Santa Ana", "Tustin", "Laguna Beach",
        "Dana Point", "San Juan Capistrano", "Mission Viejo", "Lake Forest", "Aliso Viejo",
        "Laguna Hills", "Laguna Niguel", "Rancho Santa Margarita", "Anaheim", "Fullerton",
        "Brea", "Placentia", "Yorba Linda", "Cypress", "Los Alamitos", "Seal Beach", 
        "Buena Park", "La Palma", "Stanton", "La Habra", "Villa Park"
      ],
      color: "from-orange-500 to-red-500",
      featured: true
    },
    {
      region: "San Diego",
      cities: [
        "San Diego", "La Jolla", "Del Mar", "Encinitas", "Carlsbad", "Oceanside",
        "Vista", "Escondido", "Poway", "Rancho Bernardo", "Mira Mesa", "Scripps Ranch",
        "Mission Valley", "Hillcrest", "Balboa Park", "Point Loma", "Mission Beach",
        "Pacific Beach", "Coronado", "Chula Vista", "National City", "Imperial Beach",
        "Bonita", "Eastlake", "Otay Ranch", "Rancho San Diego"
      ],
      color: "from-blue-500 to-cyan-500",
      featured: true
    },
    {
      region: "San Bernardino",
      cities: [
        // Tier 1: Major inland empire cities
        "San Bernardino", "Rancho Cucamonga", "Ontario",
        // Tier 2: Secondary markets with good potential
        "Redlands", "Fontana", "Chino", "Chino Hills",
        // Resort destinations (always included)
        "Big Bear Lake", "Lake Arrowhead"
      ],
      color: "from-purple-500 to-blue-500",
      featured: true
    },
    {
      region: "Riverside",
      cities: [
        // Tier 1: Major riverside county cities
        "Riverside", "Corona", "Temecula",
        // Tier 2: Secondary markets with good potential
        "Moreno Valley", "Murrieta",
        // Resort/Arts destinations (always included)
        "Idyllwild"
      ],
      color: "from-green-500 to-blue-500",
      featured: true
    },
    {
      region: "Palm Springs",
      cities: [
        // Tier 1: Premium desert resort destinations
        "Palm Springs", "Palm Desert", "Rancho Mirage",
        // Tier 2: Secondary markets with good potential
        "Cathedral City", "Indian Wells", "La Quinta", "Indio", "Coachella",
        // Resort/Spa destinations (always included)
        "Desert Hot Springs"
      ],
      color: "from-yellow-500 to-orange-500",
      featured: true
    }
  ]

  const serviceFeatures = [
    {
      icon: Users,
      title: "Professional Chefs",
      description: "Certified Japanese teppanyaki chefs with years of experience"
    },
    {
      icon: Clock,
      title: "Flexible Scheduling",
      description: "Available 7 days a week, including evenings and weekends"
    },
    {
      icon: Heart,
      title: "Premium Service",
      description: "All-inclusive hibachi experience with entertainment and cooking"
    },
    {
      icon: CheckCircle,
      title: "Fully Insured",
      description: "Licensed and insured for your peace of mind"
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-gray-100 pt-20">
      {/* Hero Section */}
      <div className="hero-section bg-gradient-to-br from-stone-50 via-white to-orange-50/30 relative overflow-hidden pt-24 pb-20">
        {/* Subtle background elements */}
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-20 right-20 w-60 h-60 bg-orange-100/30 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-40 h-40 bg-amber-100/40 rounded-full blur-2xl"></div>
        </div>
        
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="mb-6">
            <div className="inline-flex items-center gap-3 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg border border-orange-100 mb-8">
              <div className="w-3 h-3 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full"></div>
              <span className="text-orange-600 font-medium">Premium Hibachi at Home Service</span>
            </div>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-gray-900">
            Our <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">Service Area</span>
          </h1>
          <p className="text-xl md:text-2xl mb-8 max-w-4xl mx-auto text-gray-600">
            Professional hibachi chef service covering Los Angeles, Orange County, San Diego, San Bernardino, Palm Springs, and Riverside areas. 
            Bringing authentic Japanese teppanyaki experience directly to your location throughout Southern California.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button asChild size="lg" className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white shadow-lg hover:shadow-xl transition-all duration-300">
              <Link href="/book">Book Your Experience</Link>
            </Button>
            <div className="flex items-center gap-2 text-gray-600 bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full border border-gray-200">
              <Phone className="h-5 w-5 text-orange-600" />
              <span className="text-lg font-medium">(213) 770-7788</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-20 bg-white">
        {/* Service Features */}
        <div className="text-center mb-20">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">
            Why Choose <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">Real Hibachi</span>
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-12">
            Professional service backed by years of experience and commitment to excellence
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {serviceFeatures.map((feature, index) => {
              const IconComponent = feature.icon
              return (
                <Card key={index} className="text-center border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                  <CardContent className="p-6">
                    <div className="bg-gradient-to-r from-orange-500 to-amber-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
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

        {/* Service Areas */}
        <div className="mb-20">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">
              Primary <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">Service Areas</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-6">
              We provide premium hibachi at home service throughout Southern California, 
              covering Los Angeles, Orange County, San Diego, San Bernardino, Palm Springs, and Riverside areas.
            </p>
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-6 max-w-2xl mx-auto">
              <p className="text-orange-700 font-medium">
                📍 Don't see your city? We serve many additional communities! 
                <br />Contact us to check availability in your specific area.
              </p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-8 mb-16">
            {serviceAreas.map((area, index) => (
              <Card key={index} className={`shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 ${area.featured ? 'ring-2 ring-orange-200' : ''}`}>
                <CardHeader className="bg-gradient-to-br from-white to-gray-50 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl font-bold text-gray-900">{area.region}</CardTitle>
                      <CardDescription className="text-gray-600 text-lg">
                        {area.cities.length} cities covered
                      </CardDescription>
                    </div>
                    {area.featured && (
                      <div className="p-2 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl">
                        <Star className="h-6 w-6 text-white fill-current" />
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-6">
                    {area.cities.map((city, cityIndex) => {
                      const citySlug = city.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '')
                      const isLosAngeles = area.region === "Los Angeles"
                      const isOrangeCounty = area.region === "Orange County"
                      const isSanDiego = area.region === "San Diego"
                      const isSanBernardino = area.region === "San Bernardino"
                      const isRiverside = area.region === "Riverside"
                      const isPalmSprings = area.region === "Palm Springs"
                      
                      if (isLosAngeles) {
                        return (
                          <Link 
                            key={cityIndex} 
                            href={`/service-area/${citySlug === 'los-angeles' ? 'los-angeles-city' : citySlug}`}
                          >
                            <Badge variant="outline" className="text-sm justify-center hover:bg-orange-50 hover:border-orange-300 cursor-pointer transition-colors w-full">
                              {city}
                            </Badge>
                          </Link>
                        )
                      }
                      
                      if (isOrangeCounty) {
                        return (
                          <Link 
                            key={cityIndex} 
                            href={`/service-area/orange-county/${citySlug}`}
                          >
                            <Badge variant="outline" className="text-sm justify-center hover:bg-orange-50 hover:border-orange-300 cursor-pointer transition-colors w-full">
                              {city}
                            </Badge>
                          </Link>
                        )
                      }
                      
                      if (isSanDiego) {
                        return (
                          <Link 
                            key={cityIndex} 
                            href={`/service-area/san-diego/${citySlug === 'san-diego' ? 'san-diego-city' : citySlug}`}
                          >
                            <Badge variant="outline" className="text-sm justify-center hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-colors w-full">
                              {city}
                            </Badge>
                          </Link>
                        )
                      }
                      
                      if (isSanBernardino) {
                        return (
                          <Link 
                            key={cityIndex} 
                            href={`/service-area/san-bernardino/${citySlug === 'san-bernardino' ? 'san-bernardino-city' : citySlug}`}
                          >
                            <Badge variant="outline" className="text-sm justify-center hover:bg-purple-50 hover:border-purple-300 cursor-pointer transition-colors w-full">
                              {city}
                            </Badge>
                          </Link>
                        )
                      }
                      
                      if (isRiverside) {
                        return (
                          <Link 
                            key={cityIndex} 
                            href={`/service-area/riverside/${citySlug === 'riverside' ? 'riverside-city' : citySlug}`}
                          >
                            <Badge variant="outline" className="text-sm justify-center hover:bg-green-50 hover:border-green-300 cursor-pointer transition-colors w-full">
                              {city}
                            </Badge>
                          </Link>
                        )
                      }
                      
                      if (isPalmSprings) {
                        return (
                          <Link 
                            key={cityIndex} 
                            href={`/service-area/palm-springs/${citySlug === 'palm-springs' ? 'palm-springs-city' : citySlug}`}
                          >
                            <Badge variant="outline" className="text-sm justify-center hover:bg-yellow-50 hover:border-yellow-300 cursor-pointer transition-colors w-full">
                              {city}
                            </Badge>
                          </Link>
                        )
                      }
                      
                      return (
                        <Badge key={cityIndex} variant="outline" className="text-sm justify-center">
                          {city}
                        </Badge>
                      )
                    })}
                  </div>
                  <div className="flex gap-3">
                    <Button asChild className="flex-1 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 shadow-md hover:shadow-lg transition-all duration-300">
                      <Link href="/book">Book in {area.region}</Link>
                    </Button>
                    <Button asChild variant="outline" className="flex-1 border-gray-200 text-gray-600 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600 transition-all duration-300">
                      <Link href={`/service-area/${area.region.toLowerCase().replace(/\s+/g, '-')}`}>Learn More</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Travel Information */}
        <Card className="mb-20 bg-gradient-to-br from-gray-50 to-stone-100 border border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl text-gray-900 flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl">
                <MapPin className="h-6 w-6 text-white" />
              </div>
              Travel & Service Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-gray-700">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2">Service Radius</h3>
                <p>We provide service throughout Southern California including LA, Orange County, San Diego, San Bernardino, Palm Springs, and Riverside. Additional travel fees may apply for distant locations.</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Minimum Requirements</h3>
                <p>$599 minimum order required. Perfect for dinner parties, birthdays, anniversaries, and special occasions.</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Booking Advance</h3>
                <p>We recommend booking at least 48 hours in advance. Same-day bookings may be available based on chef availability.</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Service Hours</h3>
                <p>Available 7 days a week from 11 AM to 10 PM. Evening time slots are most popular for dinner experiences.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card className="bg-gradient-to-br from-gray-50 to-stone-100 border border-gray-200 shadow-sm">
          <CardContent className="p-12 text-center">
            <h2 className="text-3xl font-bold mb-4 text-gray-900">
              Ready to Book Your <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">Hibachi Experience?</span>
            </h2>
            <p className="text-xl mb-10 text-gray-600 max-w-2xl mx-auto">
              Contact us today to check availability in your area and reserve your date for an unforgettable culinary experience!
            </p>
            
            <div className="grid md:grid-cols-3 gap-8 mb-10">
              <div className="flex flex-col items-center">
                <div className="p-4 bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl mb-4 shadow-lg">
                  <Phone className="h-8 w-8 text-white" />
                </div>
                <h3 className="font-semibold mb-2 text-gray-900">Call Us</h3>
                <p className="text-lg text-gray-600">(213) 770-7788</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="p-4 bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl mb-4 shadow-lg">
                  <Mail className="h-8 w-8 text-white" />
                </div>
                <h3 className="font-semibold mb-2 text-gray-900">Email Us</h3>
                <p className="text-lg text-gray-600">realhibachiathome@gmail.com</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="p-4 bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl mb-4 shadow-lg">
                  <MapPin className="h-8 w-8 text-white" />
                </div>
                <h3 className="font-semibold mb-2 text-gray-900">Service Area</h3>
                <p className="text-lg text-gray-600">Southern California</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 px-8 py-3">
                <Link href="/book">Book Online Now</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-2 border-orange-200 text-orange-600 hover:bg-orange-50 hover:border-orange-300 transition-all duration-300 px-8 py-3">
                <Link href="/menu">View Menu</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
