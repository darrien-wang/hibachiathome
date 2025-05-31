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
        stars.push(<Star key={i} className="h-5 w-5 fill-amber-400 text-amber-400 animate-pulse" />)
      } else {
        stars.push(<Star key={i} className="h-5 w-5 text-gray-300" />)
      }
    }
    return stars
  }

  return (
    <section
      id="testimonials-section"
      className="py-16 relative overflow-hidden min-h-[600px]"
      style={{
        backgroundImage: `url('/images/fire-background.png')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Dark overlay to ensure text readability */}
      <div className="absolute inset-0 bg-black/10 backdrop-blur-[0.2px]"></div>

      {/* Additional fire atmosphere overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-orange-900/20 via-transparent to-red-900/20 pointer-events-none"></div>

      <div className="container mx-auto px-4 relative z-10">
        <AnimateOnScroll direction="down">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-energy font-bold text-center mb-4 text-white fire-text-glow">
              WHAT OUR <span className="fire-text-gradient">CUSTOMERS SAY</span>
            </h2>
            <p className="text-amber-100 text-lg max-w-2xl mx-auto">
              Real experiences from real customers who brought the hibachi fire to their events
            </p>
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
                  className={`bg-black/60 backdrop-blur-sm rounded-xl shadow-2xl p-6 w-full transition-all duration-500 border border-orange-500/30 hover:border-orange-400/60 hover:shadow-2xl hover:shadow-orange-500/30 hover:bg-black/70 ${
                    index === currentTestimonial
                      ? "scale-105 border-2 border-orange-400 shadow-2xl shadow-orange-500/40 bg-black/70"
                      : (isLargeScreen || isMediumScreen)
                        ? "scale-100 opacity-95 hover:scale-102"
                        : "scale-100 opacity-80 hover:opacity-95"
                  }`}
                  onClick={() => setCurrentTestimonial(index)}
                >
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center text-white font-bold text-lg mr-3 shadow-lg ring-2 ring-orange-400/50">
                      {testimonial.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-amber-100 text-lg">{testimonial.name}</h4>
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
                  <div className="flex mb-4">{renderStars(testimonial.rating)}</div>
                  <p className="text-amber-50 text-sm leading-relaxed font-medium">{testimonial.text}</p>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
