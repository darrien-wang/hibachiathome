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
  { name: "Blog", href: "/blog", disabled: false },
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

        if (Math.abs(currentScrollY - lastScrollY) > 5) {
          if (currentScrollY > lastScrollY && currentScrollY > 100) {
            setIsVisible(false)
          } else if (currentScrollY < lastScrollY) {
            setIsVisible(true)
          }
          setLastScrollY(currentScrollY)
        }

        setIsScrolled(currentScrollY > 10)
        setTicking(false)
      })
    }
  }, [lastScrollY, ticking])

  const headerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const updateHeaderHeight = () => {
      if (headerRef.current) {
        const headerHeight = headerRef.current.offsetHeight
        document.documentElement.style.setProperty("--header-height", `${headerHeight}px`)
        document.body.style.paddingTop = "0"
      }
    }

    updateHeaderHeight()
    window.addEventListener("resize", updateHeaderHeight)

    return () => {
      window.removeEventListener("resize", updateHeaderHeight)
      document.documentElement.style.removeProperty("--header-height")
    }
  }, [])

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()

    return () => {
      window.removeEventListener("scroll", handleScroll)
    }
  }, [handleScroll])

  return (
    <header
      ref={headerRef}
      className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out bg-gradient-to-b from-black/95 to-black/80 backdrop-blur-sm overflow-visible ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="container mx-auto px-4 py-2 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[180px] h-[180px] bg-blazing-orange/10 rounded-full blur-xl -z-10 animate-fire-glow"></div>

        {/* Mobile Layout */}
        <div className="md:hidden grid grid-cols-3 items-center">
          <div></div>

          {/* Centered Logo - Mobile */}
          <div className="flex items-center justify-center relative h-[60px] z-10">
            <Link href="/" className="block relative rounded-full overflow-hidden">
              <Image
                src={siteConfig.logo.main || "/placeholder.svg"}
                alt={siteConfig.logo.alt}
                width={80}
                height={96}
                className="h-auto w-[80px] hover:scale-105 transition-all duration-300 drop-shadow-[0_0_10px_rgba(255,106,0,0.5)] hover:drop-shadow-[0_0_15px_rgba(255,106,0,0.8)]"
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
                  className="text-blazing-orange hover:bg-blazing-orange/10 rounded-full"
                >
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[250px] sm:w-[300px] bg-black/95 border-blazing-orange/20">
                <div className="flex justify-center mb-6 mt-4">
                  <Image
                    src={siteConfig.logo.main || "/placeholder.svg"}
                    alt={siteConfig.logo.alt}
                    width={100}
                    height={120}
                    className="h-auto w-[100px] drop-shadow-[0_0_10px_rgba(255,106,0,0.5)]"
                  />
                </div>
                <nav className="flex flex-col mt-6">
                  {navItems
                    .filter((item) => !item.disabled)
                    .map((item) => (
                      <Link
                        key={item.name}
                        href={item.href}
                        className="py-3 text-lg font-energy font-medium text-white hover:text-blazing-orange transition-colors tracking-wide"
                      >
                        {item.name}
                      </Link>
                    ))}
                  <Button
                    asChild
                    className="mt-6 bg-blazing-orange hover:bg-blazing-orange/80 text-white rounded-full shadow-lg transition-all hover:shadow-xl hover:shadow-blazing-orange/25 px-6 border-2 border-blazing-orange font-energy"
                    size="default"
                  >
                    <Link href="/book">BOOK NOW</Link>
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:flex items-center justify-between max-w-6xl mx-auto">
          {/* Desktop Navigation - Left Side */}
          <nav className="flex items-center justify-end flex-1">
            {navItems
              .filter((item) => !item.disabled)
              .slice(0, Math.ceil(navItems.filter((item) => !item.disabled).length / 2))
              .map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="px-3 py-2 text-base font-energy font-medium text-white hover:text-blazing-orange transition-colors tracking-wide mx-1 uppercase"
                >
                  {item.name}
                </Link>
              ))}
          </nav>

          {/* Logo in Center - Desktop */}
          <div className="flex items-center relative h-[70px] w-[120px] z-10 mx-6">
            <Link href="/" className="block relative w-full h-full">
              <Image
                src={siteConfig.logo.main || "/placeholder.svg"}
                alt={siteConfig.logo.alt}
                width={120}
                height={144}
                className="h-auto w-[120px] hover:scale-105 transition-all duration-300 drop-shadow-[0_0_15px_rgba(255,106,0,0.6)] hover:drop-shadow-[0_0_20px_rgba(255,106,0,0.9)]"
                priority
              />
            </Link>
          </div>

          {/* Desktop Navigation - Right Side with Book Now Button */}
          <div className="flex items-center justify-start flex-1">
            {navItems
              .filter((item) => !item.disabled)
              .slice(Math.ceil(navItems.filter((item) => !item.disabled).length / 2))
              .map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="px-3 py-2 text-base font-energy font-medium text-white hover:text-blazing-orange transition-colors tracking-wide mx-1 uppercase"
                >
                  {item.name}
                </Link>
              ))}
            <div className="ml-auto">
              <Button
                asChild
                className="bg-blazing-orange hover:bg-blazing-orange/80 text-white rounded-full shadow-lg transition-all hover:shadow-xl hover:shadow-blazing-orange/25 px-8 text-base border-2 border-blazing-orange font-energy uppercase tracking-wider"
                size="default"
              >
                <Link href="/book">BOOK NOW</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
