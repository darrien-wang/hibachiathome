"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { VisuallyHidden } from "@/components/ui/visually-hidden"
import { siteConfig } from "@/config/site"
import { getPartyNavItems } from "@/config/party-types"
import { Menu, ChevronDown } from "lucide-react"

// Service areas data for navigation menu - simplified to 4 main regions
const serviceAreas = [
  {
    region: "Southern California",
    href: "/service-area",
    cities: [
      { name: "Los Angeles Area", href: "/service-area/los-angeles" },
      { name: "Orange County", href: "/service-area/orange-county" },
      { name: "San Diego", href: "/service-area/san-diego" },
      { name: "Inland Empire", href: "/service-area/san-bernardino", subtitle: "San Bernardino • Riverside • Palm Springs" }
    ]
  }
]

const navItems = [
  { name: "Home", href: "/", disabled: false },
  { name: "Menu", href: "/menu", disabled: false },
  { 
    name: "Parties", 
    href: "/parties", 
    disabled: false, 
    hasDropdown: true,
    dropdownItems: getPartyNavItems()
  },
  { name: "Blog", href: "/blog", disabled: false },
  { 
    name: "Service Area", 
    href: "/service-area", 
    disabled: false, 
    hasDropdown: true,
    dropdownItems: serviceAreas[0].cities
  },
  { name: "Gallery", href: "/gallery", disabled: false },
  { name: "Reviews", href: "/reviews", disabled: false },
  { name: "FAQ", href: "/faq", disabled: false },
  { name: "Equipment Rentals", href: "/rentals", disabled: true },
]

export function Header() {
  const pathname = usePathname()
  const isHomePage = pathname === '/'
  const [isScrolled, setIsScrolled] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)
  const [ticking, setTicking] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [mobileExpandedItem, setMobileExpandedItem] = useState<string | null>(null)
  const [expandedAreas, setExpandedAreas] = useState<string[]>([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Toggle area expansion
  const toggleAreaExpansion = (areaName: string) => {
    setExpandedAreas(prev => 
      prev.includes(areaName) 
        ? prev.filter(name => name !== areaName)
        : [...prev, areaName]
    )
  }

  // Close mobile menu when link is clicked
  const handleLinkClick = () => {
    setMobileMenuOpen(false)
    setMobileExpandedItem(null)
    setExpandedAreas([])
  }

  // Handle dropdown hover with delay
  const handleDropdownEnter = (itemName: string) => {
    // Clear any existing timeout
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current)
      dropdownTimeoutRef.current = null
    }
    setActiveDropdown(itemName)
  }

  const handleDropdownLeave = () => {
    // Set a delay before closing
    dropdownTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(null)
      dropdownTimeoutRef.current = null
    }, 300) // 300ms delay
  }

  const handleDropdownEnterKeep = () => {
    // Clear timeout when mouse enters dropdown content
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current)
      dropdownTimeoutRef.current = null
    }
  }

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

  // 添加一个 effect 来设置CSS变量，考虑logo溢出
  useEffect(() => {
    // 函数来更新header高度CSS变量
    const updateHeaderHeight = () => {
      if (headerRef.current) {
        const headerHeight = headerRef.current.offsetHeight
        // 只在首页时添加logo溢出的额外高度
        const totalHeight = isHomePage ? headerHeight + 64 : headerHeight
        document.documentElement.style.setProperty("--header-height", `${totalHeight}px`)
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
  }, [isHomePage])

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true })

    // Initial check
    handleScroll()

    return () => {
      window.removeEventListener("scroll", handleScroll)
      // Clean up timeout on unmount
      if (dropdownTimeoutRef.current) {
        clearTimeout(dropdownTimeoutRef.current)
      }
    }
  }, [handleScroll])

  return (
    <header
      ref={headerRef}
      className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out bg-gradient-to-b from-[#F5E3CB] to-white backdrop-blur-sm overflow-visible ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      {/* Logo positioned to overflow entire header - Only on home page */}
      {isHomePage && (
        <div className="absolute left-1/2 -translate-x-1/2 z-40" style={{ top: 'calc(100% - 48px)' }}>
          <Link href="/" className="block relative">
            <Image
              src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/logo/realhibachiathome-Gn1I9pZdsKZZZyYtU2kuyfGH4XaAdN.png"
              alt={siteConfig.logo.alt}
              width={siteConfig.logo.width * 0.8}
              height={siteConfig.logo.height * 0.8}
              className="h-auto w-[112px] md:w-[128px] hover:-translate-y-1 hover:scale-105 transition-all duration-300 rounded-full bg-stone-100/95 backdrop-blur-sm shadow-[0_0_15px_rgba(249,167,124,0.3)] after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-1/2 after:rounded-b-full after:shadow-[0_6px_12px_-2px_rgba(0,0,0,0.3)] hover:after:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.4)] after:transition-all"
              priority
            />
          </Link>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 xl:px-8 py-2 lg:py-4 relative">
        <div className="absolute left-2 top-1/2 -translate-y-1/2 w-[120px] h-[120px] bg-[#F9A77C]/10 rounded-full blur-xl -z-10"></div>


        {/* Mobile Layout */}
        <div className="md:hidden grid grid-cols-3 items-center gap-1">
          {/* Empty div for left side spacing */}
          <div></div>

          {/* Logo for non-home pages or empty for home page */}
          <div className="flex items-center justify-center">
            {!isHomePage && (
              <Link href="/" className="block relative">
                <Image
                  src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/logo/realhibachiathome-Gn1I9pZdsKZZZyYtU2kuyfGH4XaAdN.png"
                  alt={siteConfig.logo.alt}
                  width={siteConfig.logo.width * 0.6}
                  height={siteConfig.logo.height * 0.6}
                  className="h-auto w-[64px] hover:-translate-y-1 hover:scale-105 transition-all duration-300 rounded-full bg-stone-100/95 backdrop-blur-sm shadow-[0_0_15px_rgba(249,167,124,0.3)]"
                  priority
                />
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex justify-end">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
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
              <SheetContent className="w-[280px] max-w-[90vw] bg-stone-100/95 overflow-y-auto max-h-screen">
                <VisuallyHidden>
                  <SheetTitle>Navigation Menu</SheetTitle>
                </VisuallyHidden>
                <div className="flex justify-center mb-6 mt-4">
                  <Image
                    src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/logo/realhibachiathome-Gn1I9pZdsKZZZyYtU2kuyfGH4XaAdN.png"
                    alt={siteConfig.logo.alt}
                    width={112}
                    height={35}
                    className="h-auto hover:-translate-y-1 hover:scale-105 transition-all duration-300 rounded-full bg-stone-100/95 backdrop-blur-sm shadow-[0_0_15px_rgba(249,167,124,0.3)] after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-1/2 after:rounded-b-full after:shadow-[0_6px_12px_-2px_rgba(0,0,0,0.3)] hover:after:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.4)] after:transition-all"
                  />
                </div>
                <div className="flex flex-col h-full">
                <nav className="flex flex-col mt-6 pb-20">
                  {navItems
                    .filter((item) => !item.disabled)
                    .map((item) => (
                      <div key={item.name}>
                        {item.hasDropdown ? (
                          <div>
                            <button
                              onClick={() => setMobileExpandedItem(
                                mobileExpandedItem === item.name ? null : item.name
                              )}
                              className="w-full py-3 text-lg font-sans font-medium text-gray-700 hover:text-[#F9A77C] transition-colors tracking-wide flex items-center justify-between"
                            >
                              {item.name}
                              <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${
                                mobileExpandedItem === item.name ? 'rotate-180' : ''
                              }`} />
                            </button>
                            
                            {/* Mobile Dropdown Content */}
                            {mobileExpandedItem === item.name && (
                              <div className="pl-4 pb-2">
                                <Link
                                  href={item.href}
                                  onClick={handleLinkClick}
                                  className="block py-2 text-base text-gray-600 hover:text-[#F9A77C]"
                                >
                                  View All Areas
                                </Link>
                                {item.dropdownItems?.map((area, index) => (
                                  <div key={index} className="mb-3">
                                    <Link
                                      href={area.href}
                                      onClick={handleLinkClick}
                                      className="block py-2 font-medium text-gray-700 hover:text-[#F9A77C]"
                                    >
                                      {area.name}
                                      {((area as any).subtitle || (area as any).description) && (
                                        <div className="text-sm text-gray-500 mt-1">{(area as any).subtitle || (area as any).description}</div>
                                      )}
                                    </Link>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <Link
                            href={item.href}
                            onClick={handleLinkClick}
                            className="py-3 text-lg font-sans font-medium text-gray-700 hover:text-[#F9A77C] transition-colors tracking-wide block"
                          >
                            {item.name}
                          </Link>
                        )}
                      </div>
                    ))}
                  <Button
                    asChild
                    className="mt-6 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-sm transition-all hover:shadow-md px-6 border-2 border-amber-500"
                    size="default"
                  >
                    <Link href="/book" onClick={handleLinkClick}>Book Now</Link>
                  </Button>
                </nav>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Desktop Layout - Different layouts for home vs other pages */}
        {isHomePage ? (
          <div className="hidden md:relative md:flex md:items-center max-w-[90vw] xl:max-w-[1400px] mx-auto">
            {/* Desktop Navigation - Left Side */}
            <nav className="flex items-center justify-start flex-1 pr-[80px] md:pr-[100px] lg:pr-[120px]">
              {navItems
                .filter((item) => !item.disabled)
                .slice(0, Math.ceil(navItems.filter((item) => !item.disabled).length / 2))
                .map((item) => (
                  <div
                    key={item.name}
                    className="relative"
                    onMouseEnter={() => item.hasDropdown && handleDropdownEnter(item.name)}
                    onMouseLeave={() => item.hasDropdown && handleDropdownLeave()}
                  >
                    <Link
                      href={item.href}
                      className="px-3 lg:px-4 py-2 text-base font-sans font-medium text-gray-700 hover:text-[#F9A77C] transition-colors tracking-wide mx-1.5 lg:mx-3 xl:mx-4 flex items-center gap-1"
                    >
                      {item.name}
                      {item.hasDropdown && (
                        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${
                          activeDropdown === item.name ? 'rotate-180' : ''
                        }`} />
                      )}
                    </Link>
                    
                    {/* Dropdown Menu */}
                    {item.hasDropdown && activeDropdown === item.name && (
                      <div 
                        className="absolute top-full left-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50"
                        onMouseEnter={handleDropdownEnterKeep}
                        onMouseLeave={handleDropdownLeave}
                      >
                        {item.dropdownItems?.map((area, index) => (
                          <div key={index}>
                            <Link
                              href={area.href}
                              className="block px-4 py-3 text-gray-700 hover:bg-orange-50 hover:text-[#F9A77C] transition-colors"
                            >
                              <div className="font-semibold text-base">{area.name}</div>
                              {((area as any).subtitle || (area as any).description) && (
                                <div className="text-sm text-gray-500 mt-1">{(area as any).subtitle || (area as any).description}</div>
                              )}
                            </Link>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </nav>

            {/* Desktop Navigation - Right Side with Book Now Button */}
            <div className="flex items-center justify-end flex-1 pl-[80px] md:pl-[100px] lg:pl-[120px]">
              {navItems
                .filter((item) => !item.disabled)
                .slice(Math.ceil(navItems.filter((item) => !item.disabled).length / 2))
                .map((item) => (
                  <div
                    key={item.name}
                    className="relative"
                    onMouseEnter={() => item.hasDropdown && handleDropdownEnter(item.name)}
                    onMouseLeave={() => item.hasDropdown && handleDropdownLeave()}
                  >
                    <Link
                      href={item.href}
                      className="px-3 lg:px-4 py-2 text-base font-sans font-medium text-gray-700 hover:text-[#F9A77C] transition-colors tracking-wide mx-1.5 lg:mx-3 xl:mx-4 flex items-center gap-1"
                    >
                      {item.name}
                      {item.hasDropdown && (
                        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${
                          activeDropdown === item.name ? 'rotate-180' : ''
                        }`} />
                      )}
                    </Link>
                    
                    {/* Dropdown Menu */}
                    {item.hasDropdown && activeDropdown === item.name && (
                      <div 
                        className="absolute top-full right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50"
                        onMouseEnter={handleDropdownEnterKeep}
                        onMouseLeave={handleDropdownLeave}
                      >
                        {item.dropdownItems?.map((area, index) => (
                          <div key={index}>
                            <Link
                              href={area.href}
                              className="block px-4 py-3 text-gray-700 hover:bg-orange-50 hover:text-[#F9A77C] transition-colors"
                            >
                              <div className="font-semibold text-base">{area.name}</div>
                              {((area as any).subtitle || (area as any).description) && (
                                <div className="text-sm text-gray-500 mt-1">{(area as any).subtitle || (area as any).description}</div>
                              )}
                            </Link>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              <div className="ml-4 lg:ml-6 xl:ml-8">
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
        ) : (
          /* Non-home page layout - same as home but logo in center instead of overflowing */
          <div className="hidden md:relative md:flex md:items-center max-w-[90vw] xl:max-w-[1400px] mx-auto">
            {/* Desktop Navigation - Left Side */}
            <nav className="flex items-center justify-start flex-1 pr-[80px] md:pr-[100px] lg:pr-[120px]">
              {navItems
                .filter((item) => !item.disabled)
                .slice(0, Math.ceil(navItems.filter((item) => !item.disabled).length / 2))
                .map((item) => (
                  <div
                    key={item.name}
                    className="relative"
                    onMouseEnter={() => item.hasDropdown && handleDropdownEnter(item.name)}
                    onMouseLeave={() => item.hasDropdown && handleDropdownLeave()}
                  >
                    <Link
                      href={item.href}
                      className="px-3 lg:px-4 py-2 text-base font-sans font-medium text-gray-700 hover:text-[#F9A77C] transition-colors tracking-wide mx-1.5 lg:mx-3 xl:mx-4 flex items-center gap-1"
                    >
                      {item.name}
                      {item.hasDropdown && (
                        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${
                          activeDropdown === item.name ? 'rotate-180' : ''
                        }`} />
                      )}
                    </Link>
                    
                    {/* Dropdown Menu */}
                    {item.hasDropdown && activeDropdown === item.name && (
                      <div 
                        className="absolute top-full left-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50"
                        onMouseEnter={handleDropdownEnterKeep}
                        onMouseLeave={handleDropdownLeave}
                      >
                        {item.dropdownItems?.map((area, index) => (
                          <div key={index}>
                            <Link
                              href={area.href}
                              className="block px-4 py-3 text-gray-700 hover:bg-orange-50 hover:text-[#F9A77C] transition-colors"
                            >
                              <div className="font-semibold text-base">{area.name}</div>
                              {((area as any).subtitle || (area as any).description) && (
                                <div className="text-sm text-gray-500 mt-1">{(area as any).subtitle || (area as any).description}</div>
                              )}
                            </Link>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </nav>

            {/* Center Logo - Non-overflowing */}
            <div className="absolute left-1/2 -translate-x-1/2 z-20">
              <Link href="/" className="block relative">
                <Image
                  src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/logo/realhibachiathome-Gn1I9pZdsKZZZyYtU2kuyfGH4XaAdN.png"
                  alt={siteConfig.logo.alt}
                  width={siteConfig.logo.width * 0.6}
                  height={siteConfig.logo.height * 0.6}
                  className="h-auto w-[80px] md:w-[96px] hover:-translate-y-1 hover:scale-105 transition-all duration-300 rounded-full bg-stone-100/95 backdrop-blur-sm shadow-[0_0_15px_rgba(249,167,124,0.3)] after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-1/2 after:rounded-b-full after:shadow-[0_6px_12px_-2px_rgba(0,0,0,0.3)] hover:after:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.4)] after:transition-all"
                  priority
                />
              </Link>
            </div>

            {/* Desktop Navigation - Right Side with Book Now Button */}
            <div className="flex items-center justify-end flex-1 pl-[80px] md:pl-[100px] lg:pl-[120px]">
              {navItems
                .filter((item) => !item.disabled)
                .slice(Math.ceil(navItems.filter((item) => !item.disabled).length / 2))
                .map((item) => (
                  <div
                    key={item.name}
                    className="relative"
                    onMouseEnter={() => item.hasDropdown && handleDropdownEnter(item.name)}
                    onMouseLeave={() => item.hasDropdown && handleDropdownLeave()}
                  >
                    <Link
                      href={item.href}
                      className="px-3 lg:px-4 py-2 text-base font-sans font-medium text-gray-700 hover:text-[#F9A77C] transition-colors tracking-wide mx-1.5 lg:mx-3 xl:mx-4 flex items-center gap-1"
                    >
                      {item.name}
                      {item.hasDropdown && (
                        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${
                          activeDropdown === item.name ? 'rotate-180' : ''
                        }`} />
                      )}
                    </Link>
                    
                    {/* Dropdown Menu */}
                    {item.hasDropdown && activeDropdown === item.name && (
                      <div 
                        className="absolute top-full right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50"
                        onMouseEnter={handleDropdownEnterKeep}
                        onMouseLeave={handleDropdownLeave}
                      >
                        {item.dropdownItems?.map((area, index) => (
                          <div key={index}>
                            <Link
                              href={area.href}
                              className="block px-4 py-3 text-gray-700 hover:bg-orange-50 hover:text-[#F9A77C] transition-colors"
                            >
                              <div className="font-semibold text-base">{area.name}</div>
                              {((area as any).subtitle || (area as any).description) && (
                                <div className="text-sm text-gray-500 mt-1">{(area as any).subtitle || (area as any).description}</div>
                              )}
                            </Link>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              <div className="ml-4 lg:ml-6 xl:ml-8">
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
        )}
      </div>
    </header>
  )
}
