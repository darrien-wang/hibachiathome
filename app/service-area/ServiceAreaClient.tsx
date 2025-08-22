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
        "San Bernardino", "Redlands", "Fontana", "Rialto", "Highland", "Loma Linda",
        "Colton", "Grand Terrace", "Upland", "Rancho Cucamonga", "Ontario", "Chino",
        "Chino Hills", "Montclair", "Claremont", "Pomona", "La Verne", "Crestline",
        "Lake Arrowhead", "Big Bear Lake", "Running Springs", "Yucaipa", "Calimesa"
      ],
      color: "from-purple-500 to-blue-500",
      featured: true
    },
    {
      region: "Palm Springs",
      cities: [
        "Palm Springs", "Cathedral City", "Rancho Mirage", "Palm Desert", "Indian Wells",
        "La Quinta", "Indio", "Coachella", "Desert Hot Springs", "Thousand Palms",
        "Palm Canyon", "Sky Valley", "Cabazon", "Whitewater", "Snow Creek",
        "Garnet", "Idyllwild", "Mountain Center"
      ],
      color: "from-yellow-500 to-orange-500",
      featured: false
    },
    {
      region: "Riverside",
      cities: [
        "Riverside", "Moreno Valley", "Corona", "Murrieta", "Temecula", "Hemet",
        "San Jacinto", "Perris", "Lake Elsinore", "Wildomar", "Menifee", "Beaumont",
        "Banning", "Desert Center", "Cabazon", "Cherry Valley", "Anza", "Idyllwild"
      ],
      color: "from-green-500 to-blue-500",
      featured: false
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
    <div className="page-container min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
      {/* Hero Section */}
      <div className="hero-section bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 text-white pt-20 pb-16">
        <div className="container mx-auto px-4 text-center">
          <Badge variant="secondary" className="mb-4 text-lg px-6 py-2">
            Premium Hibachi at Home Service
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">Our Service Area</h1>
          <p className="text-xl md:text-2xl mb-8 max-w-4xl mx-auto">
            Professional hibachi chef service covering Los Angeles, Orange County, San Diego, San Bernardino, Palm Springs, and Riverside areas. 
            Bringing authentic Japanese teppanyaki experience directly to your location throughout Southern California.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button asChild size="lg" className="bg-white text-orange-600 hover:bg-gray-100">
              <Link href="/book">Book Your Experience</Link>
            </Button>
            <div className="flex items-center gap-2 text-amber-100">
              <Phone className="h-5 w-5" />
              <span className="text-lg font-medium">(213) 770-7788</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">
        {/* Service Features */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-8 text-gray-800">Why Choose Real Hibachi</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {serviceFeatures.map((feature, index) => {
              const IconComponent = feature.icon
              return (
                <Card key={index} className="text-center border-0 shadow-lg">
                  <CardContent className="p-6">
                    <div className="bg-gradient-to-r from-amber-500 to-orange-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
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
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-800">Areas We Serve</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              We provide premium hibachi at home service throughout Southern California, 
              covering Los Angeles, Orange County, San Diego, San Bernardino, Palm Springs, and Riverside areas.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-8 mb-12">
            {serviceAreas.map((area, index) => (
              <Card key={index} className={`shadow-xl border-0 ${area.featured ? 'ring-2 ring-orange-500' : ''}`}>
                <CardHeader className={`bg-gradient-to-r ${area.color} text-white rounded-t-lg`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl font-bold">{area.region}</CardTitle>
                      <CardDescription className="text-white/90 text-lg">
                        {area.cities.length} cities covered
                      </CardDescription>
                    </div>
                    {area.featured && (
                      <Star className="h-8 w-8 text-yellow-300 fill-current" />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-6">
                    {area.cities.map((city, cityIndex) => (
                      <Badge key={cityIndex} variant="outline" className="text-sm justify-center">
                        {city}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button asChild className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                      <Link href="/book">Book in {area.region}</Link>
                    </Button>
                    <Button asChild variant="outline" className="flex-1">
                      <Link href={`/service-area/${area.region.toLowerCase().replace(/\s+/g, '-')}`}>Learn More</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Travel Information */}
        <Card className="mb-16 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-2xl text-blue-800 flex items-center gap-2">
              <MapPin className="h-6 w-6" />
              Travel & Service Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-blue-700">
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
        <Card className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
          <CardContent className="p-8 text-center">
            <h2 className="text-3xl font-bold mb-6">Ready to Book Your Hibachi Experience?</h2>
            <p className="text-xl mb-8 opacity-90">
              Contact us today to check availability in your area and reserve your date!
            </p>
            
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="flex flex-col items-center">
                <Phone className="h-8 w-8 mb-2" />
                <h3 className="font-semibold mb-1">Call Us</h3>
                <p className="text-lg">(213) 770-7788</p>
              </div>
              <div className="flex flex-col items-center">
                <Mail className="h-8 w-8 mb-2" />
                <h3 className="font-semibold mb-1">Email Us</h3>
                <p className="text-lg">realhibachiathome@gmail.com</p>
              </div>
              <div className="flex flex-col items-center">
                <MapPin className="h-8 w-8 mb-2" />
                <h3 className="font-semibold mb-1">Service Area</h3>
                <p className="text-lg">Southern California</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-white text-orange-600 hover:bg-gray-100">
                <Link href="/book">Book Online Now</Link>
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
