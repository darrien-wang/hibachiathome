"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { trackEvent } from "@/lib/tracking"

// Trust markers under the CTA — every claim here must stay verifiable from
// our own published policies (24/7 self-service booking & changes, FAQ refund
// terms, party count). Within 48h of an event, changes route through the team.
const TRUST_MARKERS = ["Book & modify online 24/7", "500+ parties served", "Full deposit refund up to 72h"]

export default function HeroSection() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const handlePrimaryCtaClick = () => {
    trackEvent("lead_start", { contact_surface: "hero_primary_cta" })
  }

  const handleSecondaryCtaClick = () => {
    trackEvent("menu_view", { cta_surface: "hero_secondary_cta" })
  }

  return (
    <section className="relative h-screen min-h-[600px] flex items-center justify-center">
      {isMobile ? (
        /* 移动端：全屏视频背景 */
        <div className="absolute inset-0 overflow-hidden bg-black z-0">
          <video
            className="w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            poster="/images/hibachi-dinner-party.jpg"
          >
            <source src="/videos/hero-loop.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-black/30"></div>
        </div>
      ) : (
        /* 桌面端：模糊海报底 + 中心竖版视频（单一视频解码，背景用图片省一路解码） */
        <div className="absolute inset-0 overflow-hidden bg-black z-0">
          <img
            src="/images/hibachi-dinner-party.jpg"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover blur-lg scale-110"
          />
          <div className="absolute inset-0 bg-black/50"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative h-full max-w-[500px] w-full max-h-[90vh] aspect-[9/16] bg-black rounded-lg overflow-hidden shadow-2xl">
              <video
                className="w-full h-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                poster="/images/hibachi-dinner-party.jpg"
              >
                <source src="/videos/hero-loop.mp4" type="video/mp4" />
              </video>
              <div className="absolute inset-0 border border-white/10 rounded-lg pointer-events-none"></div>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 relative z-30 text-center text-white h-full flex flex-col justify-start py-16">
        <div
          className="relative max-w-3xl mx-auto"
          style={{ marginTop: isMobile ? "calc(24vh - 80px)" : "calc(14vh - 40px)", fontFamily: "var(--font-montserrat)" }}
        >
          <p className="text-base md:text-lg font-semibold tracking-wide text-amber-200 drop-shadow">Private Hibachi Catering</p>
          <h1 className="mt-2 text-5xl md:text-7xl font-extrabold leading-[0.95] tracking-tight text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.55)]">
            The Effortless
            <br />
            Hibachi At Home
            <br />
            Experience
          </h1>
          <p className="mt-4 text-xl md:text-3xl font-bold text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.5)]">
            Plan the party in 3 minutes — spend the evening with the people you love.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4">
            <Button
              asChild
              onClick={handlePrimaryCtaClick}
              className="bg-white text-black hover:bg-white/90 min-w-[240px] rounded-full h-14 text-lg font-extrabold tracking-wide"
            >
              <Link href="/quote">Get Instant Quote</Link>
            </Button>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[13px] font-medium text-white/85 drop-shadow">
              {TRUST_MARKERS.map((item, i) => (
                <span key={item} className="flex items-center gap-3">
                  {i > 0 && <span className="text-white/40">·</span>}
                  {item}
                </span>
              ))}
            </div>
            <Link href="/menu" onClick={handleSecondaryCtaClick} className="text-white/85 text-sm underline underline-offset-4 hover:text-white">
              View Menu
            </Link>
          </div>
        </div>

        <div className="mt-auto mb-12 md:mb-20 animate-slideUp relative"></div>
      </div>
    </section>
  )
}
