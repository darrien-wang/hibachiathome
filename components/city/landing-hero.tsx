import type { ComponentProps, ReactNode } from "react"
import Image from "next/image"
import LandingEstimator from "@/components/city/landing-estimator"
import { TRAVEL_FREE_RADIUS_MILES } from "@/config/pricing-rules"

// ============================================================
// The Joshua Tree first screen, for every landing-type page
// ============================================================
// Photo hero on cocoa, kicker + h1 + chips on the left, and the estimate card
// that asks for the phone first: in the hero on desktop, overlapping the
// hero's bottom edge on phones. Pulled out of LandingTemplate on 2026-09-21 so
// the city pages, the occasion pages, the menu and the hub pages all open the
// same way (owner: "所有的页面都类似 /hibachi-at-home/joshua-tree"). The card
// brings its own sticky phone bar; pages using this need pb-28 lg:pb-* at the
// root so the bar never covers the last section.

export const HERO_IMG = "/images/hero/fire-show-hero.jpg"
// Inside-the-card proof photo: a different real party from the hero shot.
export const CARD_PROOF_IMG = "/gallery/real-hibachi-party-los-angeles-chef-guest-game-17.jpg"
export const HERO_CHIPS = ["Free to cancel 72h+", "Our own chefs", "500+ parties"]

/** "First 50 mi free" for pages that cannot know the visitor's distance. */
export const FIRST_MILES_FREE = `First ${TRAVEL_FREE_RADIUS_MILES} mi free`

export type LandingHeroProps = {
  kicker: ReactNode
  title: ReactNode
  /** Desktop-only line under the h1 (phones get the chips, not a paragraph). */
  subhead?: ReactNode
  chips?: string[]
  /** Small crumb trail above the kicker (occasion pages). */
  breadcrumb?: ReactNode
  image?: string
  imageAlt: string
  /** Focal point / grading override for photos that are not the fire show. */
  imageClassName?: string
  estimator: ComponentProps<typeof LandingEstimator>
}

export default function LandingHero({
  kicker,
  title,
  subhead,
  chips = HERO_CHIPS,
  breadcrumb,
  image = HERO_IMG,
  imageAlt,
  imageClassName = "object-[60%_40%] saturate-[1.15] contrast-[1.06] lg:object-[center_45%]",
  estimator,
}: LandingHeroProps) {
  const card = { proofImage: CARD_PROOF_IMG, ...estimator }
  return (
    <>
      <section className="relative isolate overflow-hidden bg-cocoa text-white">
        <Image src={image} alt={imageAlt} fill priority quality={90} sizes="100vw" className={`object-cover ${imageClassName}`} />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(42,26,16,.6)_0%,rgba(42,26,16,.2)_30%,rgba(42,26,16,.5)_60%,#2a1a10_100%)] lg:bg-[linear-gradient(90deg,rgba(42,26,16,.9)_0%,rgba(42,26,16,.65)_50%,rgba(42,26,16,.25)_100%),linear-gradient(180deg,rgba(42,26,16,.3),transparent_30%,#2a1a10_100%)]" />
        <div className="relative mx-auto max-w-7xl px-5 pb-9 pt-[calc(var(--header-height,60px)+84px)] lg:grid lg:grid-cols-[1fr_400px] lg:items-center lg:gap-14 lg:px-8 lg:pb-[70px] lg:pt-[calc(var(--header-height,72px)+48px)]">
          <div className="flex flex-col gap-3 lg:gap-5">
            {breadcrumb ? <div className="text-xs text-white/75 lg:text-[13px]">{breadcrumb}</div> : null}
            <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-flame-300 lg:text-[13px] lg:tracking-[0.14em]">{kicker}</span>
            <h1 className="font-serif text-[40px] font-extrabold leading-[0.98] [text-shadow:0_2px_24px_rgba(0,0,0,.35)] lg:text-[64px] lg:leading-[0.95]">{title}</h1>
            {subhead ? <p className="hidden text-[15px] leading-relaxed text-white/85 lg:block lg:max-w-[520px] lg:text-lg">{subhead}</p> : null}
            <div className="flex flex-wrap gap-2 text-[12px] font-semibold lg:text-[13px]">
              {chips.map((chip) => (
                <span key={chip} className="rounded-full border border-white/40 px-3 py-1.5">
                  {chip}
                </span>
              ))}
            </div>
          </div>
          <div className="hidden lg:block">
            <LandingEstimator {...card} />
          </div>
        </div>
      </section>

      {/* Phones: the estimator overlaps the hero's bottom edge. */}
      <div className="relative z-[2] -mt-3.5 px-4 lg:hidden">
        <LandingEstimator {...card} />
      </div>
    </>
  )
}
