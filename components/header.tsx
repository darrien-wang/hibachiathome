"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { Sheet } from "@/components/ui/sheet"
import { siteConfig } from "@/config/site"

const navItems = [
  { name: "Home", href: "/", disabled: false },
  { name: "Menu", href: "/menu", disabled: false },
  { name: "Blog", href: "/blog", disabled: false }, // 添加博客导航项
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
      className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out bg-gradient-to-b from-black/90 to-black/70 backdrop-blur-sm overflow-visible ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="container mx-auto px-4 py-3 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[180px] h-[180px] bg-blazing-orange/10 rounded-full blur-xl -z-10 animate-fire-glow"></div>

        {/* Mobile Layout */}
        <div className="md:hidden grid grid-cols-3 items-center">
          {/* Empty div for left side spacing */}
          <div></div>

          {/* Centered Logo - Now positioned lower on mobile */}
          <div className="flex items-center justify-center relative h-[50px] z-10">
            <Link href="/" className="block relative">
              <Image
                src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/logo/realhibachiathome-Gn1I9pZdsKZZZyYtU2kuyfGH4XaAdN.png"
                alt={siteConfig.logo.alt}
                width={siteConfig.logo.width * 0.8}
                height={siteConfig.logo.height * 0.8}
                className="h-auto w-[112px] hover:-translate-y-1 hover:scale-105 transition-all duration-300 rounded-full bg-stone-100/95 backdrop-blur-sm shadow-[0_0_15px_rgba(255,106,0,0.4)] after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-1/2 after:rounded-b-full after:shadow-[0_6px_12px_-2px_rgba(0,0,0,0.3)] hover:after:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.4)] after:transition-all translate-y-[38px]"
                priority
              />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex justify-end">
            <Sheet>
              \
