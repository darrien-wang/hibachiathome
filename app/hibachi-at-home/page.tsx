"use client"

import { useRouter } from "next/navigation"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageSquare, Star, MapPin } from "lucide-react"
import { siteConfig } from "@/config/site"
import { AnimateOnScroll } from "@/components/animate-on-scroll"
import HeroSection from "@/components/hero-section"
import TestimonialsSection from "@/components/testimonials-section"
import SocialProofCounter from "@/components/social-proof-counter"

// FAQ data
const faqs = [
  {
    question: "Do I need to prepare anything?",
    answer: "No! We bring the grill, table, and all ingredients. You just provide the space and guests.",
  },
  {
    question: "Is cleanup included?",
    answer: "Yes. We leave your space as clean as it was. Complete setup and cleanup included.",
  },
  {
    question: "Can you cook for kids or vegetarians?",
    answer: "Of course! Let us know dietary restrictions and we'll adjust the menu accordingly.",
  },
  {
    question: "How do I pay?",
    answer: "Zelle, Venmo, or cash. $100 deposit to lock your date, remaining balance due day of service.",
  },
  {
    question: "What if it rains?",
    answer: "You provide cover (tent/canopy). 48-hour notice required for weather cancellations with full refund.",
  },
  {
    question: "Can I cancel or reschedule?",
    answer: "Yes! Cancel up to 48 hours before for full refund. Reschedule anytime with 24-hour notice.",
  },
]

// Service features data
const serviceFeatures = [
  {
    icon: "🥢",
    title: "What's Included",
    description: "Private chef, grill, full setup, cleanup. You host, we cook.",
  },
  {
    icon: "🍱",
    title: "What You Eat",
    description: "Fried rice, salad, veggies, and 2 proteins per guest. Add lobster or filet upgrades!",
  },
  {
    icon: "🔥",
    title: "What to Expect",
    description: "Live hibachi show with fire tricks, food tossing, and crowd interaction.",
  },
  {
    icon: "⏱️",
    title: "Duration",
    description: "~1.5 to 2 hours depending on guest count and menu.",
  },
  {
    icon: "👪",
    title: "Minimum Order",
    description: "$599 minimum order required. Perfect for dinner parties, birthdays, anniversaries, and special occasions.",
  },
  {
    icon: "🪑",
    title: "Optional Add-ons",
    description: "We offer table, chair & utensil rentals — or you're welcome to use your own!",
  },
]

// Customer reviews
const reviews = [
  {
    name: "Linda",
    location: "NY",
    rating: 5,
    text: "The best experience we've had at home. Fun, delicious, and zero cleanup.",
  },
  {
    name: "Michael",
    location: "LA",
    rating: 5,
    text: "Our kids loved the fire show and the food was restaurant quality. Highly recommend!",
  },
  {
    name: "Sarah",
    location: "Chicago",
    rating: 5,
    text: "Perfect for our anniversary. The chef was entertaining and professional.",
  },
]

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

// 视频加载超时组件
function TimeoutVideo({ src, poster, ...props }: { src: string; poster?: string; [key: string]: any }) {
  const [showVideo, setShowVideo] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      if (!loaded) setShowVideo(false)
    }, 15000)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [loaded])

  const handleLoadedData = () => {
    console.log("Video loaded successfully")
    setLoaded(true)
    setShowVideo(true)
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  const handleError = (error) => {
    console.error("Video loading error:", error)
    setShowVideo(false)
  }

  if (!showVideo) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-xl min-h-[200px]">
        <div className="text-center">
          <span className="text-gray-400 block mb-2">Video is taking longer to load...</span>
          <span className="text-gray-300 text-sm block mb-4">
            This may be due to slow internet connection or large video file.
          </span>
          <button
            onClick={() => {
              setShowVideo(true)
              setLoaded(false)
            }}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <video {...props} onLoadedData={handleLoadedData} onError={handleError} poster={poster}>
      <source src={src} type="video/mp4" />
      Your browser does not support the video tag.
    </video>
  )
}

// Add Google Analytics event tracking types and helper
declare global {
  interface Window {
    gtag: (
      command: string,
      action: string,
      params?: {
        event_callback?: () => void
        event_timeout?: number
        [key: string]: any
      },
    ) => void
  }
}

// Helper function for conversion tracking
const trackConversion = (eventName: string, url?: string) => {
  if (typeof window !== "undefined" && window.gtag) {
    const callback = () => {
      if (url) {
        window.location.href = url
      }
    }

    window.gtag("event", eventName, {
      event_callback: callback,
      event_timeout: 2000,
    })
    return false
  }
  return true
}

// Type definitions for card items
type CardVariant = "default" | "outline" | "link" | "destructive" | "secondary" | "ghost"

interface CardItem {
  title: string
  description: string
  icon: React.ReactNode
  buttonText: string
  onClick?: () => void
  href?: string
  external?: boolean
  variant: CardVariant
  className: string
  is24_7?: boolean
}

export default function HibachiAtHomePage() {
  const router = useRouter()

  const handleOnlineBooking = () => {
    trackConversion("conversion_event_submit_lead_form_1")
    router.push("/estimation?source=booking")
  }

  const handleBookNow = (packageType: string) => {
    trackConversion("conversion_event_submit_lead_form_1")
    router.push(`/book?package=${packageType}`)
  }

  const handleViewMenu = () => {
    trackConversion("conversion_event_view_menu")
    router.push("/menu")
  }

  const handleViewFAQ = () => {
    trackConversion("conversion_event_view_faq")
    router.push("/faq")
  }

  const handleWhatsApp = () => {
    const phoneNumber = siteConfig.contact.phone?.replace(/-/g, '') || "12137707788"
    const url = `https://wa.me/${phoneNumber}?text=Hello%2C%20I%20would%20like%20to%20book%20a%20hibachi%20experience`
    trackConversion("conversion_event_whatsapp_contact", url)
    window.open(url, '_blank')
  }

  const handleSMS = () => {
    const phoneNumber = siteConfig.contact.phone?.replace(/-/g, '') || "12137707788"
    const url = `sms:${phoneNumber}?body=I'm%20interested%20in%20booking%20a%20REAL%20HIBACHI%20experience`
    trackConversion("conversion_event_sms_contact", url)
    window.location.href = url
  }

  const handlePhone = () => {
    const phoneNumber = siteConfig.contact.phone?.replace(/-/g, '') || "12137707788"
    const url = `tel:${phoneNumber}`
    trackConversion("conversion_event_phone_contact", url)
    window.location.href = url
  }

  const cardItems: CardItem[] = [
    {
      title: "Online Booking",
      description: "Book at your convenience",
      icon: <MessageSquare className="mr-2 h-4 w-4 flex-shrink-0" />,
      buttonText: "Book Online",
      onClick: handleOnlineBooking,
      variant: "default",
      className: "bg-white/20 border-white/30",
      is24_7: true,
    },
    {
      title: "WhatsApp",
      description: "Fastest response time",
      icon: <MessageSquare className="mr-2 h-4 w-4 flex-shrink-0" />,
      buttonText: "WhatsApp",
      onClick: handleWhatsApp,
      variant: "outline",
      className: "bg-white/20 border-white/30",
    },
    {
      title: "SMS",
      description: "Text us directly",
      icon: <MessageSquare className="mr-2 h-4 w-4 flex-shrink-0" />,
      buttonText: "SMS",
      onClick: handleSMS,
      variant: "outline",
      className: "bg-white/20 border-white/30",
    },
    {
      title: "Phone",
      description: "Speak with us",
      icon: null,
      buttonText: siteConfig.contact.phone || "(213) 770-7788",
      onClick: handlePhone,
      variant: "outline",
      className: "bg-white/20 border-white/30",
    },
  ]

  return (
    <div className="min-h-screen">
      <HeroSection />

      {/* Los Angeles Service Area Highlight */}
      <AnimateOnScroll>
        <section className="py-12 relative overflow-hidden">
          {/* Image Background instead of Video */}
          <div className="absolute inset-0 w-full h-full z-0">
            <img
              src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/Chicken-and-Beef-Hibachi-Catering-LA-itQYZOc95RTr9yWdNJOr1NiXsBBIBu.jpg"
              alt="Los Angeles hibachi catering background"
              className="w-full h-full object-cover"
            />
            {/* Overlay to ensure text readability */}
            <div className="absolute inset-0 bg-black/60 z-10"></div>
          </div>

          <div className="container mx-auto px-4 relative z-20">
            <div className="text-center max-w-4xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-serif font-bold text-white mb-4">
                Now Serving <span className="text-primary">Los Angeles & Orange County</span>
              </h2>
              <p className="text-lg text-white mb-6">
                Experience authentic hibachi at home in LA, Beverly Hills, Santa Monica, Irvine, and surrounding areas
              </p>
              <div className="flex flex-wrap justify-center gap-4 mb-6">
                <div className="flex items-center text-sm text-white">
                  <MapPin className="h-4 w-4 text-primary mr-1" />
                  Los Angeles County
                </div>
                <div className="flex items-center text-sm text-white">
                  <MapPin className="h-4 w-4 text-primary mr-1" />
                  Orange County
                </div>
                <div className="flex items-center text-sm text-white">
                  <Star className="h-4 w-4 text-yellow-500 mr-1" />
                  Same Day Available
                </div>
              </div>
              <Button asChild className="bg-primary hover:bg-primary/90">
                <a href="/locations/la-orange-county">Book Hibachi at Home in LA</a>
              </Button>
            </div>
          </div>
        </section>
      </AnimateOnScroll>

      {/* Social Proof Counter */}
      <AnimateOnScroll>
        <SocialProofCounter />
      </AnimateOnScroll>

      {/* Service Introduction */}
      <AnimateOnScroll>
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h3 className="text-3xl font-serif font-bold mb-4">✅ "We bring the restaurant to your backyard."</h3>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Professional hibachi chef comes to your home with everything needed for an authentic Japanese dining
                experience.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto text-center">
              {serviceFeatures.map((feature, index) => (
                <div key={index} className="flex flex-col items-center text-center p-4">
                  <div className="text-3xl mb-3">{feature.icon}</div>
                  <div className="text-lg font-semibold mb-2">{feature.title}</div>
                  <div className="text-sm text-gray-600">{feature.description}</div>
                </div>
              ))}
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

            <div className="flex flex-col md:flex-row gap-8 max-w-4xl mx-auto justify-center items-center md:items-start">
              {/* Basic Package Card */}
              <AnimateOnScroll direction="left" className="w-full max-w-sm mx-auto md:flex-1 md:max-w-md md:mx-0">
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
                      loading="lazy"
                    />
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold mb-2">Hibachi Show Package</h3>
                    <div className="mb-4">
                      <p className="text-lg font-semibold text-amber-600">
                        <span className="text-gray-500 text-sm line-through mr-2">$60</span>
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
                    <Button className="w-full bg-amber-500 hover:bg-amber-600" onClick={() => handleBookNow("show")}>
                      Book Now
                    </Button>
                  </div>
                </div>
              </AnimateOnScroll>

              {/* Buffet Style Package Card */}
              <AnimateOnScroll direction="right" className="w-full max-w-sm mx-auto md:flex-1 md:max-w-md md:mx-0">
                <div className="border rounded-lg overflow-hidden transition-all relative hover:shadow-lg">
                  <div className="absolute top-2 right-2 z-10">
                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 border-blue-200">
                      Self-Service
                    </span>
                  </div>
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/filetchickenshrimp-Hibachi-Catering-LA-s2QYxFQesPB2wRPyaCJabQ5nGIPH4V.jpg"
                      alt="Buffet Style Package"
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold mb-2">Buffet Style Package</h3>
                    <div className="mb-4">
                      <p className="text-lg font-semibold text-amber-600">
                        <span className="text-gray-500 text-sm line-through mr-2">$60</span>
                        $59.9
                        <span className="text-sm font-normal"> per person</span>
                      </p>
                      <p className="text-xs text-gray-600">($1497 minimum)</p>
                    </div>
                    <ul className="space-y-1 mb-6 text-sm">
                      <li className="flex items-start">
                        <span className="text-amber-500 mr-2">•</span>
                        <span>Self-service buffet style</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-amber-500 mr-2">•</span>
                        <span>Fixed menu (3 proteins included)</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-amber-500 mr-2">•</span>
                        <span>Same price, larger portions & more food</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-amber-500 mr-2">•</span>
                        <span>$998 minimum order required</span>
                      </li>
                    </ul>
                    <Button className="w-full bg-amber-500 hover:bg-amber-600" onClick={() => handleBookNow("buffet")}>
                      Book Now
                    </Button>
                  </div>
                </div>
              </AnimateOnScroll>
            </div>

            <AnimateOnScroll direction="up" delay={200}>
              <div className="text-center mt-10">
                <Button
                  variant="outline"
                  className="rounded-full border-2 border-amber-500 text-amber-600 hover:bg-amber-50"
                  onClick={handleViewMenu}
                >
                  View Menu
                </Button>
              </div>
            </AnimateOnScroll>
          </div>
        </section>
      </AnimateOnScroll>

      {/* Party Experience Video Section */}
      <AnimateOnScroll>
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <AnimateOnScroll direction="down">
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-center mb-6">
                Perfect for <span className="text-primary">Birthday Parties & Celebrations</span>
              </h2>
              <p className="text-lg text-center text-gray-600 max-w-3xl mx-auto mb-10">
                Make your special occasions unforgettable with a private hibachi chef and an exciting dining experience
              </p>
            </AnimateOnScroll>

            <AnimateOnScroll>
              <div className="max-w-4xl mx-auto rounded-xl overflow-hidden shadow-2xl">
                <div className="relative pb-[56.25%] h-0">
                  <TimeoutVideo
                    className="absolute top-0 left-0 w-full h-full object-cover"
                    controls
                    autoPlay
                    muted
                    loop
                    poster="/hibachi-party.png"
                    src="/videos/hibachi-party-experience.mp4"
                  />
                </div>
              </div>
            </AnimateOnScroll>

            <div className="mt-8 text-center">
              <p className="text-amber-600 font-medium">
                Create lasting memories with friends and family at your next celebration!
              </p>
              <p className="text-gray-600 text-sm mt-2">
                Our chefs bring the entertainment and delicious food directly to your home or venue
              </p>
              <Button
                className="mt-6 bg-amber-500 hover:bg-amber-600 text-white"
                onClick={() => handleBookNow("party")}
              >
                Book Your Party Experience
              </Button>
            </div>
          </div>
        </section>
      </AnimateOnScroll>

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
                  <TimeoutVideo
                    className="absolute top-0 left-0 w-full h-full object-cover"
                    controls
                    autoPlay
                    muted
                    loop
                    poster="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hero/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20250514132251-CecaVfadScFYbfD1eg3HcM8jTxxgzi.png"
                    src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/video/realhibachi%20real%20fire-DMEwPxa4BNviYf8qhGyapmtJ21SvvS.mp4"
                  />
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

            {/* FAQ Section */}
            <AnimateOnScroll>
              <div className="mt-16 max-w-4xl mx-auto">
                <h3 className="text-2xl md:text-3xl font-serif font-bold text-center mb-8">
                  Frequently Asked Questions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {faqs.map((faq, index) => (
                    <AnimateOnScroll key={index} direction={index % 2 === 0 ? "left" : "right"}>
                      <div className="bg-white p-6 rounded-lg shadow-md">
                        <h4 className="font-bold text-lg mb-3 text-amber-600">{faq.question}</h4>
                        <p className="text-gray-600">{faq.answer}</p>
                      </div>
                    </AnimateOnScroll>
                  ))}
                </div>
                <div className="mt-8 text-center">
                  <Button
                    variant="outline"
                    className="rounded-full border-2 border-amber-500 text-amber-600 hover:bg-amber-50"
                    onClick={handleViewFAQ}
                  >
                    View All FAQs
                  </Button>
                </div>
              </div>
            </AnimateOnScroll>
          </div>
        </section>
      </AnimateOnScroll>

      {/* Customer Reviews */}
      <AnimateOnScroll>
        <section className="py-16 bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="container mx-auto px-4">
            <h3 className="text-3xl font-serif font-bold text-center mb-12">What Our Customers Say</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {reviews.map((review, index) => (
                <AnimateOnScroll key={index} delay={index * 100}>
                  <Card className="p-6 hover:shadow-lg transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex items-center mb-4">
                        {[...Array(review.rating)].map((_, i) => (
                          <Star key={i} className="h-5 w-5 text-yellow-500 fill-current" />
                        ))}
                      </div>
                      <p className="text-gray-600 mb-4 italic">"{review.text}"</p>
                      <p className="font-semibold">
                        — {review.name}, {review.location}
                      </p>
                    </CardContent>
                  </Card>
                </AnimateOnScroll>
              ))}
            </div>

            <div className="text-center mt-12">
              <Button
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 text-lg font-semibold"
                onClick={handleSMS}
              >
                <MessageSquare className="mr-2 h-5 w-5" /> Text for Instant Quote
              </Button>
            </div>
          </div>
        </section>
      </AnimateOnScroll>

      {/* Final CTA Section */}
      <section className="py-20 bg-gradient-to-r from-amber-600 to-orange-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-3xl md:text-5xl font-serif font-bold text-white mb-6">
            Ready to Create Unforgettable Memories?
          </h3>
          <p className="text-xl text-amber-100 max-w-3xl mx-auto mb-10">
            Book your hibachi experience today and bring the excitement of Japanese cuisine directly to your home. Our
            professional chefs are ready to create an amazing show and delicious meal for you and your guests.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {cardItems.map((card, index) => (
              <Card key={index} className={`text-center flex flex-col ${card.className}`}>
                <CardHeader className="h-[100px] flex flex-col justify-center">
                  <CardTitle className="text-white text-lg">{card.title}</CardTitle>
                  <CardDescription className="h-[30px] flex items-center justify-center text-amber-100">
                    {card.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col items-center justify-end pb-6">
                  <Button
                    className="w-full mx-auto h-10 text-xs sm:text-sm whitespace-nowrap overflow-hidden bg-white text-amber-600 hover:bg-amber-50"
                    variant={card.variant}
                    onClick={card.onClick}
                  >
                    {card.icon}
                    {card.buttonText}
                  </Button>
                  <div className="h-[20px] flex items-center justify-center">
                    {card.is24_7 && <p className="text-xs text-amber-100 mt-2">24/7 Service Available</p>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-2">500+</div>
              <div className="text-amber-100">Happy Customers</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-2">4.9</div>
              <div className="text-amber-100">Average Rating</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-2">100%</div>
              <div className="text-amber-100">Satisfaction Guarantee</div>
            </div>
          </div>

          <div className="mt-16 max-w-4xl mx-auto">
            <img
              src="/hibachi-group-selfie.jpg"
              alt="Happy customers enjoying hibachi experience at home"
              className="w-full h-64 md:h-80 object-cover rounded-xl shadow-2xl"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <TestimonialsSection testimonials={testimonials} />

      {/* Signature Fried Rice Video Section */}
      <AnimateOnScroll>
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <AnimateOnScroll direction="down">
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-center mb-6">Signature Fried Rice</h2>
              <p className="text-lg text-center text-gray-600 max-w-3xl mx-auto mb-10">
                Watch our chef prepare our signature fried rice.
              </p>
            </AnimateOnScroll>

            <AnimateOnScroll>
              <div className="max-w-4xl mx-auto rounded-xl overflow-hidden shadow-2xl">
                <div className="relative pb-[56.25%] h-0">
                  <TimeoutVideo
                    className="absolute top-0 left-0 w-full h-full object-cover"
                    controls
                    autoPlay
                    muted
                    loop
                    poster="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hero/signature-fried-rice-poster-Hs7ixFQesPB2wRPyaCJabQ5nGIPH4V.jpg"
                    src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/video/signature-fried-rice-DMEwPxa4BNviYf8qhGyapmtJ21SvvS.mp4"
                  />
                </div>
              </div>
            </AnimateOnScroll>

            <div className="mt-8 text-center">
              <p className="text-amber-600 font-medium">Our signature fried rice is a crowd favorite!</p>
              <p className="text-gray-600 text-sm mt-2">Made with fresh ingredients and cooked to perfection.</p>
            </div>
          </div>
        </section>
      </AnimateOnScroll>
    </div>
  )
}
