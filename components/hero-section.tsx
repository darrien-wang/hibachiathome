"use client"
import React, { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { getSortedHeroImages, carouselConfig } from "@/config/hero-images"

export default function HeroSection() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [imagesLoaded, setImagesLoaded] = useState(false)
  const [imageTimestamps, setImageTimestamps] = useState<string[]>([])
  const [autoplayEnabled, setAutoplayEnabled] = useState(false)
  const [userInteracted, setUserInteracted] = useState(false)
  const [firstSlideTimer, setFirstSlideTimer] = useState<NodeJS.Timeout | null>(null)
  const autoplayTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [touchStart, setTouchStart] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const [swipeDistance, setSwipeDistance] = useState(0)
  const swipeThreshold = 50
  const sortedHeroImages = useState(() => getSortedHeroImages())[0]

  const handleUserInteraction = () => {
    if (!userInteracted) {
      setUserInteracted(true)
      if (carouselConfig.autoplayAfterInteraction) {
        setAutoplayEnabled(true)
      }
    }
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
    // 预加载图片
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
    loadImagesOnce()
  }, [sortedHeroImages.length, imagesLoaded])

  useEffect(() => {
    if (sortedHeroImages.length > 0 && imageTimestamps.length === 0) {
      const timestamps = sortedHeroImages.map((image, index) => {
        // @ts-ignore
        return (
          image.timestamp ||
          `2025-${String(index + 1).padStart(2, "0")}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, "0")}`
        )
      })
      setImageTimestamps(timestamps)
    }
  }, [sortedHeroImages.length, imageTimestamps.length])

  useEffect(() => {
    if (sortedHeroImages.length > 0 && sortedHeroImages[0].duration) {
      const timer = setTimeout(() => {
        if (!userInteracted) {
          setCurrentSlide(1 % sortedHeroImages.length)
        }
      }, sortedHeroImages[0].duration)
      setFirstSlideTimer(timer)
    }
    return () => {
      if (firstSlideTimer) {
        clearTimeout(firstSlideTimer)
      }
      if (autoplayTimerRef.current) {
        clearInterval(autoplayTimerRef.current)
      }
    }
  }, [sortedHeroImages, userInteracted])

  useEffect(() => {
    if (sortedHeroImages.length > 0 && autoplayEnabled) {
      if (autoplayTimerRef.current) {
        clearInterval(autoplayTimerRef.current)
      }
      autoplayTimerRef.current = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % sortedHeroImages.length)
      }, carouselConfig.interval)
      return () => {
        if (autoplayTimerRef.current) {
          clearInterval(autoplayTimerRef.current)
        }
      }
    }
  }, [sortedHeroImages.length, autoplayEnabled])

  return (
    <section className="relative h-screen min-h-[600px] flex items-center justify-center">
      <div
        className="absolute inset-0 overflow-hidden bg-black z-0 touch-pan-y"
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
            />
            <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1 rounded-md text-sm font-mono z-10">
              {imageTimestamps[index] || "Loading..."}
            </div>
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-black/60 z-10"></div>
      <div className="container mx-auto px-4 relative z-20 text-center text-white h-full flex flex-col justify-start py-16 overflow-x-hidden">
        <div className="mt-40 md:mt-64 flex justify-center items-center w-full">
          <h1
            className="text-5xl md:text-7xl font-bold mb-6 tracking-wide leading-tight mx-auto max-w-4xl animate-fadeIn"
            style={{ fontFamily: "'Permanent Marker', cursive", textShadow: "0 4px 8px rgba(0,0,0,0.5)" }}
          >
            Let{'`'}s throw a{" "}
            <span
              style={{
                fontFamily: "'Permanent Marker', cursive",
                textShadow: "0 4px 8px rgba(0,0,0,0.5)",
                color: "rgb(216, 128, 54)",
              }}
            >
              HIBACHI party
            </span>{" "}
            today!
          </h1>
        </div>
        <div className="mt-auto mb-12 md:mb-20 animate-slideUp">
          <div className="flex flex-col sm:flex-row justify-center gap-4 md:gap-6 max-w-2xl mx-auto">
            <Button
              asChild
              size="lg"
              className="text-lg py-6 px-8 bg-primary hover:bg-primary/90 rounded-full border-2 border-primary shadow-lg hover:shadow-xl transition-all duration-300 w-full sm:w-2/3"
              onClick={handleUserInteraction}
            >
              <Link href="/estimation">Free Estimate</Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="text-lg py-6 px-8 bg-white/10 text-white border border-white/70 hover:bg-white/20 transition-colors duration-300 rounded-full w-full sm:w-1/3"
              onClick={handleUserInteraction}
            >
              <Link href="/menu">Packages</Link>
            </Button>
          </div>
          <p className="text-sm md:text-base max-w-xl mx-auto mt-4 font-light opacity-90">
            Top-tier food & service. No hidden fees. From $599.
          </p>
        </div>
      </div>
      {/* 轮播控制按钮 */}
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