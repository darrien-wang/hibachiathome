"use client"
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { getOrAssignVariant } from "@/lib/ab-testing"
import { trackEvent } from "@/lib/tracking"
import { getSortedHeroImages, carouselConfig } from "@/config/hero-images"

export default function HeroSection() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [imagesLoaded, setImagesLoaded] = useState(false)
  const [imageTimestamps, setImageTimestamps] = useState<string[]>([])
  const [autoplayEnabled, setAutoplayEnabled] = useState(false)
  const [userInteracted, setUserInteracted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const firstSlideTimerRef = useRef<NodeJS.Timeout | null>(null)
  const autoplayTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [touchStart, setTouchStart] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const [swipeDistance, setSwipeDistance] = useState(0)
  const [headlineVariant, setHeadlineVariant] = useState<string>("control")
  const [ctaVariant, setCtaVariant] = useState<string>("control")
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

  // 检测移动端
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768) // md breakpoint
    }
    
    if (typeof window !== "undefined") {
      checkMobile()
      window.addEventListener('resize', checkMobile)
      return () => window.removeEventListener('resize', checkMobile)
    }
  }, [])

  useEffect(() => {
    const assignedHeadlineVariant = getOrAssignVariant("hero_headline")
    const assignedCtaVariant = getOrAssignVariant("primary_cta_copy")

    setHeadlineVariant(assignedHeadlineVariant)
    setCtaVariant(assignedCtaVariant)

    trackEvent("ab_test_exposure", {
      experiment_id: "hero_headline",
      variant_id: assignedHeadlineVariant,
      experiment_surface: "hero_section",
    })
    trackEvent("ab_test_exposure", {
      experiment_id: "primary_cta_copy",
      variant_id: assignedCtaVariant,
      experiment_surface: "hero_section",
    })
  }, [])

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

  const headlineText =
    headlineVariant === "chef_story"
      ? "Private Chef. Live Hibachi Show. Easy Hosting."
      : "Want a Party? One Call, That's All."
  const primaryCtaText = "Get Instant Quote"

  const handlePrimaryCtaClick = () => {
    trackEvent("ab_test_conversion", {
      experiment_id: "hero_headline",
      variant_id: headlineVariant,
      conversion_event: "hero_primary_cta_click",
    })
    trackEvent("ab_test_conversion", {
      experiment_id: "primary_cta_copy",
      variant_id: ctaVariant,
      conversion_event: "hero_primary_cta_click",
    })
    trackEvent("lead_start", { contact_surface: "hero_primary_cta" })
  }

  const handleSecondaryCtaClick = () => {
    trackEvent("menu_view", { cta_surface: "hero_secondary_cta" })
  }

  return (
    <section className="relative h-screen min-h-[600px] flex items-center justify-center">
      {/* 移动端视频背景 */}
      {isMobile ? (
        <div className="absolute inset-0 overflow-hidden bg-black z-0">
          <video
            className="w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            poster="/images/hibachi-dinner-party.jpg"
          >
            <source src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/git-blob/prj_uq6V65eQcr9o6oIao946e8dPfR9o/1FpnWn5XCebSoLHXdVLIqc/public/video/00ebf7a19327d6f30078329b3e163952.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          {/* 视频遮罩层 */}
          <div className="absolute inset-0 bg-black/30"></div>
        </div>
      ) : (
        /* 桌面端Instagram Stories风格视频 */
        <div className="absolute inset-0 overflow-hidden bg-black z-0">
          {/* 模糊背景视频 */}
          <video
            className="absolute inset-0 w-full h-full object-cover blur-lg scale-110"
            autoPlay
            muted
            loop
            playsInline
            poster="/images/hibachi-dinner-party.jpg"
          >
            <source src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/git-blob/prj_uq6V65eQcr9o6oIao946e8dPfR9o/1FpnWn5XCebSoLHXdVLIqc/public/video/00ebf7a19327d6f30078329b3e163952.mp4" type="video/mp4" />
          </video>
          
          {/* 深色遮罩 */}
          <div className="absolute inset-0 bg-black/50"></div>
          
          {/* 中心清晰视频 */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative h-full max-w-[500px] w-full max-h-[90vh] aspect-[9/16] bg-black rounded-lg overflow-hidden shadow-2xl">
              <video
                className="w-full h-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                poster="/images/hibachi-dinner-party.jpg"
              >
                <source src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/git-blob/prj_uq6V65eQcr9o6oIao946e8dPfR9o/1FpnWn5XCebSoLHXdVLIqc/public/video/00ebf7a19327d6f30078329b3e163952.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
              
              {/* 轻微的边框效果 */}
              <div className="absolute inset-0 border border-white/10 rounded-lg pointer-events-none"></div>
            </div>
          </div>
        </div>
      )}

      {/* Remove the full overlay div */}

      <div
        className={`container mx-auto px-4 relative z-30 text-center text-white h-full flex flex-col justify-start py-16 transition-opacity duration-1000`}
      >
        <div
          className="relative max-w-3xl mx-auto"
          style={{ marginTop: isMobile ? "calc(24vh - 80px)" : "calc(14vh - 40px)", fontFamily: "var(--font-montserrat)" }}
        >
          <p className="text-base md:text-lg font-semibold tracking-wide text-amber-200 drop-shadow">Private Hibachi Catering</p>
          <h1 className="mt-2 text-5xl md:text-7xl font-extrabold leading-[0.95] tracking-tight text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.55)]">
            Top Rated
            <br />
            Hibachi At Home
            <br />
            Experience
          </h1>
          <p className="mt-4 text-2xl md:text-4xl font-bold text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.5)]">
            Book Your Backyard Hibachi Catering Today
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4">
            <Button
              asChild
              onClick={handlePrimaryCtaClick}
              className="bg-white text-black hover:bg-white/90 min-w-[240px] rounded-full h-14 text-lg font-extrabold tracking-wide"
            >
              <Link href="/quote">{primaryCtaText}</Link>
            </Button>
            <Link href="/menu" onClick={handleSecondaryCtaClick} className="text-white/85 text-sm underline underline-offset-4 hover:text-white">
              View Menu
            </Link>
          </div>
        </div>

        <div className="mt-auto mb-12 md:mb-20 animate-slideUp relative"></div>
      </div>

      {/* 桌面端不再需要轮播控制 - 现在统一使用视频 */}
    </section>
  )
}
