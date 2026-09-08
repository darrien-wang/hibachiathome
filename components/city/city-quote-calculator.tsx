"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { CalendarDays, Check, ChevronRight, Mail, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import GuestStepper from "@/components/ui/guest-stepper"
import InfoTip from "@/components/ui/info-tip"
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

  // One short status phrase on the date row instead of a paragraph of rules.
  const dateStatus = (() => {
    if (!dateKnown) return "Mon–Thu saves"
    if (weekdayApplies) return `Saves $${fmt(standard - weekdayTotal)}`
    if (blackout) return "Holiday · standard"
    if (!eligibility.isDateEligible) return "Weekend · standard"
    return `${moreForWeekday} more for Mon–Thu rate`
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
      <div className="flex items-center justify-between gap-2">
        <p className="text-base font-bold text-gray-900 sm:text-lg">Your {shownCity} party</p>
        <InfoTip label="What's included in the price?" title="What's included">
          <ul className="list-disc space-y-1 pl-4">
            <li>Chef, grill, food &amp; live show</li>
            <li>Setup &amp; cleanup</li>
            <li>Kids under 5 eat free</li>
            <li>First 50 miles of travel free — any travel fee shows before you pay</li>
            <li>
              Weekday Special: ${fmt(GUEST_TIERS.adult.weekdayPrice)}/adult · ${fmt(GUEST_TIERS.child.weekdayPrice)}/kid, Mon–Thu,{" "}
              {WEEKDAY_SPECIAL.minAdultEquivalents}+ guests (kids count as half)
            </li>
            <li>
              Standard: ${fmt(GUEST_TIERS.adult.price)}/adult · ${fmt(GUEST_TIERS.child.price)}/kid, any day, ${MINIMUM_SPEND} minimum
            </li>
          </ul>
        </InfoTip>
      </div>

      {/* Guests as steppers (no keyboard), then one big date row. The 09-07 tapes
          showed the phone keyboard covering the CTA as soon as a number box was
          tapped; the stepper changes the count with a thumb instead. */}
      <div className="mt-3 flex flex-col gap-2.5" onFocusCapture={() => setTouched(true)} onPointerDownCapture={() => setTouched(true)}>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-gray-700 sm:text-xs">Adults</span>
            <GuestStepper value={adults} onValueChange={setAdults} min={0} max={200} label="Number of adults" data-quote-field="adults" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-gray-700 sm:text-xs">Kids 5–12</span>
            <GuestStepper value={kids} onValueChange={setKids} min={0} max={200} label="Number of kids age 5 to 12" data-quote-field="kids" />
          </div>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-gray-700 sm:text-xs">Event date</span>
          <span className="relative flex h-11 items-center rounded-xl border border-gray-200 bg-white">
            <CalendarDays className="pointer-events-none absolute left-3 h-4 w-4 text-gray-500" aria-hidden="true" />
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Event date"
              data-quote-field="date"
              className="h-11 border-0 bg-transparent pl-9 pr-2 text-base shadow-none focus-visible:ring-0"
            />
            <span className={`pointer-events-none absolute right-3 max-w-[46%] truncate text-[11px] font-semibold ${weekdayApplies ? "text-emerald-700" : "text-gray-500"}`}>
              {dateStatus}
            </span>
          </span>
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
          <p className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
            Weekday Special
            {weekdayApplies ? <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <ChevronRight className="h-4 w-4 text-gray-400" aria-hidden="true" />}
          </p>
          <p className="mt-0.5 text-xl font-bold text-emerald-800 sm:text-2xl">${fmt(weekdayTotal)}</p>
          <p className="text-[11px] leading-4 text-gray-600 sm:text-xs">Mon–Thu · {WEEKDAY_SPECIAL.minAdultEquivalents}+ guests</p>
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
          <p className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-orange-800">
            Standard · any day
            {weekdayApplies ? <ChevronRight className="h-4 w-4 text-gray-400" aria-hidden="true" /> : <Check className="h-4 w-4 text-orange-600" aria-hidden="true" />}
          </p>
          <p className="mt-0.5 text-xl font-bold text-orange-800 sm:text-2xl">${fmt(standard)}</p>
          <p className="text-[11px] leading-4 text-gray-600 sm:text-xs">Any day{atMinimum ? ` · $${MINIMUM_SPEND} minimum` : ""}</p>
        </Link>
      </div>

      <div ref={ctaRef} className="mt-3 flex flex-col gap-2">
        <Button
          asChild
          className="h-[52px] w-full rounded-full bg-[hsl(24_79%_55%)] px-6 text-base font-semibold text-white hover:bg-[hsl(24_79%_48%)]"
        >
          <Link href={quoteHref}>Get my exact quote</Link>
        </Button>
        <div className={`grid gap-2 ${smsHref ? "grid-cols-2" : "grid-cols-1"}`}>
          {smsHref ? (
            <Button
              asChild
              variant="outline"
              className="h-11 rounded-full border-2 border-[hsl(24_79%_55%)] bg-white px-3 text-sm font-semibold text-[hsl(24_79%_45%)] hover:bg-[hsl(24_79%_96%)]"
            >
              <a href={smsHref}>
                <MessageSquare className="mr-1.5 h-4 w-4" />
                Text us
              </a>
            </Button>
          ) : null}
          <Button
            asChild
            variant="outline"
            className="h-11 rounded-full border-2 border-[hsl(24_79%_55%)] bg-white px-3 text-sm font-semibold text-[hsl(24_79%_45%)] hover:bg-[hsl(24_79%_96%)]"
          >
            <a href={emailHref} onClick={onEmailClick}>
              <Mail className="mr-1.5 h-4 w-4" />
              Email us
            </a>
          </Button>
        </div>
      </div>

      {showSticky ? (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-amber-200 bg-white/95 px-3 py-2.5 shadow-[0_-6px_20px_rgba(0,0,0,0.08)] backdrop-blur sm:hidden">
          <div className="flex shrink-0 flex-col leading-tight">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Your party</span>
            <span className={`text-lg font-bold ${weekdayApplies ? "text-emerald-800" : "text-orange-800"}`}>${fmt(chosenTotal)}</span>
          </div>
          <Button
            asChild
            className="h-[46px] flex-1 rounded-full bg-[hsl(24_79%_55%)] text-[15px] font-semibold text-white hover:bg-[hsl(24_79%_48%)]"
          >
            <Link href={quoteHref}>Get my exact quote</Link>
          </Button>
        </div>
      ) : null}
    </div>
  )
}
