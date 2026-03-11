"use client"

import type React from "react"

import Link from "next/link"
import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, Check, MessageSquare, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { siteConfig } from "@/config/site"

import { Button } from "@/components/ui/button"
import { AnimateOnScroll } from "@/components/animate-on-scroll"
import HeroSection from "@/components/hero-section"
import TestimonialsSection from "@/components/testimonials-section"
import InstagramVideosSection from "@/components/instagram-videos-section"
import PromotionalCard from "@/components/promotional-card"
import { trackEvent } from "@/lib/tracking"

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

  const handleError = (error: any) => {
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
  const packageSelectionMetadata: Record<string, { name: string; price_tier: string }> = {
    show: { name: "Hibachi Show Package", price_tier: "59.9_per_person" },
    buffet: { name: "Buffet Style Package", price_tier: "59.9_per_person" },
    party: { name: "Party Experience Package", price_tier: "custom_party" },
  }

  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null)

  const handleOnlineBooking = () => {
    trackEvent("lead_start")
    router.push("/quoteA?source=booking")
  }

  const handleBookNow = (packageType: string) => {
    const packageSelection = packageSelectionMetadata[packageType]

    if (packageSelection) {
      trackEvent("package_selected", {
        package_name: packageSelection.name,
        price_tier: packageSelection.price_tier,
        package_type: packageType,
      })
    }

    trackEvent("lead_start")
    router.push(`/book?package=${packageType}`)
  }

  const handleViewMenu = () => {
    trackEvent("menu_view")
    router.push("/menu")
  }

  const handleViewFAQ = () => {
    trackEvent("faq_view")
    router.push("/faq")
  }

  const handleWhatsApp = () => {
    const url = `https://wa.me/${siteConfig.contact.phone || "12137707788"}?text=Hello%2C%20I%20would%20like%20to%20book%20a%20hibachi%20experience`
    trackEvent("contact_whatsapp_click")
    window.location.href = url
  }

  const handleSMS = () => {
    const url = `sms:2137707788?body=I'm%20interested%20in%20booking%20a%20REAL%20HIBACHI%20experience`
    trackEvent("contact_sms_click")
    window.location.href = url
  }

  const handlePhone = () => {
    const url = `tel:${siteConfig.contact.phone || "12137707788"}`
    trackEvent("contact_call_click")
    window.location.href = url
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
      buttonText: siteConfig.contact.phone || "12137707788",
      onClick: handlePhone,
      variant: "outline",
      className: "bg-white/20 border-white/30",
    },
  ]

  const standardPlanFeatures = [
    "$29.95 per child (under 13)",
    "$599 minimum per event",
    "2 regular proteins per guest included",
    "Fried rice, fresh vegetables, and house salad included",
    "Live chef performance and on-site grill cooking",
    "Optional full setup: +$15 per guest",
    "Premium protein upgrades available",
  ]

  const weekdaySaverFeatures = [
    "$45.9 per adult",
    "$22.95 per child (under 13, 50% food price)",
    "Monday-Thursday events only",
    "Minimum 15 total guests",
    "Choose exactly 2 proteins: chicken, steak, shrimp",
    "No add-ons or custom upgrade in this tier",
    "Optional full setup: +$15 per guest",
  ]

  const customPlanFeatures = [
    "Everything in the Standard plan",
    "Multi-chef planning for larger parties",
    "Custom timeline and event flow support",
    "Add-on, rental, and setup coordination",
    "Direct planning support from our team",
  ]

  return (
    <div>
      <HeroSection />
      {/* Package Options Section */}
      <AnimateOnScroll>
        <section id="pricing" className="py-16 bg-[#f7f4ec] scroll-mt-36 md:scroll-mt-44">
          <div className="container mx-auto px-4">
            <AnimateOnScroll direction="down">
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-center mb-3 text-[hsl(24_79%_55%)]">Pricing</h2>
              <p className="text-4xl md:text-5xl font-serif font-bold text-center text-gray-900 max-w-4xl mx-auto leading-tight mb-5">
                Pick The Plan That Fits Your Party
              </p>
              <p className="text-base md:text-lg text-center text-gray-600 max-w-3xl mx-auto mb-12">
                Compare weekday saver, standard, and custom options. Book instantly when your event fits the published
                rules, or contact our team for tailored planning.
              </p>
            </AnimateOnScroll>

            <div className="grid gap-6 lg:grid-cols-3 max-w-6xl mx-auto">
              <AnimateOnScroll direction="up" delay={60}>
                <div className="rounded-3xl bg-emerald-50 border border-emerald-200 p-8 md:p-10 text-stone-700 shadow-[0_12px_28px_rgba(5,150,105,0.15)]">
                  <p className="text-lg font-semibold text-emerald-900">Weekday Saver</p>
                  <div className="mt-5 flex items-baseline gap-2">
                    <p className="text-5xl font-black text-emerald-950">$45.9</p>
                    <p className="text-lg font-medium text-emerald-800">/adult</p>
                  </div>
                  <p className="mt-3 text-base text-emerald-900">For Monday-Thursday parties with 15+ guests and a fixed menu set.</p>
                  <Button asChild className="mt-7 h-12 w-full rounded-full bg-emerald-600 text-white hover:bg-emerald-700 text-base font-semibold shadow-md">
                    <Link href="/quoteA">
                      Check Weekday Saver
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <div className="mt-7 space-y-3 border-t border-emerald-200 pt-7">
                    {weekdaySaverFeatures.map((item) => (
                      <div key={item} className="flex items-start gap-3 text-[15px] leading-relaxed text-emerald-900">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </AnimateOnScroll>

              <AnimateOnScroll direction="up">
                <div className="relative rounded-3xl bg-[#fffdf8] border border-[#e7dbc6] p-8 md:p-10 text-stone-700 shadow-[0_12px_30px_rgba(120,80,20,0.12)]">
                  <div className="absolute -top-4 left-8 inline-flex items-center gap-1 rounded-full bg-[hsl(24_79%_55%)] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-md">
                    <Sparkles className="h-3.5 w-3.5" />
                    Most Popular
                  </div>
                  <p className="mt-4 text-lg font-semibold text-gray-800">Standard Plan</p>
                  <div className="mt-5 flex items-baseline gap-2">
                    <p className="text-5xl font-black text-gray-900">$59.90</p>
                    <p className="text-lg font-medium text-gray-500">/adult</p>
                  </div>
                  <p className="mt-3 text-base text-gray-600">Best for most birthdays, family parties, and backyard events.</p>
                  <Button asChild className="mt-7 h-12 w-full rounded-full bg-[hsl(24_79%_55%)] text-white hover:bg-[hsl(24_79%_48%)] text-base font-semibold shadow-md">
                    <Link href="/quoteA">
                      Get Instant Quote
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <div className="mt-7 space-y-3 border-t border-[#eadfcf] pt-7">
                    {standardPlanFeatures.map((item) => (
                      <div key={item} className="flex items-start gap-3 text-[15px] leading-relaxed text-gray-700">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(24_79%_42%)]" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </AnimateOnScroll>

              <AnimateOnScroll direction="up" delay={180}>
                <div className="rounded-3xl bg-[#fcfcfc] border border-[#dfe2e8] p-8 md:p-10 text-stone-700 shadow-[0_10px_24px_rgba(31,41,55,0.08)]">
                  <p className="text-lg font-semibold text-gray-800">Custom Plan</p>
                  <h3 className="mt-5 text-5xl font-black tracking-tight text-gray-900">Talk with us</h3>
                  <p className="mt-3 text-base text-gray-600">
                    For larger guest counts, special menu requests, or custom event logistics.
                  </p>
                  <Button asChild className="mt-7 h-12 w-full rounded-full bg-[#1f2a44] text-white hover:bg-[#111a2f] text-base font-semibold shadow-md">
                    <Link href="/contact?reason=Custom%20Pricing%20Request">
                      Request Custom Plan
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <div className="mt-7 space-y-3 border-t border-[#e5e7eb] pt-7">
                    {customPlanFeatures.map((item) => (
                      <div key={item} className="flex items-start gap-3 text-[15px] leading-relaxed text-gray-700">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#1f2a44]" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </AnimateOnScroll>
            </div>

            {/* Promotional Card - Added after package cards  */}
            {/* <PromotionalCard />*/}
          </div>
        </section>
      </AnimateOnScroll>
     
      {/* Service Area Map */}
      <AnimateOnScroll>
        <section className="py-12 bg-gradient-to-b from-[#f8f4ea] to-[#f3ecdf]">
          <div className="container mx-auto px-4">
            <div className="text-center mb-6">
              <h3 className="text-4xl md:text-5xl font-serif font-bold text-gray-900">Book Your Hibachi Party</h3>
              <p className="mt-2 text-2xl md:text-3xl font-serif font-bold text-[hsl(24_79%_42%)]">
                Select Your Region To Start
              </p>
            </div>

            <div className="max-w-2xl mx-auto bg-[#fffdf8] rounded-3xl overflow-hidden border border-[#e7dbc6] shadow-[0_10px_30px_rgba(120,80,20,0.08)]">
              <img
                src="/socal-map.png"
                alt="West coast map with Southern California highlighted"
                className="w-full max-h-[460px] object-contain bg-[#f7f2e7]"
                loading="lazy"
              />

              <div className="px-6 md:px-8 py-7 text-center">
                <h3 className="text-3xl font-montserrat font-bold tracking-tight text-[hsl(24_79%_55%)] mb-2">
                  SOUTH CALIFORNIA
                </h3>
                <p className="text-stone-600 mb-5 text-sm md:text-base">
                  LA County, Orange County, Riverside + San Bernardino Counties, San Diego County, Ventura County
                </p>

                <Button
                  asChild
                  className="rounded-full bg-[hsl(24_79%_55%)] text-white px-8 min-w-[230px] h-12 hover:bg-[hsl(24_79%_48%)]"
                >
                  <Link href="/quoteA">GET INSTANT QUOTE</Link>
                </Button>

                <p className="mt-6 mb-3 text-sm font-medium tracking-wide text-stone-700">OR CALL TO BOOK</p>
                <a
                  href="tel:2137707788"
                  className="inline-flex items-center justify-center rounded-full border-2 border-[hsl(24_79%_55%)] text-[hsl(24_79%_55%)] px-8 min-w-[230px] h-12 font-semibold hover:bg-[hsl(24_79%_96%)] transition-colors"
                >
                  213-770-7788
                </a>
              </div>
            </div>
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
                Fresh garlic butter fried rice, cooked live by our chef.
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
                Jumbo shrimp grilled live with hibachi style.
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
                Steak grilled live and cooked to your preferred doneness.
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

          </div>
        </section>
      </AnimateOnScroll>

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
                    src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/video/realhibachi%20real fire-DMEwPxa4BNviYf8qhGyapmtJ21SvvS.mp4"
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
 {/* Instagram Videos Section */}
      <InstagramVideosSection
        displayMode="grid"
        maxVisible={6}
        showViewAll={true}
        title="Real Events, Real Moments"
        subtitle="See our recent hibachi experiences from satisfied customers across Los Angeles"
      />


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
                    "Our cancellation policy includes the following terms: 72 hours' notice required for cancellations or reschedules to receive a full deposit refund. Changes made inside 72 hours may make the deposit non-refundable. For rainy days, we can provide a complimentary tent for the chef setup. If you still need to cancel due to weather, please let us know at least 72 hours beforehand.",
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
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
                <Button asChild className="bg-white text-amber-700 hover:bg-amber-50 min-w-[170px]">
                  <Link href="/quoteA">Get Instant Quote</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="min-w-[170px] border-white text-white bg-transparent hover:bg-white/10 hover:text-white"
                >
                  <Link href="/book">Book Now</Link>
                </Button>
              </div>
            </AnimateOnScroll>

            <AnimateOnScroll direction="up" delay={200}>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">

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

          </div>
        </section>
      </AnimateOnScroll>

      {/* Testimonials Section */}
      <TestimonialsSection />
    </div>
  )
}
