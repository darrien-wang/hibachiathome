"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// Lightweight on-page estimator for city pages. Competitor research showed the
// winners either gate pricing behind forms or link away to a calculator; an
// answer directly on the ranking page beats both. Mirrors config/pricing:
// $59.90/adult, $29.90/child 5-12, $599 event minimum, weekday tier Mon-Thu.
const ADULT = 59.9
const KID = 29.9
const WEEKDAY_ADULT = 45.9
const WEEKDAY_KID = 22.95
const MINIMUM = 599

export default function CityQuoteCalculator({ citySlug, cityName }: { citySlug: string; cityName: string }) {
  const [adults, setAdults] = useState(10)
  const [kids, setKids] = useState(0)

  const clamp = (n: number) => (Number.isFinite(n) && n >= 0 ? Math.min(n, 200) : 0)
  const standard = Math.max(adults * ADULT + kids * KID, MINIMUM)
  const weekday = Math.max(adults * WEEKDAY_ADULT + kids * WEEKDAY_KID, MINIMUM)
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
      <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <p className="text-2xl font-bold text-orange-800" aria-live="polite">
          ${standard.toFixed(0)}
          <span className="ml-1 text-sm font-medium text-gray-600">Standard, any day</span>
        </p>
        <p className="text-lg font-semibold text-emerald-700" aria-live="polite">
          ${weekday.toFixed(0)}
          <span className="ml-1 text-sm font-medium text-gray-600">Weekday Special (Mon–Thu)</span>
        </p>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Food, chef, live show, setup & cleanup included. $599 event minimum. Travel confirmed in your quote — first 50
        miles free.
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
