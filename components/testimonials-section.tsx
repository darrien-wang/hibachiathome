"use client"
import { useState, useEffect, useRef } from "react"
import { Star } from "lucide-react"
import { AnimateOnScroll } from "@/components/animate-on-scroll"

// Verbatim 5-star Google reviews from the Real Hibachi listing (owner-supplied,
// 2026-08) — same source as the /quote review wall. Real names, real chefs; do
// not attach invented dates or locations to these.
const testimonials = [
  {
    name: "Kelsey Molnar",
    text: "Real Hibachi is such a fun experience! I decided to hire for my sisters 30th bday and it was an absolute success! We had Chef Bling and he was a riot and so sweet! I told him it was a surprise and he made it SO FUN! HIGHLY RECOMMEND, HIGHLY AFFORDABLE, so delicious…",
    rating: 5,
  },
  {
    name: "Lisa Craven",
    text: "Chef blue was absolutely amazing!!! Super friendly and personable. So fun and interactive. Knew how to switch it up between adults and kids. Food was delicious and he was great! Highly recommend !",
    rating: 5,
  },
  {
    name: "Judy Gothelf",
    text: "What a great experience having Blue as our chef! Aside from the fact that he made delicious food, he was so much fun and so engaging! We loved having him here to celebrate our friend's BIG birthday!",
    rating: 5,
  },
  {
    name: "Beatrix Barrera",
    text: "Chef John was our personal chef and he was sooooo much fun. I highly recommend requesting for him because aside from the delicious food, there was so much laughing because of him. 5 stars for the service, 5 stars for the food, 5 stars for Chef John! Definitely will do this again!",
    rating: 5,
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
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-gray-900">
              Real Reviews, Real Parties
            </h2>
            <p className="mt-2 text-sm text-gray-600">Verbatim 5-star Google reviews from SoCal events</p>
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
                        <img
                          src="https://www.google.com/favicon.ico"
                          alt="Google review"
                          className="h-4"
                        />
                        <span className="ml-1.5 text-xs text-gray-500">Google review</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex mb-3">{renderStars(testimonial.rating)}</div>
                  <p className="text-gray-700 text-sm">{testimonial.text}</p>
                </div>
              </AnimateOnScroll>
            ))}
          </div>

        </div>
      </div>
    </section>
  )
}
