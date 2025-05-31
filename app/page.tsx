import Link from "next/link"
import type React from "react"

import { Button } from "@/components/ui/button"
import { useState, useEffect, useRef } from "react"
import { Star } from "lucide-react"
import { getSortedHeroImages, carouselConfig } from "@/config/hero-images"
import SocialProofCounter from "@/components/social-proof-counter"
import { AnimateOnScroll } from "@/components/animate-on-scroll"
import HeroSection from "@/components/hero-section"
import TestimonialsSection from "@/components/testimonials-section"
import HowItWorksSection from "@/components/how-it-works-section"

// Testimonial data with ratings
const testimonials = [
  {
    name: "Sarah M.",
    text: "The hibachi experience was amazing! Our chef was entertaining and the food was delicious. Perfect for my daughter's birthday party!",
    location: "Boston, MA",
    rating: 5,
    date: "2 months ago",
  },
  {
    name: "Michael T.",
    text: "We booked Real Hibachi for our anniversary and it exceeded all expectations. The convenience of having restaurant-quality hibachi at home is unbeatable.",
    location: "Chicago, IL",
    rating: 5,
    date: "3 weeks ago",
  },
  {
    name: "Jennifer L.",
    text: "Our family gathering was transformed into an unforgettable event. The chef was professional, friendly, and put on an amazing show!",
    location: "Atlanta, GA",
    rating: 5,
    date: "1 month ago",
  },
  {
    name: "David W.",
    text: "The perfect solution for our office party. Everyone was impressed with both the performance and the delicious food. Will definitely book again!",
    location: "Seattle, WA",
    rating: 5,
    date: "2 weeks ago",
  },
]

export default function Home() {
  return (
    <div>
      <HeroSection />
      {/* Social Proof Counter */}
      <AnimateOnScroll>
        <SocialProofCounter />
      </AnimateOnScroll>
      {/* Testimonials Section */}
      <TestimonialsSection />
      {/* How It Works Section */}
      <HowItWorksSection />

      {/* Food Preparation Video Section */}
      <AnimateOnScroll>
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <AnimateOnScroll direction="down">
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-center mb-6">
                When Our Fire Gets Too Real
              </h2>
              <p className="text-lg text-center text-gray-600 max-w-3xl mx-auto mb-10">
                Sometimes our hibachi fire is so authentic, even the fire department wants to join the party!
              </p>
            </AnimateOnScroll>

            <AnimateOnScroll>
              <div className="max-w-2xl mx-auto rounded-xl overflow-hidden shadow-2xl">
                <div className="relative pb-[177.78%] h-0">
                  <video
                    className="absolute top-0 left-0 w-full h-full object-cover"
                    controls
                    autoPlay
                    muted
                    loop
                    poster="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hero/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20250514132251-CecaVfadScFYbfD1eg3HcM8jTxxgzi.png"
                  >
                    <source
                      src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/video/realhibachi%20real%20fire-DMEwPxa4BNviYf8qhGyapmtJ21SvvS.mp4"
                      type="video/mp4"
                    />
                    Your browser does not support the video tag.
                  </video>
                </div>
              </div>
            </AnimateOnScroll>

            <div className="mt-8 text-center">
              <p className="text-amber-600 font-medium">
                Our hibachi fire is so real, sometimes we get unexpected guests! 🚒
              </p>
              <p className="text-gray-600 text-sm mt-2">
                Don't worry - our chefs are trained professionals who know how to handle the heat safely.
              </p>
            </div>
          </div>
        </section>
      </AnimateOnScroll>

      {/* Customer Atmosphere Video Section */}
      <AnimateOnScroll>
        <section className="py-16 bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="container mx-auto px-4">
            <AnimateOnScroll direction="down">
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-center mb-6">
                Experience the <span className="text-primary">Atmosphere</span>
              </h2>
              <p className="text-lg text-center text-gray-600 max-w-3xl mx-auto mb-10">
                See how our hibachi experience transforms your home into an exciting dining venue
              </p>
            </AnimateOnScroll>

            <AnimateOnScroll>
              <div className="max-w-4xl mx-auto rounded-xl overflow-hidden shadow-2xl">
                <div className="relative pb-[56.25%] h-0">
                  <video
                    className="absolute top-0 left-0 w-full h-full object-cover"
                    controls
                    autoPlay
                    muted
                    loop
                    poster="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hero/customer-atmosphere-poster-Hs7ixFQesPB2wRPyaCJabQ5nGIPH4V.jpg"
                  >
                    <source
                      src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hero/30b01ba0204ff67ea8338ece25c7ae82_raw-2OQNVBAofaEcT6HTpYfBzc29S6JuSE.mp4"
                      type="video/mp4"
                    />
                    Your browser does not support the video tag.
                  </video>
                </div>
              </div>
            </AnimateOnScroll>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <AnimateOnScroll delay={100} direction="up">
                <div className="bg-white p-6 rounded-lg shadow-md text-center">
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-amber-600 text-xl">🎉</span>
                  </div>
                  <h3 className="font-bold text-lg mb-2">Lively Atmosphere</h3>
                  <p className="text-gray-600">
                    Experience the excitement and energy of a hibachi restaurant in your own home.
                  </p>
                </div>
              </AnimateOnScroll>

              <AnimateOnScroll delay={200} direction="up">
                <div className="bg-white p-6 rounded-lg shadow-md text-center">
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-amber-600 text-xl">👨‍👩‍👧‍👦</span>
                  </div>
                  <h3 className="font-bold text-lg mb-2">Family Friendly</h3>
                  <p className="text-gray-600">
                    Perfect entertainment for guests of all ages, creating memorable experiences.
                  </p>
                </div>
              </AnimateOnScroll>

              <AnimateOnScroll delay={300} direction="up">
                <div className="bg-white p-6 rounded-lg shadow-md text-center">
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-amber-600 text-xl">🔥</span>
                  </div>
                  <h3 className="font-bold text-lg mb-2">Spectacular Show</h3>
                  <p className="text-gray-600">
                    Watch as our skilled chefs perform impressive cooking techniques and fire tricks.
                  </p>
                </div>
              </AnimateOnScroll>
            </div>
          </div>
        </section>
      </AnimateOnScroll>

      {/* Package Options Section */}
      <AnimateOnScroll>
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <AnimateOnScroll direction="down">
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-center mb-6">
                Our Popular <span className="text-primary">Packages</span>
              </h2>
              <p className="text-lg text-center text-gray-600 max-w-3xl mx-auto mb-12">
                Choose from our carefully crafted packages designed to provide the perfect hibachi experience for any
                occasion
              </p>
            </AnimateOnScroll>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {/* Basic Package Card */}
              <AnimateOnScroll direction="left">
                <div className="border rounded-lg overflow-hidden transition-all relative hover:shadow-lg border-amber-300/50 hover:border-amber-300">
                  <div className="absolute top-2 right-2 z-10">
                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 border-amber-200">
                      Most Popular
                    </span>
                  </div>
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/Chicken-and-Beef-Hibachi-Catering-LA-itQYZOc95RTr9yWdNJOr1NiXsBBIBu.jpg"
                      alt="Basic Package"
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold mb-2">Basic Package</h3>
                    <div className="mb-4">
                      <p className="text-lg font-semibold text-amber-600">
                        <span className="text-gray-500 text-sm line-through mr-2">$70</span>
                        $59.9
                        <span className="text-sm font-normal"> per person</span>
                      </p>
                      <p className="text-xs text-gray-600">($599 minimum)</p>
                    </div>
                    <ul className="space-y-1 mb-6 text-sm">
                      <li className="flex items-start">
                        <span className="text-amber-500 mr-2">•</span>
                        <span>2 proteins of your choice</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-amber-500 mr-2">•</span>
                        <span>Fried rice & vegetables</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-amber-500 mr-2">•</span>
                        <span>Chef performance included</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-amber-500 mr-2">•</span>
                        <span>Perfect for intimate gatherings</span>
                      </li>
                    </ul>
                    <Button asChild className="w-full bg-amber-500 hover:bg-amber-600">
                      <Link href="/book">Book Now</Link>
                    </Button>
                  </div>
                </div>
              </AnimateOnScroll>

              {/* Buffet Package Card */}
              <AnimateOnScroll direction="right">
                <div className="border rounded-lg overflow-hidden transition-all relative hover:shadow-lg">
                  <div className="absolute top-2 right-2 z-10">
                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 border-blue-200">
                      Self-Service
                    </span>
                  </div>
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/filetchickenshrimp-Hibachi-Catering-LA-s2QYxFQesPB2wRPyaCJabQ5nGIPH4V.jpg"
                      alt="Buffet Package"
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold mb-2">Buffet Package</h3>
                    <div className="mb-4">
                      <p className="text-lg font-semibold text-amber-600">
                        <span className="text-gray-500 text-sm line-through mr-2">$60</span>
                        $49.9
                        <span className="text-sm font-normal"> per person</span>
                      </p>
                      <p className="text-xs text-gray-600">($998 minimum)</p>
                    </div>
                    <ul className="space-y-1 mb-6 text-sm">
                      <li className="flex items-start">
                        <span className="text-amber-500 mr-2">•</span>
                        <span>Self-service buffet style</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-amber-500 mr-2">•</span>
                        <span>Fixed menu (chicken, shrimp, beef)</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-amber-500 mr-2">•</span>
                        <span>Fried rice & vegetables</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-amber-500 mr-2">•</span>
                        <span>Ideal for larger groups (20+ people)</span>
                      </li>
                    </ul>
                    <Button asChild className="w-full bg-amber-500 hover:bg-amber-600">
                      <Link href="/book">Book Now</Link>
                    </Button>
                  </div>
                </div>
              </AnimateOnScroll>
            </div>

            <AnimateOnScroll direction="up" delay={200}>
              <div className="text-center mt-10">
                <Button
                  asChild
                  variant="outline"
                  className="rounded-full border-2 border-amber-500 text-amber-600 hover:bg-amber-50"
                >
                  <Link href="/menu">View All Packages</Link>
                </Button>
              </div>
            </AnimateOnScroll>
          </div>
        </section>
      </AnimateOnScroll>
    </div>
  )
}
