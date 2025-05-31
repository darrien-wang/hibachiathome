import Link from "next/link"

import { Button } from "@/components/ui/button"
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
    <div className="overflow-x-hidden">
      <HeroSection />
      {/* Social Proof Counter */}
      <AnimateOnScroll>
        <SocialProofCounter />
      </AnimateOnScroll>
      {/* How It Works Section */}
      <HowItWorksSection />

      {/* Package Options Section */}
      <AnimateOnScroll>
        <section className="py-16 bg-black">
          <div className="container mx-auto px-4">
            <AnimateOnScroll direction="down">
              <h2 className="text-3xl md:text-4xl font-energy font-bold text-center mb-6 fire-text-gradient">
                Our <span className="text-yellow-400">Pricing</span>
              </h2>
              <p className="text-lg text-center text-gray-300 max-w-3xl mx-auto mb-12">
                Simple, transparent pricing for an unforgettable hibachi experience
              </p>
            </AnimateOnScroll>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
              {/* Pricing Card */}
              <AnimateOnScroll direction="left">
                <div className="bg-gradient-to-br from-amber-900/40 via-orange-900/30 to-red-900/40 backdrop-blur-sm border border-orange-500/30 rounded-2xl overflow-hidden transition-all duration-500 hover:border-orange-400/50 hover:shadow-2xl hover:shadow-orange-500/20 relative group">
                  <div className="absolute top-2 right-2 z-10">
                    <span className="inline-flex items-center rounded-full border px-4 py-2 text-sm font-bold bg-gradient-to-r from-yellow-400 to-orange-400 text-black border-none shadow-lg tracking-wide">
                      PRICING
                    </span>
                  </div>

                  <div className="p-8 bg-gradient-to-br from-gray-900 via-black to-gray-800 relative">
                    {/* Fire glow overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-orange-500/5 via-transparent to-yellow-500/5 pointer-events-none"></div>

                    <div className="relative z-10">
                      <h3 className="text-3xl font-energy font-bold mb-6 fire-text-gradient">Pricing</h3>

                      {/* Main Pricing */}
                      <div className="mb-8">
                        <div className="flex items-baseline gap-2 mb-2">
                          <span className="text-4xl font-bold fire-text-gradient">$49.90</span>
                          <span className="text-gray-300 text-xl">per person</span>
                        </div>
                        <p className="text-yellow-400 text-lg font-medium mb-4">$499 Minimum for all parties</p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-orange-400">$24.90</span>
                          <span className="text-gray-300">per child 12 and under</span>
                        </div>
                      </div>

                      {/* Service Notes */}
                      <div className="space-y-4 mb-8">
                        <div className="flex items-start gap-3">
                          <span className="text-yellow-400 text-lg mt-0.5">🔥</span>
                          <span className="text-gray-200">We cook outside only.</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="text-yellow-400 text-lg mt-0.5">☔</span>
                          <span className="text-gray-200">
                            We provide services rain or shine, as long as there is a dry area for the chef to cook
                            under.
                          </span>
                        </div>
                      </div>

                      <Button
                        asChild
                        className="w-full bg-gray-800 border-2 border-orange-500 text-orange-400 hover:bg-orange-500/10 font-bold py-4 text-lg rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/30"
                      >
                        <Link href="/book">BOOK NOW</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </AnimateOnScroll>

              {/* Menu Details Card */}
              <AnimateOnScroll direction="right">
                <div className="bg-gradient-to-br from-amber-900/40 via-orange-900/30 to-red-900/40 backdrop-blur-sm border border-orange-500/30 rounded-2xl overflow-hidden transition-all duration-500 hover:border-orange-400/50 hover:shadow-2xl hover:shadow-orange-500/20 relative group">
                  <div className="absolute top-2 right-2 z-10">
                    <span className="inline-flex items-center rounded-full border px-4 py-2 text-sm font-bold bg-gradient-to-r from-blue-400 to-purple-400 text-black border-none shadow-lg tracking-wide">
                      MENU
                    </span>
                  </div>

                  <div className="p-8 bg-gradient-to-br from-gray-900 via-black to-gray-800 relative">
                    {/* Fire glow overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-orange-500/5 via-transparent to-yellow-500/5 pointer-events-none"></div>

                    <div className="relative z-10">
                      <h3 className="text-3xl font-energy font-bold mb-6 fire-text-gradient">Protein Choices</h3>

                      {/* Protein Selection */}
                      <div className="mb-6">
                        <p className="text-yellow-400 text-lg font-medium mb-4">2 Per Person</p>
                        <div className="grid grid-cols-2 gap-2 mb-4">
                          {["Chicken", "Steak", "Shrimp", "Scallops", "Salmon", "Tofu"].map((protein) => (
                            <span
                              key={protein}
                              className="text-gray-200 text-sm bg-gray-800/50 px-3 py-1 rounded-lg border border-orange-500/20"
                            >
                              {protein}
                            </span>
                          ))}
                        </div>
                        <p className="text-orange-400 text-sm mb-4">Upgrade proteins: Filet Mignon $5 · Lobster $10</p>
                      </div>

                      {/* Includes */}
                      <div className="mb-6">
                        <h4 className="text-yellow-400 font-bold mb-2">Includes</h4>
                        <p className="text-gray-200">Salad, Fried Rice, and Vegetables</p>
                      </div>

                      {/* Add-ons */}
                      <div className="space-y-2 mb-8 text-sm">
                        <div className="flex justify-between text-gray-200">
                          <span>Gyoza (12pcs)</span>
                          <span className="text-orange-400">$15</span>
                        </div>
                        <div className="flex justify-between text-gray-200">
                          <span>Edamame</span>
                          <span className="text-orange-400">$10</span>
                        </div>
                        <div className="flex justify-between text-gray-200">
                          <span>3rd Protein</span>
                          <span className="text-orange-400">$10</span>
                        </div>
                        <div className="flex justify-between text-gray-200">
                          <span>Filet Mignon</span>
                          <span className="text-orange-400">$15</span>
                        </div>
                        <div className="flex justify-between text-gray-200">
                          <span>Lobster</span>
                          <span className="text-orange-400">$20</span>
                        </div>
                        <div className="flex justify-between text-gray-200">
                          <span>Noodles</span>
                          <span className="text-orange-400">$5 per order</span>
                        </div>
                      </div>

                      <Button
                        asChild
                        className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white font-bold py-4 text-lg rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/30 hover:scale-105 border-none"
                      >
                        <Link href="/menu">VIEW FULL MENU</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </AnimateOnScroll>
            </div>

            <AnimateOnScroll direction="up" delay={200}>
              <div className="text-center mt-10">
                <Button
                  asChild
                  className="rounded-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white font-bold px-8 py-4 text-xl shadow-lg hover:shadow-xl hover:shadow-orange-500/30 hover:scale-105 transition-all duration-300 border-none"
                >
                  <Link href="/book">Get Your Free Estimate</Link>
                </Button>
              </div>
            </AnimateOnScroll>
          </div>
        </section>
      </AnimateOnScroll>

      {/* Testimonials Section */}
      <TestimonialsSection />

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

      {/* Call to Action Section */}
      <AnimateOnScroll>
        <section className="py-20 bg-gradient-to-r from-amber-600 to-orange-600">
          <div className="container mx-auto px-4 text-center">
            <AnimateOnScroll direction="down">
              <h2 className="text-3xl md:text-5xl font-serif font-bold text-white mb-6">
                Ready to Create Unforgettable Memories?
              </h2>
              <p className="text-xl text-amber-100 max-w-3xl mx-auto mb-10">
                Book your hibachi experience today and bring the excitement of Japanese cuisine directly to your home.
                Our professional chefs are ready to create an amazing show and delicious meal for you and your guests.
              </p>
            </AnimateOnScroll>

            <AnimateOnScroll direction="up" delay={200}>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Button
                  asChild
                  size="lg"
                  className="bg-white text-amber-600 hover:bg-amber-50 font-bold px-8 py-4 text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Link href="/book">Book Your Experience Now</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="border-2 border-white text-white hover:bg-white hover:text-amber-600 font-bold px-8 py-4 text-lg rounded-full transition-all duration-300 bg-white/10 backdrop-blur-sm"
                >
                  <Link href="/menu">View Our Packages</Link>
                </Button>
              </div>
            </AnimateOnScroll>

            <AnimateOnScroll direction="up" delay={400}>
              <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                <div className="text-center">
                  <div className="text-3xl font-bold text-white mb-2">500+</div>
                  <div className="text-amber-100">Happy Customers</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-white mb-2">4.9★</div>
                  <div className="text-amber-100">Average Rating</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-white mb-2">100%</div>
                  <div className="text-amber-100">Satisfaction Guarantee</div>
                </div>
              </div>
            </AnimateOnScroll>
          </div>
        </section>
      </AnimateOnScroll>
    </div>
  )
}
