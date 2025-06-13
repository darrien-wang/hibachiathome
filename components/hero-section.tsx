"use client"
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { getSortedHeroImages, carouselConfig } from "@/config/hero-images"

export default function HeroSection() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [imagesLoaded, setImagesLoaded] = useState(false)
  const [imageTimestamps, setImageTimestamps] = useState<string[]>([])
  const [autoplayEnabled, setAutoplayEnabled] = useState(false)
  const [userInteracted, setUserInteracted] = useState(false)
  const firstSlideTimerRef = useRef<NodeJS.Timeout | null>(null)
  const autoplayTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [touchStart, setTouchStart] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const [swipeDistance, setSwipeDistance] = useState(0)
  const swipeThreshold = 50

  // Fix: Correctly initialize heroImagesRef with a computed value, not a function
  const heroImagesRef = useRef(
    getSortedHeroImages()
      .filter((_, index) => index !== 0 && index !== 4)
      .concat({
        url: "/images/hibachi-dinner-party.jpg",
        alt: "Hibachi dinner party with friends enjoying a meal outdoors",
        priority: 10, // Lower priority to ensure it's added at the end
      }),
  )

  const sortedHeroImages = heroImagesRef.current
  const carouselIntervalOverride = 3000 // 3 seconds instead of default
  const videoEnded = true

  const handleUserInteraction = () => {
    if (!userInteracted) {
      setUserInteracted(true)
      if (carouselConfig.autoplayAfterInteraction) {
        setAutoplayEnabled(true)
      }
    }
  }

  const handleFirstInteraction = () => {
    handleUserInteraction()
  }

  const nextSlide = () => {
    handleUserInteraction()
    setCurrentSlide((prev) => (prev + 1) % sortedHeroImages.length)
  }

  const prevSlide = () => {
    handleUserInteraction()
    setCurrentSlide((prev) => (prev - 1 + sortedHeroImages.length) % sortedHeroImages.length)
  }

  useEffect(() => {
    // Preload images
    const loadImagesOnce = async () => {
      if (sortedHeroImages.length > 0 && !imagesLoaded) {
        const promises = sortedHeroImages.map((image) => {
          return new Promise((resolve) => {
            const img = new window.Image()
            img.src = image.url
            img.onload = resolve
          })
        })
        await Promise.all(promises)
        setImagesLoaded(true)
      }
    }

    if (typeof window !== "undefined") {
      loadImagesOnce()
    }
  }, [imagesLoaded]) // Remove sortedHeroImages from dependencies

  useEffect(() => {
    if (sortedHeroImages.length > 0 && imageTimestamps.length === 0) {
      // Get current date
      const currentDate = new Date()
      const currentYear = currentDate.getFullYear()
      const currentMonth = currentDate.getMonth() + 1 // JavaScript months are 0-indexed
      const currentDay = currentDate.getDate()

      const timestamps = sortedHeroImages.map((image, index) => {
        // Use image timestamp if available
        if (image.timestamp) return image.timestamp

        // Generate a random past date within the last 3 months
        const randomMonthsAgo = Math.floor(Math.random() * 3) // 0-2 months ago
        const randomDaysAgo = Math.floor(Math.random() * 28) + 1 // 1-28 days

        let dateMonth = currentMonth - randomMonthsAgo
        let dateYear = currentYear

        // Handle month rollover
        if (dateMonth <= 0) {
          dateMonth += 12
          dateYear -= 1
        }

        // Ensure day doesn't exceed current day for current month
        let dateDay = randomDaysAgo
        if (dateMonth === currentMonth && dateDay > currentDay) {
          dateDay = Math.min(currentDay, randomDaysAgo)
        }

        return `${dateYear}-${String(dateMonth).padStart(2, "0")}-${String(dateDay).padStart(2, "0")}`
      })

      setImageTimestamps(timestamps)
    }
  }, [imageTimestamps.length]) // Remove sortedHeroImages from dependencies

  useEffect(() => {
    if (sortedHeroImages.length > 0 && sortedHeroImages[0].duration && videoEnded && !userInteracted) {
      // Clear any existing timer
      if (firstSlideTimerRef.current) {
        clearTimeout(firstSlideTimerRef.current)
      }

      // Set new timer
      firstSlideTimerRef.current = setTimeout(() => {
        setCurrentSlide(0)
      }, 5000) // Use a default duration since the first image with duration is now removed
    }

    return () => {
      if (firstSlideTimerRef.current) {
        clearTimeout(firstSlideTimerRef.current)
      }
    }
  }, [userInteracted, videoEnded]) // Remove sortedHeroImages from dependencies

  useEffect(() => {
    if (sortedHeroImages.length > 0 && autoplayEnabled && videoEnded) {
      if (autoplayTimerRef.current) {
        clearInterval(autoplayTimerRef.current)
      }
      autoplayTimerRef.current = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % sortedHeroImages.length)
      }, carouselIntervalOverride) // Use the faster interval override
    }

    return () => {
      if (autoplayTimerRef.current) {
        clearInterval(autoplayTimerRef.current)
      }
    }
  }, [autoplayEnabled, videoEnded]) // Remove sortedHeroImages from dependencies

  return (
    <section className="relative h-screen min-h-[600px] flex items-center justify-center">
      {/* 原有的轮播图内容 */}
      <div
        className={`absolute inset-0 overflow-hidden bg-black z-0 touch-pan-y transition-opacity duration-1000`}
        onTouchStart={(e) => {
          const touch = e.touches[0]
          setTouchStart(touch.clientX)
          setIsSwiping(true)
        }}
        onTouchMove={(e) => {
          if (!isSwiping) return
          const touch = e.touches[0]
          const currentX = touch.clientX
          const diff = currentX - touchStart
          setSwipeDistance(diff)
        }}
        onTouchEnd={() => {
          setIsSwiping(false)
          if (swipeDistance > 80) {
            prevSlide()
          } else if (swipeDistance < -80) {
            nextSlide()
          }
          setSwipeDistance(0)
          handleUserInteraction()
        }}
      >
        {!imagesLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        {sortedHeroImages.map((image, index) => (
          <div
            key={index}
            className="absolute inset-0"
            style={{
              opacity: index === currentSlide ? 1 : 0,
              transform: index === currentSlide && isSwiping ? `translateX(${swipeDistance}px)` : "translateX(0)",
              transition: isSwiping ? "none" : "opacity 1s ease, transform 0.3s ease",
            }}
          >
            <img
              src={image.url || "/placeholder.svg"}
              alt={image.alt || `Hero slide ${index + 1}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1 rounded-md text-sm font-mono z-10">
              {imageTimestamps[index] || "Loading..."}
            </div>
          </div>
        ))}
      </div>

      {/* Remove the full overlay div */}

      <div
        className={`container mx-auto px-4 relative z-20 text-center text-white h-full flex flex-col justify-start py-16 transition-opacity duration-1000`}
      >
        <div className="relative max-w-3xl mx-auto" style={{ marginTop: "25vh" }}>
          <div
            className="bg-red-600 text-white py-3 px-6 rounded-md transform rotate-[-1deg] shadow-lg border-2 border-yellow-400"
            style={{
              backgroundImage: "linear-gradient(135deg, #e53e3e 0%, #c53030 100%)",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.25), 0 0 0 2px rgba(255, 215, 0, 0.3)",
            }}
          >
            <p className="text-xl md:text-2xl font-bold tracking-wide">🎉3 Minutes! Throw a Party. Just Show Up 🎉</p>
          </div>
        </div>

        <div className="mt-auto mb-12 md:mb-20 animate-slideUp relative">
          {/* Frosted glass overlay for button area */}
          <div className="absolute inset-0 backdrop-blur-md bg-white/20 rounded-lg -m-8 border border-white/30"></div>
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row justify-center gap-4 md:gap-6 max-w-2xl mx-auto">
              <Button
                asChild
                size="lg"
                className="text-lg py-6 px-8 bg-primary hover:bg-primary/90 rounded-full border-2 border-primary shadow-lg hover:shadow-xl transition-all duration-300 w-full sm:w-2/3"
                onClick={handleFirstInteraction}
              >
                <Link href="/estimation">Build Your Hibachi Party</Link>
              </Button>
              <Button
                asChild
                size="lg"
                className="text-lg py-6 px-8 bg-white text-amber-600 border-2 border-amber-500 hover:bg-amber-600 hover:text-white shadow-lg hover:shadow-xl transition-colors duration-300 rounded-full w-full sm:w-1/3"
                onClick={handleFirstInteraction}
              >
                <Link href="/menu">See What's on the Grill</Link>
              </Button>
            </div>
            <p className="text-sm md:text-base max-w-xl mx-auto mt-4 font-light opacity-90">
              Top-tier food & service. No hidden fees. From $499.
            </p>
          </div>
        </div>
      </div>

      {/* 轮播控制按钮 */}
      <div>
        <button
          onClick={prevSlide}
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/30 text-white p-2 rounded-full z-20 hover:bg-black/50"
          aria-label="Previous slide"
        >
          ←
        </button>
        <button
          onClick={nextSlide}
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/30 text-white p-2 rounded-full z-20 hover:bg-black/50"
          aria-label="Next slide"
        >
          →
        </button>
      </div>

      {/* 轮播指示器 */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2 z-20">
        {sortedHeroImages.map((_, index) => (
          <button
            key={index}
            onClick={() => {
              handleUserInteraction()
              setCurrentSlide(index)
            }}
            className={`w-3 h-3 rounded-full ${index === currentSlide ? "bg-white" : "bg-white/50"}`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      {/* 滑动指示器 - 仅在滑动时显示 */}
      {isSwiping && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-4 z-30 pointer-events-none">
          <div
            className={`p-4 bg-black/30 rounded-full transition-opacity ${swipeDistance > 50 ? "opacity-100" : "opacity-30"}`}
          >
            <span className="text-white text-2xl">←</span>
          </div>
          <div
            className={`p-4 bg-black/30 rounded-full transition-opacity ${swipeDistance < -50 ? "opacity-100" : "opacity-30"}`}
          >
            <span className="text-white text-2xl">→</span>
          </div>
        </div>
      )}
    </section>
  )
}
