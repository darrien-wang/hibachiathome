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
    router.push("/estimation?source=booking")
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

  return (
    <div>
      <HeroSection />
      {/* Package Options Section */}
      <AnimateOnScroll>
        <section className="py-16 bg-[#f7f4ec]">
          <div className="container mx-auto px-4">
            <AnimateOnScroll direction="down">
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-center mb-3 text-amber-700">How It Works</h2>
              <p className="text-4xl md:text-5xl font-serif font-bold text-center text-gray-900 max-w-4xl mx-auto leading-tight mb-5">
                We Bring Our Hibachi Grill + Chef to Your Backyard.
              </p>
              <p className="text-base md:text-lg text-center text-gray-600 max-w-3xl mx-auto mb-12">
                You pick the date and headcount. We handle the chef and cooking experience. For custom setup details,
                message support directly.
              </p>
            </AnimateOnScroll>

            <div className="grid gap-5 md:grid-cols-3 max-w-5xl mx-auto">
              <AnimateOnScroll direction="up">
                <div className="rounded-3xl bg-white border border-[#eadfcd] p-6 text-gray-700 shadow-md">
                  <h3 className="text-3xl font-serif font-bold mb-4 text-center text-[#B3261E]">Pricing</h3>
                  <div className="space-y-2 text-sm md:text-base text-center">
                    <p>$59.90 per adult</p>
                    <p>$29.95 per child (under 13, food portion)</p>
                    <p>$599 minimum for all events</p>
                    <p>Optional full setup: +$15 per guest</p>
                  </div>
                </div>
              </AnimateOnScroll>

              <AnimateOnScroll direction="up" delay={120}>
                <div className="rounded-3xl bg-white border border-[#eadfcd] p-6 text-gray-700 shadow-md">
                  <h3 className="text-3xl font-serif font-bold mb-4 text-center text-[#B3261E]">Protein Choices</h3>
                  <div className="space-y-2 text-sm md:text-base text-center">
                    <p>2 regular proteins included per guest</p>
                    <p>Chicken, Steak, Shrimp, Salmon, Tofu</p>
                    <p>Premium upgrades:</p>
                    <p>Scallops +$6, Filet Mignon +$8, Lobster Tail +$12</p>
                  </div>
                </div>
              </AnimateOnScroll>

              <AnimateOnScroll direction="up" delay={240}>
                <div className="rounded-3xl bg-white border border-[#eadfcd] p-6 text-gray-700 shadow-md">
                  <h3 className="text-3xl font-serif font-bold mb-4 text-center text-[#B3261E]">Included</h3>
                  <div className="space-y-2 text-sm md:text-base text-center">
                    <p>Fried rice, fresh vegetables, house salad</p>
                    <p>Chef performance and on-site grill cooking</p>
                    <p>Outdoor cooking setup only</p>
                    <p>Need custom details? Ask support.</p>
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
            <div className="max-w-3xl mx-auto bg-[#fffdf8] rounded-3xl overflow-hidden border border-[#e7dbc6] shadow-[0_10px_30px_rgba(120,80,20,0.08)]">
              <img
                src="/socal-map.png"
                alt="West coast map with Southern California highlighted"
                className="w-full h-auto bg-[#f7f2e7]"
                loading="lazy"
              />

              <div className="px-6 md:px-8 py-8 text-center">
                <h3 className="text-3xl font-montserrat font-bold tracking-tight text-amber-800 mb-3">WEST COAST</h3>
                <p className="text-stone-600 mb-6">
                  Arizona, California, Colorado, Nevada, New Mexico, Oregon, Utah, Washington.
                </p>

                <Button
                  asChild
                  className="rounded-full bg-amber-600 text-white px-8 min-w-[230px] h-12 hover:bg-amber-700"
                >
                  <Link href="/quote">GET INSTANT QUOTE</Link>
                </Button>

                <p className="mt-6 mb-3 text-sm font-medium tracking-wide text-stone-700">OR CALL TO BOOK</p>
                <a
                  href="tel:2137707788"
                  className="inline-flex items-center justify-center rounded-full border-2 border-amber-600 text-amber-700 px-8 min-w-[230px] h-12 font-semibold hover:bg-amber-50 transition-colors"
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

            <div className="mt-10 max-w-2xl mx-auto">
              <AnimateOnScroll delay={100} direction="up">
                <div className="bg-white p-6 rounded-lg shadow-md text-center">
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-amber-600 text-xl">🍚</span>
                  </div>
                  <h3 className="font-bold text-lg mb-2">Signature Fried Rice</h3>
                  <p className="text-gray-600">Garlic butter base, hibachi seasoning, live chef technique.</p>
                </div>
              </AnimateOnScroll>
            </div>

            <div className="mt-8 text-center">
              <p className="text-gray-600 text-sm mt-2">Included in every hibachi package.</p>
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

            <div className="mt-10 max-w-2xl mx-auto">
              <AnimateOnScroll delay={100} direction="up">
                <div className="bg-white p-6 rounded-lg shadow-md text-center border border-gray-100">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-blue-600 text-xl">🦐</span>
                  </div>
                  <h3 className="font-bold text-lg mb-2">Hibachi Shrimp</h3>
                  <p className="text-gray-600">Fresh jumbo shrimp, quick sear, clean seasoning.</p>
                </div>
              </AnimateOnScroll>
            </div>

            <div className="mt-8 text-center">
              <p className="text-gray-600 text-sm mt-2">Available in all hibachi packages.</p>
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

            <div className="mt-10 max-w-2xl mx-auto">
              <AnimateOnScroll delay={100} direction="up">
                <div className="bg-white p-6 rounded-lg shadow-md text-center border border-gray-100">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-red-600 text-xl">🥩</span>
                  </div>
                  <h3 className="font-bold text-lg mb-2">Hibachi Steak</h3>
                  <p className="text-gray-600">Selected cuts, high-heat sear, doneness by request.</p>
                </div>
              </AnimateOnScroll>
            </div>

            <div className="mt-8 text-center">
              <p className="text-gray-600 text-sm mt-2">Included in protein selections for all packages.</p>
            </div>
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
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
                <Button asChild className="bg-white text-amber-700 hover:bg-amber-50 min-w-[170px]">
                  <Link href="/quote">Get Instant Quote</Link>
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
