"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { getSortedHeroImages, carouselConfig } from "@/config/hero-images"

export default function HeroCarousel() {
  const images = getSortedHeroImages()
  const [currentIndex, setCurrentIndex] = useState(0)

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

  return (
    <div className="relative w-full h-[500px] overflow-hidden">
      {images.map((image, index) => (
        <div
          key={image.url}
          className={`absolute w-full h-full transition-opacity duration-${carouselConfig.transition}`}
          style={{
            opacity: index === currentIndex ? 1 : 0,
            zIndex: index === currentIndex ? 10 : 0,
            transition: `opacity ${carouselConfig.transition}ms ease-in-out`,
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
