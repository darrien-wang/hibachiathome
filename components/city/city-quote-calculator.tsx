"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Mail, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useLocCity } from "@/components/city/geo-city-name"
import { siteConfig } from "@/config/site"
import { trackEvent } from "@/lib/tracking"
import {
  GUEST_TIERS,
  MINIMUM_SPEND,
  WEEKDAY_SPECIAL,
  checkWeekdayEligibility,
  roundCurrency,
  weekdayBlackoutLabel,
} from "@/config/pricing-rules"

// First-screen estimator for the ad landing pages (city / catering / mobile /
// private chef). Clarity on 2026-09-06: paid visitors landing on these pages
// scrolled <25% and left without seeing a price — so the price, the date, and
// the two plans all live here, above the fold. All rates come from
// config/pricing-rules.ts — never hard-code a money value here.
//
// 2026-09-07 evening tapes: visitors typed into the inputs and tapped the price
// cards and hint text, but 0 of 31 reached /quote — on a real phone the
// keyboard / date picker covers the CTA. So: the price cards are now links
// into /quote (plan preselected), and on mobile a sticky bar keeps the CTA on
// screen while the visitor is editing.

const fmt = (value: number) => {
  const rounded = roundCurrency(value)
  return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(2)
}

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

function describeDate(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (Number.isNaN(d.getTime())) return null
  return `${WEEKDAY_NAMES[d.getDay()]} ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
}

export default function CityQuoteCalculator({
  citySlug,
  cityName,
  source,
  smsHref,
}: {
  citySlug: string
  cityName: string
  /** Overrides the default `city_<slug>` attribution source on the /quote link. */
  source?: string
  /** sms: link for the secondary CTA. Omit to hide it. */
  smsHref?: string
}) {
  const shownCity = useLocCity(cityName)
  const [adults, setAdults] = useState(15)
  const [kids, setKids] = useState(0)
  const [date, setDate] = useState("")
  const [touched, setTouched] = useState(false)
  const [ctaVisible, setCtaVisible] = useState(true)
  const ctaRef = useRef<HTMLDivElement | null>(null)

  const clamp = (n: number) => (Number.isFinite(n) && n >= 0 ? Math.min(n, 200) : 0)

  const standardSubtotal = roundCurrency(adults * GUEST_TIERS.adult.price + kids * GUEST_TIERS.child.price)
  const standard = Math.max(standardSubtotal, MINIMUM_SPEND)
  const atMinimum = standardSubtotal < MINIMUM_SPEND

  const weekdayTotal = Math.max(
    roundCurrency(adults * GUEST_TIERS.adult.weekdayPrice + kids * GUEST_TIERS.child.weekdayPrice),
    MINIMUM_SPEND,
  )

  const eligibility = useMemo(
    () => checkWeekdayEligibility(date, { adult: adults, child: kids, toddler: 0 }),
    [date, adults, kids],
  )
  const headcountOk = eligibility.isHeadcountEligible
  const dateKnown = /^\d{4}-\d{2}-\d{2}$/.test(date)
  const blackout = dateKnown ? weekdayBlackoutLabel(date) : null
  // No date yet: show the weekday price as reachable ("pick a Mon–Thu date").
  // Date set: it either applies or it doesn't.
  const weekdayApplies = dateKnown ? eligibility.isEligible : headcountOk
  const moreForWeekday = Math.max(1, Math.ceil(WEEKDAY_SPECIAL.minAdultEquivalents - eligibility.adultEquivalents))
  const dateLabel = dateKnown ? describeDate(date) : null

  const attribution = source ?? `city_${citySlug.replace(/-/g, "_")}`
  const buildHref = (plan: "weekday" | "standard" | "auto") => {
    const params = new URLSearchParams({ source: attribution, adults: String(adults), kids: String(kids) })
    if (dateKnown) params.set("date", date)
    const wantWeekday = plan === "weekday" || (plan === "auto" && weekdayApplies)
    if (wantWeekday) params.set("plan", "weekday")
    return `/quote?${params.toString()}`
  }
  const quoteHref = buildHref("auto")
  const chosenTotal = weekdayApplies ? weekdayTotal : standard

  // Email is the channel both ad-attributed bookings in 2026-08-31~09-07 came
  // through, yet paid landings had no email affordance (决策日志 D-0907-04).
  // Third CTA, tracked like /quote's — a hedge, not a change to SMS-first.
  const priceLine = weekdayApplies ? `$${fmt(weekdayTotal)} (Weekday Special)` : `$${fmt(standard)} (Standard)`
  const emailSubject = `Hibachi quote — ${adults} adults${kids ? `, ${kids} kids` : ""}${dateLabel ? `, ${dateLabel}` : ""} in ${shownCity}`
  const emailBody = [
    "Hi Real Hibachi,",
    "",
    "I priced a party on your site and would like to confirm details:",
    `- Guests: ${adults} adults${kids ? `, ${kids} kids (5-12)` : ""}`,
    `- Date: ${dateLabel ?? "TBD"}`,
    `- Location: ${shownCity}`,
    `- Estimate shown: ${priceLine}`,
    "",
    "My address / questions:",
    "",
  ].join("\n")
  const emailHref = `mailto:${siteConfig.contact.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`
  const onEmailClick = () => {
    trackEvent("contact_email_click", {
      contact_surface: "city_calculator",
      city_or_zip: shownCity,
      adults,
      kids,
      quote_plan: weekdayApplies ? "weekday" : "standard",
      quote_total: weekdayApplies ? weekdayTotal : standard,
      event_date: dateKnown ? date : "unspecified",
    })
  }

  const weekdayHint = (() => {
    if (blackout) return `${dateLabel} falls in ${blackout} — standard rate applies.`
    if (dateKnown && !eligibility.isDateEligible) return `${dateLabel} is a weekend — Weekday Special is Mon–Thu only.`
    if (!headcountOk)
      return `Weekday Special unlocks at ${WEEKDAY_SPECIAL.minAdultEquivalents}+ guests (kids 5–12 count as half). Add ${moreForWeekday} more.`
    if (!dateKnown) return "Pick a Mon–Thu date and this is your price."
    return `${dateLabel} qualifies — you save $${fmt(standard - weekdayTotal)}.`
  })()

  // Sticky mobile bar: shown once the visitor has touched an input and the
  // real CTA is off-screen. Measured against the *visual* viewport, not the
  // layout viewport: when the iOS keyboard or date picker opens, the layout
  // viewport does not shrink, so IntersectionObserver would keep reporting
  // the CTA as visible while it is actually hidden under the keyboard.
  useEffect(() => {
    if (!touched) return
    const check = () => {
      const el = ctaRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const vv = window.visualViewport
      const top = vv ? vv.offsetTop : 0
      const bottom = top + (vv ? vv.height : window.innerHeight)
      setCtaVisible(r.top >= top && r.bottom <= bottom)
    }
    check()
    window.addEventListener("scroll", check, { passive: true })
    window.addEventListener("resize", check)
    window.visualViewport?.addEventListener("resize", check)
    window.visualViewport?.addEventListener("scroll", check)
    const t = window.setInterval(check, 1000)
    return () => {
      window.removeEventListener("scroll", check)
      window.removeEventListener("resize", check)
      window.visualViewport?.removeEventListener("resize", check)
      window.visualViewport?.removeEventListener("scroll", check)
      window.clearInterval(t)
    }
  }, [touched])
  const showSticky = touched && !ctaVisible

  const cardBase = "block rounded-xl border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"

  return (
    <div
      id="price"
      className="scroll-mt-24 rounded-2xl border border-amber-200 bg-white/90 p-4 shadow-sm backdrop-blur-sm sm:p-6"
    >
      <p className="text-base font-bold text-gray-900 sm:text-lg">Your {shownCity} party, priced right here</p>
      <p className="mt-0.5 text-xs text-gray-600 sm:text-sm">No form, no phone number — just move the numbers.</p>

      <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3" onFocusCapture={() => setTouched(true)}>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700 sm:text-sm">Adults</span>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={200}
            value={adults}
            onChange={(e) => setAdults(clamp(Number(e.target.value)))}
            aria-label="Number of adults"
            className="h-11 text-base"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700 sm:text-sm">Kids 5–12</span>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={200}
            value={kids}
            onChange={(e) => setKids(clamp(Number(e.target.value)))}
            aria-label="Number of kids age 5 to 12"
            className="h-11 text-base"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700 sm:text-sm">Date</span>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Event date"
            className="h-11 text-base"
          />
        </label>
      </div>

      {/* Both plans are links — tapping a price is the most natural "yes" on a phone. */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3" aria-live="polite">
        <Link
          href={buildHref("weekday")}
          className={`${cardBase} ${
            weekdayApplies
              ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200"
              : "border-gray-200 bg-gray-50 hover:border-emerald-300"
          }`}
          aria-label={`Weekday Special, $${fmt(weekdayTotal)} total — get exact quote`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">Weekday Special</p>
          <p className="mt-0.5 text-xl font-bold text-emerald-800 sm:text-2xl">${fmt(weekdayTotal)}</p>
          <p className="text-[11px] leading-4 text-gray-600 sm:text-xs">
            ${fmt(GUEST_TIERS.adult.weekdayPrice)}/adult · ${fmt(GUEST_TIERS.child.weekdayPrice)}/kid · Mon–Thu ·{" "}
            {WEEKDAY_SPECIAL.minAdultEquivalents}+ guests
          </p>
          <p className="mt-1 text-[11px] font-semibold text-emerald-800 underline underline-offset-2">Choose &amp; get exact quote →</p>
        </Link>
        <Link
          href={buildHref("standard")}
          className={`${cardBase} ${
            weekdayApplies
              ? "border-gray-200 bg-gray-50 hover:border-orange-300"
              : "border-orange-300 bg-orange-50 ring-2 ring-orange-200"
          }`}
          aria-label={`Standard any day, $${fmt(standard)} total — get exact quote`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-800">Standard · any day</p>
          <p className="mt-0.5 text-xl font-bold text-orange-800 sm:text-2xl">${fmt(standard)}</p>
          <p className="text-[11px] leading-4 text-gray-600 sm:text-xs">
            ${fmt(GUEST_TIERS.adult.price)}/adult · ${fmt(GUEST_TIERS.child.price)}/kid · ${MINIMUM_SPEND} minimum
          </p>
          <p className="mt-1 text-[11px] font-semibold text-orange-800 underline underline-offset-2">Choose &amp; get exact quote →</p>
        </Link>
      </div>

      <p className="mt-2 text-xs text-gray-600">
        {weekdayHint}
        {atMinimum && !weekdayApplies ? ` Parties this size come in at the $${MINIMUM_SPEND} minimum.` : ""}
      </p>
      <p className="mt-1 text-[11px] text-gray-500 sm:text-xs">
        Under 5 eat free. Chef, grill, food, live show, setup &amp; cleanup included. First 50 miles free — any travel
        fee shows in your quote before you pay.
      </p>

      <div ref={ctaRef} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button
          asChild
          className="h-12 flex-1 rounded-full bg-[hsl(24_79%_55%)] px-6 text-base font-semibold text-white hover:bg-[hsl(24_79%_48%)]"
        >
          <Link href={quoteHref}>Get my exact quote — 30 seconds</Link>
        </Button>
        {smsHref ? (
          <Button
            asChild
            variant="outline"
            className="h-12 rounded-full border-2 border-[hsl(24_79%_55%)] bg-white px-5 text-[hsl(24_79%_55%)] hover:bg-[hsl(24_79%_96%)]"
          >
            <a href={smsHref}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Text us instead
            </a>
          </Button>
        ) : null}
        <Button
          asChild
          variant="outline"
          className="h-12 rounded-full border-2 border-[hsl(24_79%_55%)] bg-white px-5 text-[hsl(24_79%_55%)] hover:bg-[hsl(24_79%_96%)]"
        >
          <a href={emailHref} onClick={onEmailClick}>
            <Mail className="mr-2 h-4 w-4" />
            Email me this quote
          </a>
        </Button>
      </div>

      {showSticky ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-amber-200 bg-white/95 p-3 shadow-[0_-6px_20px_rgba(0,0,0,0.08)] backdrop-blur sm:hidden">
          <Button
            asChild
            className="h-12 w-full rounded-full bg-[hsl(24_79%_55%)] text-base font-semibold text-white hover:bg-[hsl(24_79%_48%)]"
          >
            <Link href={quoteHref}>
              Get my exact quote · ${fmt(chosenTotal)}
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  )
}
