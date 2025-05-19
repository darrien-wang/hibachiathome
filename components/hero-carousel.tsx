"use client"

import type React from "react"

import { useState, useEffect, useCallback, useRef } from "react"
import Image from "next/image"
import { getSortedHeroImages, carouselConfig } from "@/config/hero-images"

export default function HeroCarousel() {
  const images = getSortedHeroImages()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [touchStart, setTouchStart] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const [swipeDistance, setSwipeDistance] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const nextSlide = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length)
  }, [images.length])

  const prevSlide = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + images.length) % images.length)
  }, [images.length])

  // 使用配置的间隔时间
  useEffect(() => {
    const interval = setInterval(nextSlide, carouselConfig.interval)
    return () => clearInterval(interval)
  }, [nextSlide])

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX)
    setIsSwiping(true)
    setSwipeDistance(0)
    console.log("Touch start detected")
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return
    const currentX = e.touches[0].clientX
    const diff = currentX - touchStart
    setSwipeDistance(diff)
    console.log("Swiping:", diff)
  }

  const handleTouchEnd = () => {
    console.log("Touch end, distance:", swipeDistance)
    setIsSwiping(false)

    // 如果滑动距离超过阈值，则切换幻灯片
    if (swipeDistance > 80) {
      // 向右滑动，显示上一张
      prevSlide()
    } else if (swipeDistance < -80) {
      // 向左滑动，显示下一张
      nextSlide()
    }

    // 重置滑动距离
    setSwipeDistance(0)
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[500px] overflow-hidden touch-pan-y"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {images.map((image, index) => (
        <div
          key={image.url}
          className="absolute w-full h-full"
          style={{
            opacity: index === currentIndex ? 1 : 0,
            zIndex: index === currentIndex ? 10 : 0,
            transform: index === currentIndex && isSwiping ? `translateX(${swipeDistance}px)` : "translateX(0)",
            transition: isSwiping ? "none" : `transform 0.3s ease, opacity ${carouselConfig.transition}ms ease-in-out`,
          }}
        >
          <Image
            src={image.url || "/placeholder.svg"}
            alt={image.alt}
            fill
            priority={index === 0}
            sizes="100vw"
            style={{ objectFit: "cover" }}
          />
        </div>
      ))}

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

      {/* 可选：添加轮播控制按钮 */}
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

      {/* 可选：添加轮播指示器 */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2 z-20">
        {images.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-3 h-3 rounded-full ${index === currentIndex ? "bg-white" : "bg-white/50"}`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
