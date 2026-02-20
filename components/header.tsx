"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { VisuallyHidden } from "@/components/ui/visually-hidden"
import { siteConfig } from "@/config/site"
import { Menu } from "lucide-react"
import { trackEvent } from "@/lib/tracking"

const navItems = [
  { name: "Home", href: "/", disabled: false },
  { name: "Menu", href: "/menu", disabled: false },
  { name: "Blog", href: "/blog", disabled: false }, // 添加博客导航项
  { name: "Locations", href: "/locations", disabled: true },
  { name: "Gallery", href: "/gallery", disabled: false },
  { name: "FAQ", href: "/faq", disabled: false },
  { name: "Equipment Rentals", href: "/rentals", disabled: true },
  { name: "Feedback", href: "/contact", disabled: false },
]

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)
  const [ticking, setTicking] = useState(false)

  // Throttled scroll handler
  const handleScroll = useCallback(() => {
    if (!ticking) {
      setTicking(true)

      window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY

        // Only update if we've scrolled at least 5px to reduce jitter
        if (Math.abs(currentScrollY - lastScrollY) > 5) {
          // Determine if we're scrolling up or down
          if (currentScrollY > lastScrollY && currentScrollY > 100) {
            // Scrolling down and past threshold
            setIsVisible(false)
          } else if (currentScrollY < lastScrollY) {
            // Scrolling up
            setIsVisible(true)
          }

          // Update last scroll position
          setLastScrollY(currentScrollY)
        }

        // Update background change
        setIsScrolled(currentScrollY > 10)

        setTicking(false)
      })
    }
  }, [lastScrollY, ticking])

  // 添加一个 ref 来引用 header 元素
  const headerRef = useRef<HTMLElement>(null)

  // 添加一个 effect 来设置CSS变量而不是body padding
  useEffect(() => {
    // 函数来更新header高度CSS变量
    const updateHeaderHeight = () => {
      if (headerRef.current) {
        const headerHeight = headerRef.current.offsetHeight
        document.documentElement.style.setProperty("--header-height", `${headerHeight}px`)
        // 移除body padding，让hero可以无缝连接
        document.body.style.paddingTop = "0"
      }
    }

    // 初始设置
    updateHeaderHeight()

    // 在窗口大小改变时重新计算
    window.addEventListener("resize", updateHeaderHeight)

    // 清理函数
    return () => {
      window.removeEventListener("resize", updateHeaderHeight)
      document.documentElement.style.removeProperty("--header-height")
    }
  }, [])

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true })

    // Initial check
    handleScroll()

    return () => {
      window.removeEventListener("scroll", handleScroll)
    }
  }, [handleScroll])

  const handleHeaderPhoneClick = () => {
    trackEvent("phone_click", { contact_surface: "mobile_header" })
  }

  const handleHeaderSMSClick = () => {
    trackEvent("sms_click", { contact_surface: "mobile_header" })
  }

  return (
    <header
      ref={headerRef}
      className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out bg-gradient-to-b from-[#F5E3CB] to-white backdrop-blur-sm overflow-visible ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-3 lg:py-8 relative">
        <div className="absolute left-2 top-1/2 -translate-y-1/2 w-[120px] h-[120px] bg-[#F9A77C]/10 rounded-full blur-xl -z-10"></div>


        {/* Mobile Layout */}
        <div className="md:hidden grid grid-cols-3 items-center gap-1">
          <div className="flex justify-start">
            <div className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 select-text">
              <a href="sms:2137707788" onClick={handleHeaderSMSClick} className="hover:text-[#F1691B]">
                SMS
              </a>
              <span>/</span>
              <a href="tel:2137707788" onClick={handleHeaderPhoneClick} className="hover:text-[#F1691B]">
                Call
              </a>
            </div>
          </div>

          {/* Centered Logo - Now positioned lower on mobile */}
          <div className="flex items-center justify-center relative h-[50px] z-10 overflow-visible mx-auto max-w-[120px]">
            <Link href="/" className="block relative">
              <Image
                src="/images/design-mode/realhibachiathome.png"
                alt={siteConfig.logo.alt}
                width={siteConfig.logo.width * 0.8}
                height={siteConfig.logo.height * 0.8}
                className="h-auto w-[96px] sm:w-[112px] hover:-translate-y-1 hover:scale-105 transition-all duration-300 rounded-full bg-stone-100/95 backdrop-blur-sm shadow-[0_0_15px_rgba(249,167,124,0.3)] after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-1/2 after:rounded-b-full after:shadow-[0_6px_12px_-2px_rgba(0,0,0,0.3)] hover:after:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.4)] after:transition-all translate-y-[38px]"
                priority
              />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex justify-end">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-[#F9A77C] hover:bg-[#F9A77C]/10 rounded-full p-2 border-2 border-[#F9A77C]/30 hover:border-[#F9A77C]/50 transition-all"
                >
                  <Menu className="h-7 w-7" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[280px] max-w-[90vw] bg-stone-100/95">
                <VisuallyHidden>
                  <SheetTitle>Navigation Menu</SheetTitle>
                </VisuallyHidden>
                <div className="flex justify-center mb-6 mt-4">
                  <Image
                    src="/images/design-mode/realhibachiathome.png"
                    alt={siteConfig.logo.alt}
                    width={112}
                    height={35}
                    className="h-auto hover:-translate-y-1 hover:scale-105 transition-all duration-300 rounded-full bg-stone-100/95 backdrop-blur-sm shadow-[0_0_15px_rgba(249,167,124,0.3)] after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-1/2 after:rounded-b-full after:shadow-[0_6px_12px_-2px_rgba(0,0,0,0.3)] hover:after:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.4)] after:transition-all"
                  />
                </div>
                <nav className="flex flex-col mt-6">
                  {navItems
                    .filter((item) => !item.disabled)
                    .map((item) => (
                      <Link
                        key={item.name}
                        href={item.href}
                        className="py-3 text-lg font-sans font-medium text-gray-700 hover:text-[#F9A77C] transition-colors tracking-wide"
                      >
                        {item.name}
                      </Link>
                    ))}
                  <Button
                    asChild
                    className="mt-6 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-sm transition-all hover:shadow-md px-6 border-2 border-amber-500"
                    size="default"
                  >
                    <Link href="/book">Book Now</Link>
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:flex items-center justify-between w-full max-w-7xl mx-auto">
          {/* Desktop Navigation - Left Side */}
          <nav className="flex items-center justify-between flex-1 pr-14">
            {navItems
              .filter((item) => !item.disabled)
              .slice(0, Math.ceil(navItems.filter((item) => !item.disabled).length / 2))
              .map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="px-2 py-1 text-base font-sans font-medium text-gray-700 hover:text-[#F9A77C] transition-colors tracking-wide"
                >
                  {item.name}
                </Link>
              ))}
          </nav>

          {/* Logo in Center - Desktop remains unchanged */}
          <div className="flex items-center relative h-[50px] w-[112px] md:w-[128px] z-10 mx-6">
            <Link href="/" className="block relative w-full h-full">
              <Image
                src="/images/design-mode/realhibachiathome.png"
                alt={siteConfig.logo.alt}
                width={siteConfig.logo.width * 0.8}
                height={siteConfig.logo.height * 0.8}
                className="h-auto w-[112px] md:w-[128px] hover:-translate-y-1 hover:scale-105 transition-all duration-300 rounded-full bg-stone-100/95 backdrop-blur-sm shadow-[0_0_15px_rgba(249,167,124,0.3)] after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-1/2 after:rounded-b-full after:shadow-[0_6px_12px_-2px_rgba(0,0,0,0.3)] hover:after:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.4)] after:transition-all"
                priority
              />
            </Link>
          </div>

          {/* Desktop Navigation - Right Side with Book Now Button */}
          <div className="flex items-center justify-between flex-1 pl-14">
            <div className="flex items-center justify-between flex-1">
              {navItems
                .filter((item) => !item.disabled)
                .slice(Math.ceil(navItems.filter((item) => !item.disabled).length / 2))
                .map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="px-2 py-1 text-base font-sans font-medium text-gray-700 hover:text-[#F9A77C] transition-colors tracking-wide"
                  >
                    {item.name}
                  </Link>
                ))}
            </div>
            <div className="ml-6">
              <Button
                asChild
                className="bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-sm transition-all hover:shadow-md px-6 text-base border-2 border-amber-500"
                size="default"
              >
                <Link href="/book">Book Now</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
