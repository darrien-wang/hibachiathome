"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  GUEST_TIERS,
  MINIMUM_SPEND,
  WEEKDAY_SPECIAL,
  calcAdultEquivalents,
  roundCurrency,
} from "@/config/pricing-rules"

// Lightweight on-page estimator for city pages. Competitor research showed the
// winners either gate pricing behind forms or link away to a calculator; an
// answer directly on the ranking page beats both. All rates come from
// config/pricing-rules.ts — never hard-code a money value here.

const fmt = (value: number) => {
  const rounded = roundCurrency(value)
  return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(2)
}

export default function CityQuoteCalculator({ citySlug, cityName }: { citySlug: string; cityName: string }) {
  const [adults, setAdults] = useState(10)
  const [kids, setKids] = useState(0)

  const clamp = (n: number) => (Number.isFinite(n) && n >= 0 ? Math.min(n, 200) : 0)

  const standardSubtotal = roundCurrency(adults * GUEST_TIERS.adult.price + kids * GUEST_TIERS.child.price)
  const standard = Math.max(standardSubtotal, MINIMUM_SPEND)
  const atMinimum = standardSubtotal < MINIMUM_SPEND

  const adultEquivalents = calcAdultEquivalents({ adult: adults, child: kids, toddler: 0 })
  const weekdayEligible = adultEquivalents >= WEEKDAY_SPECIAL.minAdultEquivalents
  const weekday = Math.max(
    roundCurrency(adults * GUEST_TIERS.adult.weekdayPrice + kids * GUEST_TIERS.child.weekdayPrice),
    MINIMUM_SPEND,
  )
  const moreForWeekday = Math.max(1, Math.ceil(WEEKDAY_SPECIAL.minAdultEquivalents - adultEquivalents))

  const quoteHref = `/quote?source=city_${citySlug.replace(/-/g, "_")}&adults=${adults}&kids=${kids}`

  return (
    <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5 sm:p-6">
      <p className="text-lg font-bold text-gray-900">Your {cityName} party, priced right here</p>
      <p className="mt-1 text-sm text-gray-600">No form, no phone number — just move the numbers.</p>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:max-w-xs">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Adults</span>
          <Input
            type="number"
            min={0}
            max={200}
            value={adults}
            onChange={(e) => setAdults(clamp(Number(e.target.value)))}
            aria-label="Number of adults"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Kids 5–12</span>
          <Input
            type="number"
            min={0}
            max={200}
            value={kids}
            onChange={(e) => setKids(clamp(Number(e.target.value)))}
            aria-label="Number of kids age 5 to 12"
          />
        </label>
      </div>
      <div className="mt-4" aria-live="polite">
        <p className="text-2xl font-bold text-orange-800">
          ${fmt(standard)}
          <span className="ml-1 text-sm font-medium text-gray-600">Standard, any day</span>
        </p>
        {atMinimum && (
          <p className="mt-1 text-sm text-gray-600">
            That&apos;s our ${MINIMUM_SPEND} event minimum — parties this size all come in at ${MINIMUM_SPEND}, so a
            few extra guests won&apos;t raise the price.
          </p>
        )}
        {weekdayEligible ? (
          <p className="mt-2 text-lg font-semibold text-emerald-700">
            ${fmt(weekday)}
            <span className="ml-1 text-sm font-medium text-gray-600">Weekday Special (Mon–Thu)</span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-gray-600">
            Weekday Special — ${fmt(GUEST_TIERS.adult.weekdayPrice)}/adult on Mon–Thu — unlocks at{" "}
            {WEEKDAY_SPECIAL.minAdultEquivalents}+ guests (kids 5–12 count as half). Add {moreForWeekday} more to
            qualify.
          </p>
        )}
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Food, chef, live show, setup & cleanup included. ${MINIMUM_SPEND} event minimum. Travel confirmed in your
        quote — first 50 miles free.
      </p>
      <Button
        asChild
        className="mt-4 h-11 rounded-full bg-[hsl(24_79%_55%)] px-8 text-white hover:bg-[hsl(24_79%_48%)]"
      >
        <Link href={quoteHref}>Lock this in — exact quote in 30 seconds</Link>
      </Button>
    </div>
  )
}
