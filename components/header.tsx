"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { VisuallyHidden } from "@/components/ui/visually-hidden"
import BrandMark from "@/components/site/brand-mark"
import QuoteCtaLink from "@/components/quote-cta-link"
import { phone, smsHref } from "@/config/site"
import { trackEvent } from "@/lib/tracking"

// 2026-09-08 redesign: one 60px bar (72px on desktop) instead of the 120px
// centered-logo header. Over the homepage hero it is transparent with white
// text; everywhere else (and once scrolled) it is cream with ink text.
const NAV = [
  { name: "Menu", href: "/menu" },
  { name: "Pricing", href: "/#pricing" },
  { name: "Gallery", href: "/gallery" },
  { name: "FAQ", href: "/faq" },
  { name: "Locations", href: "/locations" },
] as const

const SHEET_EXTRA = [
  { name: "Blog", href: "/blog" },
  { name: "Contact", href: "/contact" },
  { name: "Español", href: "/es" },
] as const

export function Header() {
  const pathname = usePathname()
  const isHome = pathname === "/"
  const [scrolled, setScrolled] = useState(false)
  const headerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Pages below the header pad by --header-height (globals.css .hero-section etc.).
  useEffect(() => {
    const update = () => {
      if (headerRef.current) {
        document.documentElement.style.setProperty("--header-height", `${headerRef.current.offsetHeight}px`)
      }
    }
    update()
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("resize", update)
      document.documentElement.style.removeProperty("--header-height")
    }
  }, [pathname])

  const transparent = isHome && !scrolled
  const tone = transparent ? "white" : "ink"
  const link = transparent ? "text-white/90 hover:text-white" : "text-ink/80 hover:text-flame-700"
  const pill = transparent
    ? "border-white/45 text-white hover:bg-white/10"
    : "border-ink/20 text-ink hover:bg-ink/5"

  const onSms = () => trackEvent("sms_click", { contact_surface: "header" })
  const onQuote = () => trackEvent("lead_start", { contact_surface: "header" })

  return (
    <header
      ref={headerRef}
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-200 ${
        transparent ? "bg-transparent" : "border-b border-ink/10 bg-cream/95 backdrop-blur"
      }`}
    >
      <div className="mx-auto flex h-[60px] max-w-7xl items-center justify-between gap-3 px-4 lg:h-[72px] lg:px-8">
        <BrandMark tone={tone} />

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
          {NAV.map((item) => (
            <Link key={item.name} href={item.href} className={`text-[15px] font-medium transition-colors ${link}`}>
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={smsHref()}
            onClick={onSms}
            className={`inline-flex h-10 items-center rounded-full border px-4 text-[13px] font-semibold transition ${pill} ${
              transparent ? "backdrop-blur-sm" : ""
            }`}
          >
            <span className="lg:hidden">Text us</span>
            <span className="hidden lg:inline">Text {phone.sms.dashed}</span>
          </a>
          <QuoteCtaLink
            href="/quote?source=header"
            onClick={onQuote}
            pendingLabel="Opening…"
            className="hidden h-10 items-center rounded-full bg-flame px-5 text-[14px] font-semibold text-white transition hover:bg-flame-600 lg:inline-flex"
          >
            Get instant quote
          </QuoteCtaLink>

          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open menu"
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition lg:hidden ${pill}`}
              >
                <Menu className="h-[18px] w-[18px]" strokeWidth={2.75} />
              </button>
            </SheetTrigger>
            <SheetContent className="w-[300px] max-w-[90vw] bg-cream">
              <VisuallyHidden>
                <SheetTitle>Navigation Menu</SheetTitle>
              </VisuallyHidden>
              <div className="mt-2">
                <BrandMark />
              </div>
              <nav className="mt-8 flex flex-col" aria-label="Mobile">
                {[...NAV, ...SHEET_EXTRA].map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="border-b border-ink/10 py-3.5 text-lg font-medium text-ink transition-colors hover:text-flame-700"
                  >
                    {item.name}
                  </Link>
                ))}
                <QuoteCtaLink
                  href="/quote?source=menu_sheet"
                  onClick={onQuote}
                  className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-flame px-6 text-base font-semibold text-white hover:bg-flame-600"
                >
                  Get instant quote
                </QuoteCtaLink>
                <a
                  href={phone.voice.tel}
                  onClick={() => trackEvent("phone_click", { contact_surface: "mobile_header" })}
                  className="mt-3 inline-flex h-12 items-center justify-center rounded-full border border-ink/20 px-6 text-base font-semibold text-ink"
                >
                  Call {phone.voice.dashed}
                </a>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
