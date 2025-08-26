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
      className="py-12 bg-gradient-to-r from-amber-50 to-orange-50 border-y border-amber-100"
    >
      <div className="container mx-auto px-4">
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
                  className={`bg-white rounded-lg shadow-md p-6 w-full transition-all duration-500 ${
                    index === currentTestimonial
                      ? "scale-105 border-2 border-amber-200"
                      : (isLargeScreen || isMediumScreen)
                        ? "scale-100 opacity-80"
                        : "scale-100 opacity-60"
                  }`}
                  onClick={() => setCurrentTestimonial(index)}
                >
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 flex items-center justify-center text-white font-bold text-lg mr-3">
                      {testimonial.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-medium">{testimonial.name}</h4>
                      <div className="flex items-center">
                        <span className="text-xs text-gray-500 mr-2">{testimonial.date}</span>
                        <img
                          src="https://www.google.com/favicon.ico"
                          alt="Google"
                          className="h-4"
                          onError={(e) => {
                            e.currentTarget.src = "https://www.google.com/favicon.ico"
                            e.currentTarget.className = "h-3"
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex mb-3">{renderStars(testimonial.rating)}</div>
                  <p className="text-gray-700 text-sm">{testimonial.text}</p>
                </div>
              </AnimateOnScroll>
            ))}
          </div>

          {/* Image showcase below testimonials */}
          <AnimateOnScroll direction="up" className="mt-12">
            <div className="flex justify-center">
              <div className="relative w-full max-w-4xl rounded-xl overflow-hidden shadow-lg">
                <img
                  src="/images/20250825183349_567_50.jpg"
                  alt="Hibachi chef taking selfie with happy customers celebrating in background"
                  className="w-full h-auto object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
                  <p className="text-white text-lg font-medium">Our chefs love celebrating with you!</p>
                </div>
              </div>
            </div>
          </AnimateOnScroll>
        </div>
      </div>
    </section>
  )
}
