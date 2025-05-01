"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu } from "lucide-react"

const navItems = [
  { name: "Home", href: "/", disabled: false },
  { name: "Packages & Pricing", href: "/menu", disabled: false },
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
      className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out bg-stone-100/95 shadow-sm backdrop-blur-sm ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="container mx-auto px-4 py-2 flex items-center justify-start max-w-5xl">
        <Link href="/" className="flex items-center">
          <Image
            src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/logo-mjF6aoj9t3X7OPJnxLwaZzOEZ3qYn2.png"
            alt="Hibachi at Home Logo"
            width={160}
            height={50}
            className="h-auto w-[120px] md:w-[160px]"
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
          className="hidden md:flex bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-sm transition-all hover:shadow-md px-5 border-2 border-amber-500"
          size="sm"
        >
          <Link href="/book">Book Now</Link>
        </Button>

        {/* Mobile Navigation */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden text-[#F9A77C] hover:bg-[#F9A77C]/10 rounded-full">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[250px] sm:w-[300px] bg-stone-100/95">
            <div className="flex justify-center mb-6 mt-4">
              <Image
                src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/logo-mjF6aoj9t3X7OPJnxLwaZzOEZ3qYn2.png"
                alt="Hibachi at Home Logo"
                width={140}
                height={50}
                className="h-auto"
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
    </header>
  )
}
