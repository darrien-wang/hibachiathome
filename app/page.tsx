"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import ProofStrip from "@/components/proof-strip"
import PartyPlannerSection from "@/components/party-planner-section"
import { PROOF_MEDIA } from "@/config/proof-media"
import { GOOGLE_REVIEWS } from "@/config/reviews"
import { GUEST_TIERS, MINIMUM_SPEND, WEEKDAY_SPECIAL } from "@/config/pricing-rules"
import { phone } from "@/config/site"
import { trackEvent } from "@/lib/tracking"

// 2026-09-08 redesign (Claude Design "Realhibachi 手机端优化调研"): one photo,
// one headline, one price, one CTA. Pricing as swipeable cards, three round
// dishes, two real reviews, three questions. Everything else moved to /menu,
// /faq and the city pages — the old homepage was ~700 lines of copy.

// 2560px sharpened/denoised master of gallery/…night-fire-show-18.jpg (the 48MP
// original is a soft phone upscale; served large it read as blur — 2026-09-08).
const HERO_IMG = "/images/hero/fire-show-hero.jpg"

const fmt = (v: number) => v.toFixed(2)

const FAQ = [
  {
    q: "How much space do you need?",
    a: "An 8×8 ft outdoor spot for the grill, with room for guests to gather around. We cook outside only.",
  },
  {
    q: "What if it rains?",
    a: "We cook rain or shine under a dry area — a 10×10 pop-up over the chef's station works. Need to cancel for weather? 72 hours' notice gets a full deposit refund.",
  },
  {
    q: "Cancellation policy",
    a: "Full deposit refund with 72 hours' notice. Your chef is confirmed by name 48 hours ahead — if we ever cancel, we refund double your deposit.",
  },
] as const

function PlanCard({
  kicker,
  title,
  price,
  unit,
  lines,
  cta,
  href,
  dark,
  onClick,
}: {
  kicker: string
  title: string
  price: string
  unit?: string
  lines: string[]
  cta: string
  href: string
  dark?: boolean
  onClick?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex w-[250px] shrink-0 snap-start flex-col gap-1.5 rounded-[28px] border p-5 transition md:w-auto md:p-7 ${
        dark
          ? "border-transparent bg-cocoa text-white shadow-organic-lg md:-translate-y-2"
          : "border-ink/10 bg-surface text-ink shadow-organic hover:border-flame-300"
      }`}
    >
      <span className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${dark ? "text-flame-300" : "text-gold-700"}`}>
        {kicker}
      </span>
      <span className="font-serif text-xl font-extrabold md:text-2xl">{title}</span>
      <span className="flex items-baseline gap-1">
        <span className={`font-serif text-[38px] font-extrabold leading-none md:text-5xl ${dark ? "text-flame-300" : ""}`}>{price}</span>
        {unit ? <span className={`text-[13px] ${dark ? "opacity-85" : "text-clay-700"}`}>{unit}</span> : null}
      </span>
      <span className={`text-[13px] leading-6 md:text-sm ${dark ? "opacity-90" : "text-clay-700"}`}>
        {lines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </span>
      <span
        className={`mt-2 inline-flex h-11 items-center justify-center rounded-full text-sm font-semibold ${
          dark ? "bg-flame text-white" : "border border-ink/15 text-ink"
        }`}
      >
        {cta}
      </span>
    </Link>
  )
}

export default function Home() {
  const onQuote = (surface: string) => () => trackEvent("lead_start", { contact_surface: surface })
  const reviews = GOOGLE_REVIEWS.filter((r) => ["Kelsey Molnar", "Lisa Craven", "Beatrix Barrera"].includes(r.name))
  const media = PROOF_MEDIA.slice(0, 6)

  return (
    <div className="bg-cream text-ink">
      {/* ── Hero ── full-bleed fire show, cocoa gradient, one price. */}
      <section className="relative isolate overflow-hidden bg-cocoa text-white">
        <Image
          src={HERO_IMG}
          alt="Live hibachi fire show at a backyard party in Orange County"
          fill
          priority
          quality={90}
          sizes="100vw"
          className="object-cover object-[60%_40%] saturate-[1.15] contrast-[1.06]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(42,26,16,.55)_0%,rgba(42,26,16,.15)_35%,rgba(42,26,16,.35)_60%,#2a1a10_100%)] lg:bg-[linear-gradient(90deg,rgba(42,26,16,.88)_0%,rgba(42,26,16,.6)_45%,rgba(42,26,16,.15)_100%),linear-gradient(180deg,rgba(42,26,16,.4),transparent_30%,#2a1a10_100%)]" />
        <div className="relative mx-auto max-w-7xl px-5 pb-8 pt-[calc(var(--header-height,60px)+170px)] lg:grid lg:grid-cols-[1.05fr_1fr] lg:items-end lg:gap-14 lg:px-8 lg:pb-24 lg:pt-[calc(var(--header-height,72px)+110px)]">
          <div className="flex flex-col gap-3.5 lg:gap-5">
            <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-flame-300 lg:text-[13px] lg:tracking-[0.14em]">
              Live fire show · at your table · all of SoCal
            </span>
            <h1 className="font-serif text-[42px] font-extrabold leading-[0.96] [text-shadow:0_2px_24px_rgba(0,0,0,.35)] lg:max-w-[12ch] lg:text-[72px] lg:leading-[0.95]">
              The Effortless Hibachi At Home Experience
            </h1>
            <p className="text-[15px] leading-relaxed text-white/80 lg:max-w-[520px] lg:text-lg">
              Plan the party in 3 minutes — spend the evening with the people you love.
            </p>
            <div className="flex items-baseline gap-2 pt-1 lg:hidden">
              <span className="font-serif text-[34px] font-extrabold leading-none text-flame-300">${fmt(GUEST_TIERS.adult.price)}</span>
              <span className="text-[13px] text-white/75">per adult · chef, food, show, setup &amp; cleanup</span>
            </div>
            <div className="hidden items-center gap-3 lg:flex">
              <Link
                href="/quote?source=home_hero"
                onClick={onQuote("home_hero")}
                className="inline-flex h-14 items-center rounded-full bg-flame px-8 text-[17px] font-semibold text-white transition hover:bg-flame-600"
              >
                Get instant quote · 30 sec
              </Link>
              <Link href="/menu" className="inline-flex h-14 items-center px-2 text-base font-semibold text-white hover:text-flame-300">
                See the menu →
              </Link>
            </div>
            <div className="flex flex-wrap gap-2 text-[12px] font-semibold lg:text-[13px]">
              {["500+ parties", "72h full refund", "Licensed & insured"].map((chip) => (
                <span key={chip} className="rounded-full border border-white/35 px-3 py-1.5">
                  {chip}
                </span>
              ))}
            </div>
          </div>
          <div className="hidden flex-col items-end gap-4 text-right lg:flex">
            <span className="text-[12px] uppercase tracking-[0.12em] text-white/70">Most parties pay</span>
            <span className="font-serif text-[76px] font-extrabold leading-none text-flame-300">
              ${fmt(GUEST_TIERS.adult.price)}
              <span className="font-sans text-xl font-normal text-white/75"> /adult</span>
            </span>
            <span className="text-sm text-white/80">Chef, food, live show, setup &amp; cleanup — all included</span>
            <span className="h-0.5 w-[120px] bg-flame" />
            <span className="max-w-[340px] text-sm text-white/80">
              Kids 5–12 ${fmt(GUEST_TIERS.child.price)}, under 5 free. ${MINIMUM_SPEND} minimum per event, no travel fee within 50 miles.
            </span>
          </div>
        </div>
      </section>

      {/* ── Real parties ── the pictures do the talking. Swipe / drag / arrows, tap to play. */}
      <section className="px-5 pt-6 lg:mx-auto lg:max-w-7xl lg:px-8 lg:pt-10">
        <ProofStrip media={media} size="sm" />
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="scroll-mt-20 pt-9 lg:pt-24">
        <div className="mx-auto max-w-7xl lg:px-8">
          <div className="flex items-end justify-between px-5 lg:px-0">
            <div>
              <h2 className="font-serif text-2xl font-extrabold lg:text-[40px]">
                <span className="lg:hidden">Pricing</span>
                <span className="hidden lg:inline">Pick the plan that fits your party</span>
              </h2>
              <p className="mt-1 hidden text-base text-clay-700 lg:block">
                Same food and chef show in every plan. Kids 5–12 half price, under 5 free.
              </p>
            </div>
            <span className="text-xs text-clay-600 lg:hidden">swipe →</span>
            <span className="hidden text-[13px] text-clay-600 lg:block">Optional setup +$15/guest · gratuity 20–25% customary</span>
          </div>
          <div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] md:grid md:grid-cols-3 md:items-stretch md:overflow-visible md:px-0 md:pt-3 lg:mt-7 lg:gap-5 [&::-webkit-scrollbar]:hidden">
            <PlanCard
              dark
              kicker="Most popular"
              title="Standard"
              price={`$${fmt(GUEST_TIERS.adult.price)}`}
              unit="/adult"
              lines={[
                `$${fmt(GUEST_TIERS.child.price)}/child · under 5 free`,
                "2 proteins, rice, veg, salad, show",
                `$${MINIMUM_SPEND} minimum`,
              ]}
              cta="Get instant quote"
              href="/quote?source=home_pricing_standard"
              onClick={onQuote("home_pricing_standard")}
            />
            <PlanCard
              kicker="Mon–Thu · any party size"
              title="Weekday Special"
              price={`$${fmt(GUEST_TIERS.adult.weekdayPrice)}`}
              unit="/adult"
              lines={[
                `$${fmt(GUEST_TIERS.child.weekdayPrice)}/child · under 5 free`,
                `${WEEKDAY_SPECIAL.appetizerPlatter.label} ($${WEEKDAY_SPECIAL.appetizerPlatter.value} value)`,
                "Full menu, upgrades welcome",
              ]}
              cta="Check weekday dates"
              href="/quote?source=home_pricing_weekday&plan=weekday"
              onClick={onQuote("home_pricing_weekday")}
            />
            <PlanCard
              kicker="30+ guests or special requests"
              title="Custom"
              price="Talk with us"
              lines={["Multi-chef planning, timeline and rental coordination"]}
              cta="Request custom plan"
              href="/contact?reason=Custom%20Pricing%20Request"
            />
          </div>
          <p className="mt-2 px-5 text-xs text-clay-600 lg:hidden">
            Optional full setup (tables, chairs, utensils) +$15/guest. Gratuity 20–25% customary.
          </p>
        </div>
      </section>

      {/* ── Party planner ── right after the pricing CTAs: whoever just read
          the price is the one most likely to care that planning is fun. */}
      <PartyPlannerSection />

      {/* ── Fresh off the griddle ── */}
      <section className="pt-9 lg:pt-24">
        <div className="mx-auto max-w-7xl px-5 lg:grid lg:grid-cols-2 lg:items-center lg:gap-14 lg:px-8">
          <div className="grid grid-cols-3 gap-2 lg:order-1 lg:gap-3.5">
            {[
              { src: "/images/menu/steak.jpg", label: "Steak", full: "Steak · 4.5 oz" },
              { src: "/images/menu/shrimp.jpg", label: "Jumbo shrimp", full: "Shrimp · 5 pcs" },
              { src: "/images/menu/chicken.jpg", label: "Chicken", full: "Chicken · 5 oz" },
            ].map((dish) => (
              <div key={dish.src} className="flex flex-col gap-1.5 lg:gap-2">
                <div className="relative aspect-square overflow-hidden rounded-full">
                  <Image src={dish.src} alt={dish.label} fill sizes="(max-width: 1024px) 33vw, 200px" className="object-cover saturate-[1.15]" />
                </div>
                <span className="text-center text-xs font-semibold lg:text-sm">
                  <span className="lg:hidden">{dish.label}</span>
                  <span className="hidden lg:inline">{dish.full}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-3 lg:mt-0 lg:gap-4">
            <h2 className="font-serif text-2xl font-extrabold lg:text-[40px] lg:leading-[1.1]">
              <span className="lg:hidden">Fresh off the griddle</span>
              <span className="hidden lg:inline">Fresh off the griddle, portions in writing</span>
            </h2>
            <p className="hidden text-base leading-relaxed text-clay-700 lg:block">
              Every guest picks 2 proteins. USDA Choice Angus sirloin, BAP-certified colossal shrimp, boneless breast — plus 8 oz
              fried rice, vegetables and salad. Refills free.
            </p>
            <Link
              href="/menu"
              onClick={() => trackEvent("menu_view")}
              className="inline-flex items-center gap-1 self-start text-sm font-semibold text-flame-700 hover:text-flame-800 lg:text-[15px]"
            >
              See full menu <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Reviews ── verbatim Google reviews, config/reviews.ts */}
      <section className="pt-9 lg:pt-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <h2 className="font-serif text-2xl font-extrabold lg:text-[40px]">Real reviews, real parties</h2>
          <div className="mt-3 flex flex-col gap-3 lg:mt-6 lg:grid lg:grid-cols-3 lg:gap-5">
            {reviews.map((review, i) => (
              <blockquote
                key={review.name}
                className={`flex flex-col gap-2 rounded-[28px] border border-ink/10 bg-surface p-[18px] shadow-organic lg:p-6 ${i === 2 ? "hidden lg:flex" : ""}`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full font-serif text-[15px] font-extrabold ${i % 2 ? "bg-flame-300" : "bg-gold-300"}`}>
                    {review.name.charAt(0)}
                  </span>
                  <span className="text-sm font-semibold">{review.name}</span>
                  <span className="ml-auto rounded-full bg-white px-2.5 py-0.5 text-[11px] text-ink/80">Google</span>
                </div>
                <p className="text-sm leading-6 text-ink/90 line-clamp-4 lg:line-clamp-none">{review.text}</p>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* ── Questions ── */}
      <section className="pt-9 lg:pt-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <h2 className="font-serif text-2xl font-extrabold lg:text-[40px]">Questions</h2>
          <div className="mt-2 lg:mt-4 lg:max-w-3xl">
            {FAQ.map((item) => (
              <details key={item.q} className="group border-b border-ink/15">
                <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-4 py-3.5 text-[15px] font-medium [&::-webkit-details-marker]:hidden lg:text-base">
                  {item.q}
                  <span className="text-xl leading-none text-flame transition group-open:rotate-45">+</span>
                </summary>
                <p className="pb-4 text-sm leading-relaxed text-clay-700 lg:text-[15px]">{item.a}</p>
              </details>
            ))}
          </div>
          <Link
            href="/faq"
            onClick={() => trackEvent("faq_view")}
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-flame-700 hover:text-flame-800"
          >
            All FAQs <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* ── Closing CTA ── desktop card; on phones the sticky bar below does the job. */}
      <section className="hidden pt-24 lg:block">
        <div className="mx-auto max-w-7xl px-8">
          <div className="flex items-center gap-8 rounded-[32px] bg-cocoa px-12 py-11 text-white">
            <div className="flex flex-1 flex-col gap-2">
              <h2 className="font-serif text-4xl font-extrabold leading-[1.1]">Ready to create great memories?</h2>
              <p className="text-base text-white/80">Exact price in 30 seconds. No phone number needed. A $19.90 deposit holds your date.</p>
            </div>
            <Link
              href="/quote?source=home_cta"
              onClick={onQuote("home_cta")}
              className="inline-flex h-14 items-center rounded-full bg-flame px-8 text-[17px] font-semibold text-white transition hover:bg-flame-600"
            >
              Get instant quote
            </Link>
          </div>
        </div>
      </section>

      <div className="h-10 lg:h-20" />

      {/* Mobile: one primary CTA, always within thumb reach. */}
      <div className="fixed inset-x-0 bottom-0 z-40 bg-[linear-gradient(to_top,#f7efe2_70%,transparent)] px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-4 lg:hidden">
        <Link
          href="/quote?source=home_sticky"
          onClick={onQuote("home_sticky")}
          className="flex h-[52px] w-full items-center justify-center rounded-full bg-flame text-base font-semibold text-white shadow-organic-lg active:bg-flame-600"
        >
          Get instant quote · 30 sec
        </Link>
        <p className="sr-only">Or call {phone.voice.dashed}</p>
      </div>
    </div>
  )
}
