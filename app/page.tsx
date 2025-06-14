"use client"

import type React from "react"

import Link from "next/link"
import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageSquare } from "lucide-react"
import { useRouter } from "next/navigation"
import { siteConfig } from "@/config/site"

import { Button } from "@/components/ui/button"
import { AnimateOnScroll } from "@/components/animate-on-scroll"
import HeroSection from "@/components/hero-section"
import TestimonialsSection from "@/components/testimonials-section"
import HowItWorksSection from "@/components/how-it-works-section"
import PromotionalCard from "@/components/promotional-card"

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

export default function Home() {
  const router = useRouter()

  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null)

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
    const url = `https://wa.me/${siteConfig.contact.phone || "15627134832"}?text=Hello%2C%20I%20would%20like%20to%20book%20a%20hibachi%20experience`
    trackConversion("conversion_event_whatsapp_contact", url)
  }

  const handleSMS = () => {
    const url = `sms:5627134832?body=I'm%20interested%20in%20booking%20a%20REAL%20HIBACHI%20experience`
    trackConversion("conversion_event_sms_contact", url)
  }

  const handlePhone = () => {
    const url = `tel:${siteConfig.contact.phone || "15627134832"}`
    trackConversion("conversion_event_phone_contact", url)
  }

  const cardItems: CardItem[] = [
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
      buttonText: siteConfig.contact.phone || "15627134832",
      onClick: handlePhone,
      variant: "outline",
      className: "bg-white/20 border-white/30",
    },
  ]

  return (
    <div className="overflow-x-hidden">
      <HeroSection />

      {/* How It Works Section */}
      <HowItWorksSection />

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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
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
                      loading="lazy"
                    />
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold mb-2">Hibachi Show Package</h3>
                    <div className="mb-4">
                      <p className="text-lg font-semibold text-amber-600">
                        <span className="text-gray-500 text-sm line-through mr-2">$60</span>
                        $49.9
                        <span className="text-sm font-normal"> per person</span>
                      </p>
                      <p className="text-xs text-gray-600">($499 minimum)</p>
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
                  </div>
                </div>
              </AnimateOnScroll>

              {/* Show Up Package Card */}
              <AnimateOnScroll direction="up">
                <div className="border rounded-lg overflow-hidden transition-all relative hover:shadow-lg border-green-300/50 hover:border-green-300">
                  <div className="absolute top-2 right-2 z-10">
                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-800 border-green-200">
                      All-Inclusive
                    </span>
                  </div>
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/3ce446cf6f67fa9ee6ef2bbdb81de44-v6JRJjtRTudV3D6zJCWCEoOXtgw4NU.png"
                      alt="Show Up Package"
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold mb-2">Show Up Package</h3>
                    <div className="mb-4">
                      <p className="text-lg font-semibold text-amber-600">
                        <span className="text-gray-500 text-sm line-through mr-2">$75</span>
                        $64.9
                        <span className="text-sm font-normal"> per person</span>
                      </p>
                      <p className="text-xs text-gray-600">($599 minimum)</p>
                    </div>
                    <ul className="space-y-1 mb-6 text-sm">
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">•</span>
                        <span>2 proteins of your choice</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">•</span>
                        <span>Tables, chairs & utensils included</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">•</span>
                        <span>Chef performance included</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">•</span>
                        <span>Everything ready to go!</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </AnimateOnScroll>

              {/* Buffet Style Package Card */}
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
                        $49.9
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
                        <span>Minimum 30 people required</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </AnimateOnScroll>
            </div>

            {/* Promotional Card - Added after package cards */}
            <PromotionalCard />

            <AnimateOnScroll direction="up" delay={200}>
              <div className="text-center mt-10">
                <Button
                  asChild
                  variant="outline"
                  className="rounded-full border-2 border-amber-500 text-amber-600 hover:bg-amber-50"
                  onClick={handleViewMenu}
                >
                  <Link href="/menu">See Full Menu</Link>
                </Button>
              </div>
            </AnimateOnScroll>
          </div>
        </section>
      </AnimateOnScroll>

      {/* Signature Fried Rice Section */}
      <AnimateOnScroll>
        <section className="py-16 bg-gradient-to-r from-orange-50 to-amber-50">
          <div className="container mx-auto px-4">
            <AnimateOnScroll direction="down">
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-center mb-6">
                Our Signature <span className="text-primary">Garlic Butter Fried Rice</span>
              </h2>
              <p className="text-lg text-center text-gray-600 max-w-3xl mx-auto mb-10">
                Experience our chefs preparing delicious hibachi fried rice with aromatic garlic butter and fresh
                vegetables right before your eyes.
              </p>
            </AnimateOnScroll>

            <AnimateOnScroll>
              <div className="max-w-3xl mx-auto rounded-xl overflow-hidden shadow-2xl">
                <div className="relative pb-[56.25%] h-0">
                  <TimeoutVideo
                    className="absolute top-0 left-0 w-full h-full object-cover"
                    controls
                    autoPlay
                    muted
                    loop
                    poster="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hero/signature-fried-rice-poster-Hs7ixFQesPB2wRPyaCJabQ5nGIPH4V.jpg"
                    src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/video/fried%20rice%E2%80%94%E2%80%94%E4%BD%BF%E7%94%A8Clipchamp%E5%88%B6%E4%BD%9C%20%281%29-KokWcVkQaH2bx0S1MqMxI675DrVvlm.mp4"
                  />
                </div>
              </div>
            </AnimateOnScroll>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <AnimateOnScroll delay={100} direction="up">
                <div className="bg-white p-6 rounded-lg shadow-md text-center">
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-amber-600 text-xl">🧄</span>
                  </div>
                  <h3 className="font-bold text-lg mb-2">Aromatic Garlic Butter</h3>
                  <p className="text-gray-600">
                    Our special garlic butter creates a flavorful base for our signature fried rice.
                  </p>
                </div>
              </AnimateOnScroll>

              <AnimateOnScroll delay={200} direction="up">
                <div className="bg-white p-6 rounded-lg shadow-md text-center">
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-amber-600 text-xl">🍚</span>
                  </div>
                  <h3 className="font-bold text-lg mb-2">Delicious Fried Rice</h3>
                  <p className="text-gray-600">
                    Each grain is seasoned and cooked to achieve an authentic hibachi taste.
                  </p>
                </div>
              </AnimateOnScroll>

              <AnimateOnScroll delay={300} direction="up">
                <div className="bg-white p-6 rounded-lg shadow-md text-center">
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-amber-600 text-xl">👨‍🍳</span>
                  </div>
                  <h3 className="font-bold text-lg mb-2">Skilled Chef's Technique</h3>
                  <p className="text-gray-600">
                    Watch our skilled chefs demonstrate traditional hibachi cooking techniques.
                  </p>
                </div>
              </AnimateOnScroll>
            </div>

            <div className="mt-8 text-center">
              <p className="text-amber-600 font-medium text-lg">Every grain offers authentic Japanese flavors! 🍚✨</p>
              <p className="text-gray-600 text-sm mt-2">
                Our garlic butter fried rice is included in all hibachi packages.
              </p>
            </div>
          </div>
        </section>
      </AnimateOnScroll>

      {/* Hibachi Shrimp Cooking Section */}
      <AnimateOnScroll>
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <AnimateOnScroll direction="down">
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-center mb-6">
                Sizzling <span className="text-primary">Hibachi Shrimp</span>
              </h2>
              <p className="text-lg text-center text-gray-600 max-w-3xl mx-auto mb-10">
                Watch our chefs prepare succulent jumbo shrimp with flair. These delicious seafood items are cooked to
                perfection right before your eyes.
              </p>
            </AnimateOnScroll>

            <AnimateOnScroll>
              <div className="max-w-3xl mx-auto rounded-xl overflow-hidden shadow-2xl">
                <div className="relative pb-[56.25%] h-0">
                  <TimeoutVideo
                    className="absolute top-0 left-0 w-full h-full object-cover"
                    controls
                    autoPlay
                    muted
                    loop
                    poster="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hero/hibachi-shrimp-poster-Hs7ixFQesPB2wRPyaCJabQ5nGIPH4V.jpg"
                    src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/video/%E6%97%A0%E6%A0%87%E9%A2%98%E8%A7%86%E9%A2%91%E2%80%94%E2%80%94%E4%BD%BF%E7%94%A8Clipchamp%E5%88%B6%E4%BD%9C%20%286%29-GPDBGmtsQpjD214EDrt1aM2QxyJmex.mp4"
                  />
                </div>
              </div>
            </AnimateOnScroll>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <AnimateOnScroll delay={100} direction="up">
                <div className="bg-white p-6 rounded-lg shadow-md text-center border border-gray-100">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-blue-600 text-xl">🦐</span>
                  </div>
                  <h3 className="font-bold text-lg mb-2">Quality Jumbo Shrimp</h3>
                  <p className="text-gray-600">
                    We use fresh, high-quality jumbo shrimp for a great hibachi experience.
                  </p>
                </div>
              </AnimateOnScroll>

              <AnimateOnScroll delay={200} direction="up">
                <div className="bg-white p-6 rounded-lg shadow-md text-center border border-gray-100">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-blue-600 text-xl">🔥</span>
                  </div>
                  <h3 className="font-bold text-lg mb-2">Expertly Cooked</h3>
                  <p className="text-gray-600">
                    Our cooking technique creates a good sear while keeping the shrimp tender and juicy.
                  </p>
                </div>
              </AnimateOnScroll>

              <AnimateOnScroll delay={300} direction="up">
                <div className="bg-white p-6 rounded-lg shadow-md text-center border border-gray-100">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-blue-600 text-xl">🍋</span>
                  </div>
                  <h3 className="font-bold text-lg mb-2">Enhanced Flavor</h3>
                  <p className="text-gray-600">
                    A hint of lemon and our seasoning blend enhances the natural sweetness of the shrimp.
                  </p>
                </div>
              </AnimateOnScroll>
            </div>

            <div className="mt-8 text-center">
              <p className="text-blue-600 font-medium text-lg">Delicious shrimp, prepared with care! 🦐✨</p>
              <p className="text-gray-600 text-sm mt-2">
                Available as a premium protein option in all hibachi packages.
              </p>
            </div>
          </div>
        </section>
      </AnimateOnScroll>

      {/* Hibachi Steak Cooking Section */}
      <AnimateOnScroll>
        <section className="py-16 bg-gradient-to-r from-orange-50 to-amber-50">
          <div className="container mx-auto px-4">
            <AnimateOnScroll direction="down">
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-center mb-6">
                Delicious <span className="text-primary">Hibachi Steak</span> Experience
              </h2>
              <p className="text-lg text-center text-gray-600 max-w-3xl mx-auto mb-10">
                Watch our chefs prepare seasoned hibachi steak with precision. Each cut is grilled to your preference on
                our hibachi grill, delivering a great taste at your home.
              </p>
            </AnimateOnScroll>

            <AnimateOnScroll>
              <div className="max-w-3xl mx-auto rounded-xl overflow-hidden shadow-2xl">
                <div className="relative pb-[56.25%] h-0">
                  <TimeoutVideo
                    className="absolute top-0 left-0 w-full h-full object-cover"
                    controls
                    autoPlay
                    muted
                    loop
                    poster="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hero/hibachi-steak-poster-Hs7ixFQesPB2wRPyaCJabQ5nGIPH4V.jpg"
                    src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/video/AQMZeMY8EF_j_fglcE3cfFprzTeRb6_2VViMqKLTk8A74DzytNZ4EcprS7wY6vKzNmvEcY3CjYdVVPFDJtcmX69ccg_95g7mEZyVMAU.-rxB2mXpQhOkR95B8v11qxN072QyNyy.mp4"
                  />
                </div>
              </div>
            </AnimateOnScroll>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <AnimateOnScroll delay={100} direction="up">
                <div className="bg-white p-6 rounded-lg shadow-md text-center border border-gray-100">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-red-600 text-xl">🥩</span>
                  </div>
                  <h3 className="font-bold text-lg mb-2">Quality Beef</h3>
                  <p className="text-gray-600">We use selected cuts of beef, prepared for hibachi cooking.</p>
                </div>
              </AnimateOnScroll>

              <AnimateOnScroll delay={200} direction="up">
                <div className="bg-white p-6 rounded-lg shadow-md text-center border border-gray-100">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-red-600 text-xl">🔥</span>
                  </div>
                  <h3 className="font-bold text-lg mb-2">Optimal Searing</h3>
                  <p className="text-gray-600">
                    Our hibachi grills reach the right temperature for a good sear and flavor.
                  </p>
                </div>
              </AnimateOnScroll>

              <AnimateOnScroll delay={300} direction="up">
                <div className="bg-white p-6 rounded-lg shadow-md text-center border border-gray-100">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-red-600 text-xl">👨‍🍳</span>
                  </div>
                  <h3 className="font-bold text-lg mb-2">Skilled Preparation</h3>
                  <p className="text-gray-600">Our chefs know how to cook each steak to your preferred doneness.</p>
                </div>
              </AnimateOnScroll>
            </div>

            <div className="mt-8 text-center">
              <p className="text-red-600 font-medium text-lg">Steak cooked just right, every time! 🥩🔥</p>
              <p className="text-gray-600 text-sm mt-2">
                Available as part of our protein selections in all hibachi packages.
              </p>
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
                    poster="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hero/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20250514132251kebnwwqnqr8l.public.blob.vercel-storage.com/hero/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20250514132251-CecaVfadScFYbfD1eg3HcM8jTxxgzi.png"
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
          </div>
        </section>
      </AnimateOnScroll>

      {/* Customer Reactions Section */}
      <AnimateOnScroll>
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <AnimateOnScroll direction="down">
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-center mb-6">
                Sake Service & Entertainment
              </h2>
              <p className="text-lg text-center text-gray-600 max-w-3xl mx-auto mb-12">
                Experience Japanese tradition as our chefs serve sake alongside hibachi entertainment.
              </p>
            </AnimateOnScroll>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
              <AnimateOnScroll direction="left">
                <div className="relative">
                  <img
                    src="/images/customer-enjoying-hibachi.png"
                    alt="Chef serving sake to delighted customers during hibachi experience"
                    className="w-full h-auto rounded-xl shadow-2xl"
                    loading="lazy"
                  />
                  <div className="absolute -bottom-4 -right-4 bg-amber-500 text-white p-4 rounded-full shadow-lg">
                    <span className="text-2xl">🔥</span>
                  </div>
                </div>
              </AnimateOnScroll>

              <AnimateOnScroll direction="right">
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-white rounded-lg shadow-md">
                      <div className="text-2xl font-bold text-amber-600 mb-1">98%</div>
                      <div className="text-sm text-gray-600">Customer Satisfaction</div>
                    </div>
                    <div className="text-center p-4 bg-white rounded-lg shadow-md">
                      <div className="text-2xl font-bold text-amber-600 mb-1">100%</div>
                      <div className="text-sm text-gray-600">Entertainment Guaranteed</div>
                    </div>
                  </div>
                </div>
              </AnimateOnScroll>
            </div>
          </div>
        </section>
      </AnimateOnScroll>

      {/* FAQ Section */}
      <AnimateOnScroll>
        <section className="py-16 bg-gradient-to-r from-orange-50 to-amber-50">
          <div className="container mx-auto px-4">
            <AnimateOnScroll direction="down">
              <h3 className="text-2xl md:text-3xl font-serif font-bold text-center mb-8">Frequently Asked Questions</h3>
            </AnimateOnScroll>

            <div className="space-y-4">
              {[
                {
                  question: "How much space do you need for the hibachi setup?",
                  answer:
                    "We need a minimum 8x8 feet outdoor space for our hibachi grill setup. This includes space for the chef to perform safely and for guests to gather around comfortably.",
                },
                {
                  question: "What's included in the hibachi experience?",
                  answer:
                    "Our service includes a professional hibachi chef, all cooking equipment, ingredients for your selected menu, chef performance with tricks and entertainment, and complete cleanup afterward.",
                },
                {
                  question: "Can you provide tables and chairs?",
                  answer:
                    "Yes! We offer table, chair, and tablecloth rental at $10 per person. Utensils are not included in this package. If you need utensils, we can provide them for an additional $5 per person. If you'd rather supply your own tables, chairs, and utensils, that's fine too—just let us know in advance.",
                },
                {
                  question: "What is your cancellation policy?",
                  answer:
                    "Our cancellation policy includes the following terms: 48 hours' notice required for cancellations or reschedules. Late changes incur a $100 fee. Weather contingency: You're responsible for providing cover (e.g., tent, canopy) within 48 hours of the event. If you need to cancel due to weather, please let us know at least 48 hours beforehand.",
                },
              ].map((faq, index) => (
                <div key={index} className="bg-white rounded-lg shadow-md overflow-hidden">
                  <button
                    className="w-full p-6 text-left flex justify-between items-center hover:bg-amber-50 transition-colors"
                    onClick={() => setExpandedFAQ(expandedFAQ === index ? null : index)}
                  >
                    <h4 className="font-bold text-lg text-amber-600 pr-4">{faq.question}</h4>
                    <span
                      className={`text-amber-600 text-xl transition-transform ${expandedFAQ === index ? "rotate-180" : ""}`}
                    >
                      ▼
                    </span>
                  </button>
                  {expandedFAQ === index && (
                    <div className="px-6 pb-6">
                      <p className="text-gray-600">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <AnimateOnScroll direction="up" delay={200}>
              <div className="mt-8 text-center">
                <Button
                  asChild
                  variant="outline"
                  className="rounded-full border-2 border-amber-500 text-amber-600 hover:bg-amber-50"
                  onClick={handleViewFAQ}
                >
                  <Link href="/faq">View All FAQs</Link>
                </Button>
              </div>
            </AnimateOnScroll>
          </div>
        </section>
      </AnimateOnScroll>

      {/* Call to Action Section */}
      <AnimateOnScroll>
        <section className="py-20 bg-gradient-to-r from-amber-600 to-orange-600">
          <div className="container mx-auto px-4 text-center">
            <AnimateOnScroll direction="down">
              <h2 className="text-3xl md:text-5xl font-serif font-bold text-white mb-6">
                Ready to Create Great Memories?
              </h2>
              <p className="text-xl text-amber-100 max-w-3xl mx-auto mb-10">
                Book your hibachi experience today and bring the excitement of Japanese cuisine directly to your home.
                Our chefs are ready to create a great show and delicious meal for you and your guests.
              </p>
            </AnimateOnScroll>

            <AnimateOnScroll direction="up" delay={200}>
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

            <AnimateOnScroll direction="up" delay={600}>
              <div className="mt-16 max-w-4xl mx-auto">
                <img
                  src="/hibachi-group-selfie.jpg"
                  alt="Happy customers enjoying hibachi experience at home"
                  className="w-full h-64 md:h-80 object-cover rounded-xl shadow-2xl"
                  loading="lazy"
                />
              </div>
            </AnimateOnScroll>
          </div>
        </section>
      </AnimateOnScroll>

      {/* Testimonials Section */}
      <TestimonialsSection />
    </div>
  )
}
