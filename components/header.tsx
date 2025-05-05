"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu } from "lucide-react"
import { siteConfig } from "@/config/site"

const navItems = [
  { name: "Home", href: "/", disabled: false },
  { name: "Menu", href: "/menu", disabled: false },
  { name: "Locations", href: "/locations", disabled: true },
  { name: "Gallery", href: "/gallery", disabled: false },
  { name: "FAQ", href: "/faq", disabled: false },
  { name: "Equipment Rentals", href: "/rentals", disabled: true },
  { name: "Contact", href: "/contact", disabled: false },
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

  return (
    <header
      ref={headerRef}
      className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out bg-gradient-to-b from-[#F5E3CB] to-white backdrop-blur-sm ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="container mx-auto px-4 py-3 flex items-center justify-between max-w-5xl relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[180px] h-[180px] bg-[#F9A77C]/10 rounded-full blur-xl -z-10"></div>
        <Link href="/" className="flex items-center relative h-[63px] w-[140px] md:w-[160px] z-10">
          <Image
            src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/logo/realhibachiathome-Gn1I9pZdsKZZZyYtU2kuyfGH4XaAdN.png"
            alt={siteConfig.logo.alt}
            width={siteConfig.logo.width}
            height={siteConfig.logo.height}
            className="h-auto w-[140px] md:w-[160px] hover:-translate-y-1 transition-all duration-300 rounded-full absolute z-10 top-0 bg-stone-100/95 backdrop-blur-sm after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-1/2 after:rounded-b-full after:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.2)] hover:after:shadow-[0_8px_10px_-3px_rgba(0,0,0,0.3)] after:transition-all"
            priority
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center justify-center flex-1 mx-4">
          {navItems
            .filter((item) => !item.disabled)
            .map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="px-2 py-1 text-base font-sans font-medium text-gray-700 hover:text-[#F9A77C] transition-colors tracking-wide mx-1"
              >
                {item.name}
              </Link>
            ))}
        </nav>

        {/* Book Now Button */}
        <Button
          asChild
          className="hidden md:flex bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-sm transition-all hover:shadow-md px-6 text-base border-2 border-amber-500"
          size="default"
        >
          <Link href="/book">Book Now</Link>
        </Button>

        {/* Mobile Navigation */}
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-[#F9A77C] hover:bg-[#F9A77C]/10 rounded-full">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[250px] sm:w-[300px] bg-stone-100/95">
              <div className="flex justify-center mb-6 mt-4">
                <Image
                  src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/logo/realhibachiathome-Gn1I9pZdsKZZZyYtU2kuyfGH4XaAdN.png"
                  alt={siteConfig.logo.alt}
                  width={140}
                  height={50}
                  className="h-auto hover:-translate-y-1 transition-all duration-300 rounded-full bg-stone-100/95 backdrop-blur-sm after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-1/2 after:rounded-b-full after:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.2)] hover:after:shadow-[0_8px_10px_-3px_rgba(0,0,0,0.3)] after:transition-all"
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
    </header>
  )
}
