"use client"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useState, useEffect, useRef } from "react"
import { Star } from "lucide-react"
// 找到轮播图相关代码，修改轮播间隔时间
// 导入轮播配置
import { getSortedHeroImages, carouselConfig } from "@/config/hero-images"

// Testimonial data with ratings
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

export default function Home() {
  const [currentTestimonial, setCurrentTestimonial] = useState(0)
  const playerRef = useRef<any>(null)
  const [ctaVideoLoaded, setCtaVideoLoaded] = useState(false)
  const [isLargeScreen, setIsLargeScreen] = useState(false)
  const [isMediumScreen, setIsMediumScreen] = useState(false)
  const [animatedSteps, setAnimatedSteps] = useState([false, false, false])
  const [animationTriggered, setAnimationTriggered] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [imagesLoaded, setImagesLoaded] = useState(false)

  // 获取排序后的轮播图片
  const sortedHeroImages = getSortedHeroImages()

  const testimonialRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    // 初始检测
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 1024) // lg 断点
      setIsMediumScreen(window.innerWidth >= 768 && window.innerWidth < 1024) // md 断点
    }

    checkScreenSize()
    window.addEventListener("resize", checkScreenSize)

    // 添加滚动监听器来触发步骤动画
    const handleScroll = () => {
      const section = document.getElementById("how-it-works")
      if (section && !animationTriggered) {
        const sectionTop = section.getBoundingClientRect().top
        const windowHeight = window.innerHeight

        // Only trigger animation when scrolling down to the section
        if (sectionTop < windowHeight * 0.75) {
          // Set animation triggered to true to prevent repeating
          setAnimationTriggered(true)
          // 依次触发动画
          setTimeout(() => setAnimatedSteps([true, false, false]), 0)
          setTimeout(() => setAnimatedSteps([true, true, false]), 300)
          setTimeout(() => setAnimatedSteps([true, true, true]), 600)
        }
      }
    }

    window.addEventListener("scroll", handleScroll)
    // 初始检查，以防页面已经滚动到该位置
    handleScroll()

    // 清理函数
    return () => {
      window.removeEventListener("resize", checkScreenSize)
      window.removeEventListener("scroll", handleScroll)
    }
  }, [animationTriggered])

  // 添加自动轮播逻辑
  useEffect(() => {
    // 只在大屏幕或中等屏幕上启用自动轮播
    if (isLargeScreen || isMediumScreen) {
      const interval = setInterval(() => {
        setCurrentTestimonial((prev) => (prev + 1) % testimonials.length)
      }, 3000) // 每2秒切换一次

      return () => clearInterval(interval)
    }
  }, [isLargeScreen, isMediumScreen, testimonials.length])

  // 添加基于滚动位置的聚焦逻辑
  useEffect(() => {
    // 初始化引用数组
    testimonialRefs.current = testimonialRefs.current.slice(0, testimonials.length)

    const handleScroll = () => {
      // 如果引用还没准备好，直接返回
      if (!testimonialRefs.current.every(Boolean)) return

      // 大屏幕或中等屏幕上不使用滚动聚焦
      if (isLargeScreen || isMediumScreen) {
        return
      }

      let closestCard = 0
      let minDistance = Number.POSITIVE_INFINITY

      // 找到距离视口中心最近的卡片
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

      // 更新当前聚焦的卡片
      setCurrentTestimonial(closestCard)
    }

    // 添加滚动事件监听器
    window.addEventListener("scroll", handleScroll)
    // 初始检查
    handleScroll()

    return () => window.removeEventListener("scroll", handleScroll)
  }, [isLargeScreen, isMediumScreen, testimonials.length])

  // Function to render star ratings
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

  // 添加轮播图效果
  useEffect(() => {
    if (sortedHeroImages.length > 0) {
      const interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % sortedHeroImages.length)
      }, carouselConfig.interval)

      return () => clearInterval(interval)
    }
  }, [sortedHeroImages.length])

  // 预加载图片
  useEffect(() => {
    if (sortedHeroImages.length > 0) {
      const loadImages = async () => {
        const promises = sortedHeroImages.map((image) => {
          return new Promise((resolve) => {
            const img = new Image()
            img.src = image.url
            img.onload = resolve
          })
        })

        await Promise.all(promises)
        setImagesLoaded(true)
      }

      loadImages()
    }
  }, [sortedHeroImages])

  return (
    <>
      {/* Hero Section - Softer, more inviting style */}
      <section className="relative h-screen min-h-[600px] flex items-center justify-center">
        <div className="absolute inset-0 overflow-hidden bg-black z-0">
          {!imagesLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          {sortedHeroImages.map((image, index) => (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                index === currentSlide ? "opacity-100" : "opacity-0"
              }`}
            >
              <img
                src={image.url || "/placeholder.svg"}
                alt={image.alt || `Hero slide ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
        <div className="absolute inset-0 bg-black/50 z-10"></div>
        <div className="container mx-auto px-4 relative z-20 text-center text-white">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold mb-6 tracking-wide leading-tight">
            <span className="inline-block animate-fadeIn">REAL HIBACHI </span>
            <span className="text-[#F9A77C] inline-block animate-fireText relative">
              AT HOME
              <span className="absolute -bottom-1 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-[#F9A77C] to-amber-500 animate-fireUnderline"></span>
            </span>
          </h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto mb-8 font-sans tracking-wide">
            Top-tier food & service. No hidden fees. From $499.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 md:gap-6 w-[60%] mx-auto">
            <Button
              asChild
              size="lg"
              className="text-lg py-4 px-4 bg-primary hover:bg-primary/90 rounded-full border-2 border-primary w-4/5 mx-auto sm:w-1/2 sm:mx-0"
            >
              <Link href="/estimation">Free Estimate</Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="text-lg py-4 px-4 bg-white text-[#FF6600] border-2 border-[#FF6600] hover:bg-[#FF6600] hover:text-white transition-colors duration-300 rounded-full shadow-sm hover:shadow-md w-4/5 mx-auto sm:w-1/2 sm:mx-0"
            >
              <Link href="/menu">View Packages</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Google Reviews Section */}
      <section
        id="testimonials-section"
        className="py-12 bg-gradient-to-r from-amber-50 to-orange-50 border-y border-amber-100"
      >
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center mb-8">
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

          <div className="relative overflow-visible">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-4">
              {testimonials.map((testimonial, index) => (
                <div
                  key={index}
                  ref={(el) => (testimonialRefs.current[index] = el)}
                  className={`bg-white rounded-lg shadow-md p-6 w-full transition-all duration-500 ${
                    index === currentTestimonial
                      ? "scale-105 border-2 border-amber-200"
                      : (isLargeScreen || isMediumScreen)
                        ? "scale-100 opacity-80" // 大屏或中屏时非聚焦卡片样式
                        : "scale-100 opacity-60" // 小屏时非聚焦卡片样式
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
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Food Preparation Video Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-center mb-6">
            Watch Our <span className="text-primary">Chef in Action</span>
          </h2>
          <p className="text-lg text-center text-gray-600 max-w-3xl mx-auto mb-10">
            Experience the artistry and skill behind our authentic hibachi cooking
          </p>

          <div className="max-w-4xl mx-auto rounded-xl overflow-hidden shadow-2xl">
            <div className="relative pb-[56.25%] h-0">
              <video
                className="absolute top-0 left-0 w-full h-full object-cover"
                controls
                poster="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hero/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20250514132251-CecaVfadScFYbfD1eg3HcM8jTxxgzi.png"
              >
                <source
                  src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hero/splitfire-yi4XvpO3hkWlZOn2w4PCikuIV4N7oR.mp4"
                  type="video/mp4"
                />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-amber-600 font-medium">
              Our chefs bring the same excitement and culinary expertise to your home
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section - Enhanced with gradient background, timeline, and animations */}
      <section id="how-it-works" className="py-20 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-center mb-12">
            How It <span className="text-primary">Works</span>
          </h2>

          {/* Desktop Timeline View */}
          <div className="hidden md:block relative">
            {/* Timeline connector */}
            <div className="absolute top-24 left-0 right-0 h-1 bg-gradient-to-r from-amber-300 via-orange-400 to-amber-300 z-0"></div>

            <div className="grid grid-cols-3 gap-8 relative z-10">
              {/* Step 1 */}
              <div
                className={`transform transition-all duration-500 ${
                  animatedSteps[0] ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
                }`}
              >
                <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full">
                  <div className="flex justify-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-2xl font-serif font-bold mb-6 shadow-md">
                      1
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mb-3 font-serif text-center">Pick Your Menu</h3>
                  <p className="text-foreground/80 font-sans tracking-wide text-center mb-6">
                    Select from our Basic or Buffet packages based on your preferences and budget.
                  </p>
                  <div className="text-center">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="rounded-full border-amber-500 text-amber-600 hover:bg-amber-50"
                    >
                      <Link href="/menu">View Packages</Link>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div
                className={`transform transition-all duration-500 ${
                  animatedSteps[1] ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
                }`}
              >
                <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full">
                  <div className="flex justify-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-2xl font-serif font-bold mb-6 shadow-md">
                      2
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mb-3 font-serif text-center">Reserve Your Spot</h3>
                  <p className="text-foreground/80 font-sans tracking-wide text-center mb-6">
                    Choose your preferred date and time, and we'll confirm availability within 24 hours.
                  </p>
                  <div className="text-center">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="rounded-full border-amber-500 text-amber-600 hover:bg-amber-50"
                    >
                      <Link href="/book">Check Availability</Link>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div
                className={`transform transition-all duration-500 ${
                  animatedSteps[2] ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
                }`}
              >
                <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full">
                  <div className="flex justify-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-2xl font-serif font-bold mb-6 shadow-md">
                      3
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mb-3 font-serif text-center">Let's Hibachi!</h3>
                  <p className="text-foreground/80 font-sans tracking-wide text-center mb-6">
                    Our chef arrives, sets up, performs, cooks, serves, and cleans up. You just enjoy!
                  </p>
                  <div className="text-center">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="rounded-full border-amber-500 text-amber-600 hover:bg-amber-50"
                    >
                      <Link href="/estimation">Get Started</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-6">
            {/* Step 1 */}
            <div
              className={`transform transition-all duration-500 ${
                animatedSteps[0] ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
              }`}
            >
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-start">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xl font-serif font-bold mr-4 shadow-md flex-shrink-0">
                    1
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2 font-serif">Pick Your Menu</h3>
                  </div>
                </div>
                <p className="text-foreground/80 font-sans tracking-wide">
                  Select from our Basic or Buffet packages based on your preferences and budget.
                </p>
                <div className="mt-4">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="rounded-full border-amber-500 text-amber-600 hover:bg-amber-50 w-full"
                  >
                    <Link href="/menu">View Packages</Link>
                  </Button>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div
              className={`transform transition-all duration-500 ${
                animatedSteps[1] ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
              }`}
            >
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-start">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xl font-serif font-bold mr-4 shadow-md flex-shrink-0">
                    2
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2 font-serif">Reserve Your Spot</h3>
                  </div>
                </div>
                <p className="text-foreground/80 font-sans tracking-wide">
                  Choose your preferred date and time, and we'll confirm availability within 24 hours.
                </p>
                <div className="mt-4">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="rounded-full border-amber-500 text-amber-600 hover:bg-amber-50 w-full"
                  >
                    <Link href="/book">Check Availability</Link>
                  </Button>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div
              className={`transform transition-all duration-500 ${
                animatedSteps[2] ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
              }`}
            >
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-start">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xl font-serif font-bold mr-4 shadow-md flex-shrink-0">
                    3
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2 font-serif">Let's Hibachi!</h3>
                  </div>
                </div>
                <p className="text-foreground/80 font-sans tracking-wide">
                  Our chef arrives, sets up, performs, cooks, serves, and cleans up. You just enjoy!
                </p>
                <div className="mt-4">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="rounded-full border-amber-500 text-amber-600 hover:bg-amber-50 w-full"
                  >
                    <Link href="/estimation">Get Started</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Package Options Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-center mb-6">
            Our Popular <span className="text-primary">Packages</span>
          </h2>
          <p className="text-lg text-center text-gray-600 max-w-3xl mx-auto mb-12">
            Choose from our carefully crafted packages designed to provide the perfect hibachi experience for any
            occasion
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Basic Package Card */}
            <div className="border rounded-lg overflow-hidden transition-all relative hover:shadow-lg border-amber-300/50 hover:border-amber-300">
              <div className="absolute top-2 right-2 z-10">
                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 border-amber-200">
                  Most Popular
                </span>
              </div>
              <div className="relative h-48 overflow-hidden">
                <img
                  src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/Chicken-and-Beef-Hibachi-Catering-LA-itQYZOc95RTr9yWdNJOr1NiXsBBIBu.jpg"
                  alt="Basic Package"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold mb-2">Basic Package</h3>
                <div className="mb-4">
                  <p className="text-lg font-semibold text-amber-600">
                    <span className="text-gray-500 text-sm line-through mr-2">$60</span>
                    $49.9
                    <span className="text-sm font-normal"> per person</span>
                  </p>
                  <p className="text-xs text-gray-600">($499 minimum)</p>
                </div>
                <ul className="space-y-1 mb-6 text-sm">
                  <li className="flex items-start">
                    <span className="text-amber-500 mr-2">•</span>
                    <span>2 proteins of your choice</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-amber-500 mr-2">•</span>
                    <span>Fried rice & vegetables</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-amber-500 mr-2">•</span>
                    <span>Chef performance included</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-amber-500 mr-2">•</span>
                    <span>Perfect for intimate gatherings</span>
                  </li>
                </ul>
                <Button asChild className="w-full bg-amber-500 hover:bg-amber-600">
                  <Link href="/book">Book Now</Link>
                </Button>
              </div>
            </div>

            {/* Buffet Package Card */}
            <div className="border rounded-lg overflow-hidden transition-all relative hover:shadow-lg">
              <div className="absolute top-2 right-2 z-10">
                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 border-blue-200">
                  Self-Service
                </span>
              </div>
              <div className="relative h-48 overflow-hidden">
                <img
                  src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/filetchickenshrimp-Hibachi-Catering-LA-s2QYxFQesPB2wRPyaCJabQ5nGIPH4V.jpg"
                  alt="Buffet Package"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold mb-2">Buffet Package</h3>
                <div className="mb-4">
                  <p className="text-lg font-semibold text-amber-600">
                    <span className="text-gray-500 text-sm line-through mr-2">$50</span>
                    $39.9
                    <span className="text-sm font-normal"> per person</span>
                  </p>
                  <p className="text-xs text-gray-600">($798 minimum)</p>
                </div>
                <ul className="space-y-1 mb-6 text-sm">
                  <li className="flex items-start">
                    <span className="text-amber-500 mr-2">•</span>
                    <span>Self-service buffet style</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-amber-500 mr-2">•</span>
                    <span>Fixed menu (chicken, shrimp, beef)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-amber-500 mr-2">•</span>
                    <span>Fried rice & vegetables</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-amber-500 mr-2">•</span>
                    <span>Ideal for larger groups (20+ people)</span>
                  </li>
                </ul>
                <Button asChild className="w-full bg-amber-500 hover:bg-amber-600">
                  <Link href="/book">Book Now</Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="text-center mt-10">
            <Button
              asChild
              variant="outline"
              className="rounded-full border-2 border-amber-500 text-amber-600 hover:bg-amber-50"
            >
              <Link href="/menu">View All Packages</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
