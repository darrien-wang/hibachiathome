"use client"

import type React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Phone, Mail, MapPin, Clock, CheckCircle, Star, Users, Heart, Utensils, Calendar } from "lucide-react"
import Link from "next/link"

export default function LosAngelesServiceClient() {
  const laCities = [
    "Los Angeles", "Beverly Hills", "West Hollywood", "Santa Monica", "Venice", 
    "Culver City", "Manhattan Beach", "Hermosa Beach", "Redondo Beach", "Torrance", 
    "El Segundo", "Burbank", "Glendale", "Pasadena", "Arcadia", "Monrovia", 
    "San Gabriel", "Alhambra", "Monterey Park", "South Pasadena", "Sherman Oaks", 
    "Studio City", "North Hollywood", "Encino", "Tarzana", "Woodland Hills",
    "Inglewood", "Hawthorne", "Gardena", "Carson", "Long Beach", "Lakewood",
    "Downey", "Whittier", "Cerritos", "Norwalk", "Bellflower", "Compton"
  ]

  const serviceFeatures = [
    {
      icon: Users,
      title: "Professional Hibachi Chefs",
      description: "Experienced teppanyaki chefs providing authentic Japanese dining experience in Los Angeles area"
    },
    {
      icon: Utensils,
      title: "Complete Equipment Service",
      description: "We provide all hibachi equipment, you only need to prepare tables, chairs, and utensils"
    },
    {
      icon: Clock,
      title: "Flexible Booking Times",
      description: "Available 7 days a week, dinner time slots are most popular"
    },
    {
      icon: Heart,
      title: "Worry-Free Experience",
      description: "From setup to cleanup, we handle everything so you can enjoy your party"
    }
  ]

  const pricingOptions = [
    {
      title: "Standard Package",
      price: "$59.9",
      description: "Per person price, includes appetizers, main courses, sides, and hibachi show",
      features: ["Salad + Dipping Sauce", "Hibachi Vegetables", "Fried Rice", "2 Protein Choices", "Live Cooking Performance"]
    },
    {
      title: "Premium Package",
      price: "Contact for Pricing",
      description: "Custom menu with premium seafood and beef selections",
      features: ["Lobster Tail", "Wagyu Steak", "Scallops", "Custom Sides", "Extended Performance Time"]
    }
  ]

  return (
    <div className="page-container min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
      {/* Hero Section */}
      <div className="hero-section bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 text-white pt-20 pb-16">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="secondary" className="mb-4 text-lg px-6 py-2">
                Professional Service in Los Angeles Area
              </Badge>
              <h1 className="text-4xl md:text-6xl font-bold mb-6">Hibachi at Home in Los Angeles</h1>
              <p className="text-xl md:text-2xl mb-8 opacity-90">
                Experience hibachi at home in Los Angeles, CA! We bring our hibachi grill and private chef to you.
              </p>
              <p className="text-lg mb-8 opacity-80">
                Your personal chef will prepare a multi-course hibachi dinner and engage guests with classic Hibachi stunts. 
                Our chefs are masters at tricks with their spatulas, juggling, the viral egg toss and of course, the onion volcano.
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
                <h3 className="text-2xl font-bold mb-4">Why Choose Us?</h3>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-300" />
                    <span>Most trusted hibachi service in Los Angeles area</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-300" />
                    <span>Professional Hibachi Chef team</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-300" />
                    <span>Complete equipment and ingredients included</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-300" />
                    <span>Fully insured and licensed</span>
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
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-800">Hibachi Service in Los Angeles Area</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-12">
            We provide professional at-home hibachi service for Los Angeles and surrounding areas, bringing authentic Japanese dining experience to your home.
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

        {/* Hibachi Catering Los Angeles Section */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-800">Hibachi Catering Los Angeles</h2>
            <p className="text-xl text-gray-600 max-w-4xl mx-auto">
              We bring our mobile hibachi chef and grill to your backyard. All you need to do is set up tables and chairs 
              and provide plates and utensils for your party. Each person gets a side salad, hibachi vegetables, fried rice, 
              and two proteins of choice.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 mb-12">
            {pricingOptions.map((option, index) => (
              <Card key={index} className="shadow-xl border-0">
                <CardHeader className="bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-t-lg text-center">
                  <CardTitle className="text-3xl font-bold">{option.price}</CardTitle>
                  <CardDescription className="text-white/90 text-xl font-medium">
                    {option.title}
                  </CardDescription>
                  <p className="text-white/80">{option.description}</p>
                </CardHeader>
                <CardContent className="p-8">
                  <ul className="space-y-3 mb-6">
                    {option.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="w-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600">
                    <Link href="/book">Choose This Package</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Cities Covered */}
        <Card className="mb-16 shadow-xl border-0">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
            <CardTitle className="text-2xl text-center">Los Angeles Area Service Cities</CardTitle>
            <CardDescription className="text-center text-blue-100 text-lg">
              We provide professional at-home hibachi service to the following cities
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {laCities.map((city, index) => (
                <Badge key={index} variant="outline" className="text-center py-2 text-sm hover:bg-orange-50 transition-colors">
                  {city}
                </Badge>
              ))}
            </div>
            <div className="mt-8 text-center">
              <p className="text-gray-600 mb-4">Don't see your city? Our service area is constantly expanding.</p>
              <Button asChild variant="outline">
                <Link href="/service-area">View Complete Service Area</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Contact Section */}
        <Card className="bg-gradient-to-r from-red-500 to-orange-500 text-white">
          <CardContent className="p-8 text-center">
            <h2 className="text-3xl font-bold mb-6">Ready to Book Your Los Angeles Hibachi Experience?</h2>
            <p className="text-xl mb-8 opacity-90">
              Contact us to book your Los Angeles hibachi experience and let us bring you an unforgettable party!
            </p>
            
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="flex flex-col items-center">
                <Phone className="h-8 w-8 mb-2" />
                <h3 className="font-semibold mb-1">Call to Book</h3>
                <p className="text-lg">(213) 770-7788</p>
              </div>
              <div className="flex flex-col items-center">
                <Mail className="h-8 w-8 mb-2" />
                <h3 className="font-semibold mb-1">Email Inquiry</h3>
                <p className="text-lg">realhibachiathome@gmail.com</p>
              </div>
              <div className="flex flex-col items-center">
                <Calendar className="h-8 w-8 mb-2" />
                <h3 className="font-semibold mb-1">Business Hours</h3>
                <p className="text-lg">Mon-Sun 11AM-10PM</p>
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

