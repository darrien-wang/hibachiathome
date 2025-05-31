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
  const [firstSlideTimer, setFirstSlideTimer] = useState<NodeJS.Timeout | null>(null)
  const autoplayTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [touchStart, setTouchStart] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const [swipeDistance, setSwipeDistance] = useState(0)
  const [showVideo, setShowVideo] = useState(true)
  const [videoEnded, setVideoEnded] = useState(false)
  const [isMuted, setIsMuted] = useState(false) // 默认不静音
  const [isMobile, setIsMobile] = useState(false)
  const [isPortrait, setIsPortrait] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const swipeThreshold = 50
  const sortedHeroImages = useState(() => getSortedHeroImages())[0]

  // 检测设备类型和屏幕方向
  useEffect(() => {
    if (typeof window !== "undefined") {
      const checkDevice = () => {
        const userAgent = navigator.userAgent.toLowerCase()
        const mobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(userAgent)
        const portrait = window.innerHeight > window.innerWidth

        setIsMobile(mobile)
        setIsPortrait(portrait)
      }

      checkDevice()
      window.addEventListener("resize", checkDevice)
      window.addEventListener("orientationchange", checkDevice)

      return () => {
        window.removeEventListener("resize", checkDevice)
        window.removeEventListener("orientationchange", checkDevice)
      }
    }
  }, [])

  // 根据设备和方向选择视频
  const getVideoSource = () => {
    if (isMobile || isPortrait) {
      return "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachi%20video/realhibachi_fire_opening_mobile%20-%20Compressed%20with%20FlexClip%20%281%29-6GzUXJw2lM1Epus9x4E1fU8aVl80q0.mp4"
    }
    return "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachi%20video/realhibachi_fire_opening_desktop%20-%20Compressed%20with%20FlexClip-liz7pwPLKPl2zvYoTBjiebEvWAAxJS.mp4"
  }

  const handleUserInteraction = () => {
    if (!userInteracted) {
      setUserInteracted(true)
      if (carouselConfig.autoplayAfterInteraction) {
        setAutoplayEnabled(true)
      }
    }
  }

  const handleVideoEnd = () => {
    setVideoEnded(true)
    setShowVideo(false)
    handleUserInteraction()
  }

  const handleSkipVideo = () => {
    setShowVideo(false)
    setVideoEnded(true)
    if (videoRef.current) {
      videoRef.current.pause()
    }
    handleUserInteraction()
  }

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted
      setIsMuted(videoRef.current.muted)
    }
  }

  // 启用音频播放 - 用户交互后
  const enableAudio = async () => {
    if (videoRef.current && !audioEnabled) {
      try {
        videoRef.current.muted = false
        setIsMuted(false)
        setAudioEnabled(true)
        await videoRef.current.play()
      } catch (error) {
        console.log("Audio enable failed:", error)
      }
    }
  }

  // 处理用户首次点击/触摸 - 启用音频
  const handleFirstInteraction = () => {
    enableAudio()
    handleUserInteraction()
  }

  // 处理视频错误
  const handleVideoError = (error: any) => {
    console.error("Video error:", error)
    setVideoError(true)
    handleVideoEnd() // 跳过视频，显示轮播图
  }

  // 视频播放逻辑
  useEffect(() => {
    const playVideo = async () => {
      if (videoRef.current && showVideo && typeof window !== "undefined" && !videoError && videoLoaded) {
        try {
          // 首先尝试不静音播放
          videoRef.current.muted = false
          setIsMuted(false)
          await videoRef.current.play()
          setAudioEnabled(true)
        } catch (error) {
          console.log("Autoplay with sound blocked, trying muted playback")
          // 如果被阻止，则静音播放
          if (videoRef.current) {
            videoRef.current.muted = true
            setIsMuted(true)
            try {
              await videoRef.current.play()
            } catch (mutedError) {
              console.error("Video play failed completely:", mutedError)
              handleVideoEnd()
            }
          }
        }
      }
    }

    if (showVideo && !videoError && videoLoaded) {
      playVideo()
    }
  }, [showVideo, videoError, videoLoaded])

  // 当设备类型或方向改变时重新加载视频
  useEffect(() => {
    if (videoRef.current && showVideo && typeof window !== "undefined" && !videoError) {
      const video = videoRef.current

      // 暂停当前视频
      video.pause()

      // 设置新的视频源
      const newSource = getVideoSource()
      video.src = newSource

      // 重置状态
      setVideoLoaded(false)

      // 添加事件监听器
      const handleCanPlay = () => {
        setVideoLoaded(true)
      }

      const handleLoadedData = () => {
        console.log("Video loaded successfully")
      }

      const handleError = (e: Event) => {
        console.error("Video loading error:", e)
        handleVideoError(e)
      }

      video.addEventListener("canplay", handleCanPlay)
      video.addEventListener("loadeddata", handleLoadedData)
      video.addEventListener("error", handleError)

      // 开始加载视频
      video.load()

      // 清理函数
      return () => {
        video.removeEventListener("canplay", handleCanPlay)
        video.removeEventListener("loadeddata", handleLoadedData)
        video.removeEventListener("error", handleError)
      }
    }
  }, [isMobile, isPortrait, showVideo, videoError])

  // 初始化视频
  useEffect(() => {
    if (videoRef.current && showVideo && typeof window !== "undefined") {
      const video = videoRef.current
      const source = getVideoSource()

      video.src = source

      const handleCanPlay = () => {
        setVideoLoaded(true)
      }

      const handleError = (e: Event) => {
        console.error("Initial video loading error:", e)
        handleVideoError(e)
      }

      video.addEventListener("canplay", handleCanPlay)
      video.addEventListener("error", handleError)

      video.load()

      return () => {
        video.removeEventListener("canplay", handleCanPlay)
        video.removeEventListener("error", handleError)
      }
    }
  }, [])

  // Auto-skip video after maximum duration
  useEffect(() => {
    if (showVideo && !videoError && videoLoaded) {
      const maxDuration = 3000 // 3 seconds maximum
      const timer = setTimeout(() => {
        console.log("Video auto-skipped after maximum duration")
        handleVideoEnd()
      }, maxDuration)

      return () => clearTimeout(timer)
    }
  }, [showVideo, videoError, videoLoaded])

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

    if (typeof window !== "undefined") {
      loadImagesOnce()
    }
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
    if (sortedHeroImages.length > 0 && sortedHeroImages[0].duration && videoEnded) {
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
  }, [sortedHeroImages, userInteracted, videoEnded])

  useEffect(() => {
    if (sortedHeroImages.length > 0 && autoplayEnabled && videoEnded) {
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
  }, [sortedHeroImages.length, autoplayEnabled, videoEnded])

  return (
    <section className="relative h-screen min-h-[600px] flex items-center justify-center">
      {/* 开场视频 */}
      {showVideo && !videoError && (
        <div className="absolute inset-0 z-50 bg-black">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            preload="metadata"
            crossOrigin="anonymous"
            onEnded={handleVideoEnd}
            onError={(e) => handleVideoError(e)}
            onLoadStart={() => {
              console.log("Video loading started")
            }}
            onCanPlay={() => {
              console.log("Video can play")
            }}
            key={`video-${isMobile}-${isPortrait}`} // 强制重新渲染当设备类型改变时
          >
            Your browser does not support the video tag.
          </video>

          {/* 视频加载指示器 */}
          {!videoLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {/* 控制按钮组 */}
          <div className={`absolute top-4 right-4 flex gap-2 z-10 ${isMobile ? "scale-90" : ""}`}>
            {/* 静音/取消静音按钮 */}
            <button
              onClick={toggleMute}
              className="bg-black/50 text-white p-2 rounded-full text-sm hover:bg-black/70 transition-colors"
              aria-label={isMuted ? "Unmute video" : "Mute video"}
            >
              {isMuted ? "🔇" : "🔊"}
            </button>

            {/* 跳过按钮 */}
            <button
              onClick={handleSkipVideo}
              className="bg-black/50 text-white px-4 py-2 rounded-full text-sm hover:bg-black/70 transition-colors"
            >
              Skip
            </button>
          </div>

          {/* 音频启用提示 - 仅在静音时显示 */}
          {isMuted && !audioEnabled && videoLoaded && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
              <button
                onClick={enableAudio}
                className="bg-black/70 text-white px-6 py-3 rounded-full text-sm hover:bg-black/90 transition-colors flex items-center gap-2"
              >
                🔊 Click to enable sound
              </button>
            </div>
          )}

          {/* 移动端底部提示 */}
          {isMobile && videoLoaded && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
              <p className="text-white/80 text-xs text-center bg-black/30 px-3 py-1 rounded-full">
                {isMuted ? "Tap to enable sound or skip" : "Tap to skip"}
              </p>
            </div>
          )}

          {/* 点击任意位置的处理 */}
          {videoLoaded && (
            <div
              className="absolute inset-0 cursor-pointer"
              onClick={isMuted && !audioEnabled ? enableAudio : handleSkipVideo}
              aria-label={isMuted && !audioEnabled ? "Click to enable sound" : "Click to skip video"}
              style={{ WebkitTapHighlightColor: "transparent" }} // 移除移动端点击高亮
            />
          )}
        </div>
      )}

      {/* 原有的轮播图内容 */}
      <div
        className={`absolute inset-0 overflow-hidden bg-black z-0 touch-pan-y transition-opacity duration-1000 ${
          showVideo && !videoError ? "opacity-0" : "opacity-100"
        }`}
        onTouchStart={(e) => {
          if (showVideo && !videoError) return
          const touch = e.touches[0]
          setTouchStart(touch.clientX)
          setIsSwiping(true)
        }}
        onTouchMove={(e) => {
          if (!isSwiping || (showVideo && !videoError)) return
          const touch = e.touches[0]
          const currentX = touch.clientX
          const diff = currentX - touchStart
          setSwipeDistance(diff)
        }}
        onTouchEnd={() => {
          if (showVideo && !videoError) return
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
        {!imagesLoaded && (!showVideo || videoError) && (
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

      <div
        className={`absolute inset-0 bg-black/60 z-10 transition-opacity duration-1000 ${
          showVideo && !videoError ? "opacity-0" : "opacity-100"
        }`}
      ></div>

      <div
        className={`container mx-auto px-4 relative z-20 text-center text-white h-full flex flex-col justify-start py-16 overflow-x-hidden transition-opacity duration-1000 ${
          showVideo && !videoError ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="mt-40 md:mt-64 flex justify-center items-center w-full">
          <h1
            className="text-5xl md:text-7xl font-bold mb-6 tracking-wide leading-tight mx-auto max-w-4xl animate-fadeIn"
            style={{ fontFamily: "'Permanent Marker', cursive", textShadow: "0 4px 8px rgba(0,0,0,0.5)" }}
          >
            Let{"`"}s throw a{" "}
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
              onClick={handleFirstInteraction}
            >
              <Link href="/estimation">Free Estimate</Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="text-lg py-6 px-8 bg-white/10 text-white border border-white/70 hover:bg-white/20 transition-colors duration-300 rounded-full w-full sm:w-1/3"
              onClick={handleFirstInteraction}
            >
              <Link href="/menu">Packages</Link>
            </Button>
          </div>
          <p className="text-sm md:text-base max-w-xl mx-auto mt-4 font-light opacity-90">
            Top-tier food & service. No hidden fees. From $499.
          </p>
        </div>
      </div>

      {/* 轮播控制按钮 */}
      {(!showVideo || videoError) && (
        <>
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
        </>
      )}

      {/* 轮播指示器 */}
      {(!showVideo || videoError) && (
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
      )}

      {/* 滑动指示器 - 仅在滑动时显示 */}
      {isSwiping && (!showVideo || videoError) && (
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
