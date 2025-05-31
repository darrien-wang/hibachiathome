"use client"
import { useState, useEffect, useRef } from "react"
import { Star } from "lucide-react"
import { AnimateOnScroll } from "@/components/animate-on-scroll"

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

export default function TestimonialsSection() {
  const [currentTestimonial, setCurrentTestimonial] = useState(0)
  const [isLargeScreen, setIsLargeScreen] = useState(false)
  const [isMediumScreen, setIsMediumScreen] = useState(false)
  const testimonialRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    setIsLargeScreen(window.innerWidth >= 1024)
    setIsMediumScreen(window.innerWidth >= 768 && window.innerWidth < 1024)
    const handleResize = () => {
      setIsLargeScreen(window.innerWidth >= 1024)
      setIsMediumScreen(window.innerWidth >= 768 && window.innerWidth < 1024)
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    testimonialRefs.current = testimonialRefs.current.slice(0, testimonials.length)
    const handleScroll = () => {
      if (!testimonialRefs.current.every(Boolean)) return
      if (isLargeScreen || isMediumScreen) return
      let closestCard = 0
      let minDistance = Number.POSITIVE_INFINITY
      testimonialRefs.current.forEach((ref, index) => {
        if (ref) {
          const rect = ref.getBoundingClientRect()
          const cardCenter = rect.top + rect.height / 2
          const viewportCenter = window.innerHeight / 2
          const distance = Math.abs(cardCenter - viewportCenter)
          if (distance < minDistance) {
            minDistance = distance
            closestCard = index
          }
        }
      })
      setCurrentTestimonial(closestCard)
    }
    window.addEventListener("scroll", handleScroll)
    handleScroll()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [isLargeScreen, isMediumScreen])

  useEffect(() => {
    if (isLargeScreen || isMediumScreen) {
      const interval = setInterval(() => {
        setCurrentTestimonial((prev) => (prev + 1) % testimonials.length)
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [isLargeScreen, isMediumScreen])

  const renderStars = (rating: number) => {
    const stars = []
    for (let i = 0; i < 5; i++) {
      if (i < rating) {
        stars.push(<Star key={i} className="h-5 w-5 fill-amber-400 text-amber-400" />)
      } else {
        stars.push(<Star key={i} className="h-5 w-5 text-gray-300" />)
      }
    }
    return stars
  }

  return (
    <section
      id="testimonials-section"
      className="py-12 bg-gradient-to-br from-gray-900 via-black to-gray-800 border-y border-orange-500/20 relative overflow-hidden"
    >
      {/* Add fire atmosphere overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-orange-900/10 via-red-900/5 to-yellow-900/10 pointer-events-none"></div>
      <div className="container mx-auto px-4 relative z-10">
        <AnimateOnScroll direction="down">
          <div className="flex flex-col items-center mb-8 hidden">
            <div className="flex items-center mb-2">
              <img
                src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/logo/google-reviews-png-10-GKGq4SGGN19lPvzMYHb6Rg1jvyOzJJ.png"
                alt="Google Reviews"
                className="h-8 mr-2"
                onError={(e) => {
                  e.currentTarget.src =
                    "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_92x30dp.png"
                  e.currentTarget.className = "h-6 mr-2"
                }}
              />
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="h-5 w-5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <span className="ml-2 font-medium">5.0</span>
            </div>
            <p className="text-sm text-gray-600">Based on 48 reviews</p>
          </div>
        </AnimateOnScroll>
        <div className="relative overflow-visible">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-4 stagger-container">
            {testimonials.map((testimonial, index) => (
              <AnimateOnScroll key={index} delay={index * 100} className="stagger-item">
                <div
                  ref={(el) => {
                    testimonialRefs.current[index] = el
                  }}
                  className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg shadow-xl p-6 w-full transition-all duration-500 border border-orange-500/20 hover:border-orange-400/40 hover:shadow-2xl hover:shadow-orange-500/20 ${
                    index === currentTestimonial
                      ? "scale-105 border-2 border-orange-400 shadow-2xl shadow-orange-500/30"
                      : (isLargeScreen || isMediumScreen)
                        ? "scale-100 opacity-90 hover:scale-102"
                        : "scale-100 opacity-70 hover:opacity-90"
                  }`}
                  onClick={() => setCurrentTestimonial(index)}
                >
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center text-white font-bold text-lg mr-3 shadow-lg">
                      {testimonial.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-medium text-amber-100 text-lg">{testimonial.name}</h4>
                      <div className="flex items-center">
                        <span className="text-xs text-orange-300 mr-2">{testimonial.date}</span>
                        <img
                          src="https://www.google.com/favicon.ico"
                          alt="Google"
                          className="h-4 opacity-80"
                          onError={(e) => {
                            e.currentTarget.src = "https://www.google.com/favicon.ico"
                            e.currentTarget.className = "h-3 opacity-80"
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex mb-3 animate-pulse">{renderStars(testimonial.rating)}</div>
                  <p className="text-amber-50 text-sm leading-relaxed">{testimonial.text}</p>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
