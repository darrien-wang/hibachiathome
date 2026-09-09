"use client"

import { useState } from "react"
import Link from "next/link"
import { Minus, Plus } from "lucide-react"
import EstimatorRow from "@/components/ui/estimator-row"
import { GUEST_TIERS, MINIMUM_SPEND } from "@/config/pricing-rules"
import { trackEvent } from "@/lib/tracking"

// The menu's quick estimate: adults only, any day, one tap to the exact quote.
// Kids, weekday special and add-ons are handled on /quote — the paid
// "Menu & Pricing" sitelink (26 sessions / 0 forms to 09-07) needs a price
// and one button here, not a second form.
export default function MenuEstimatorBar({ variant = "sticky" }: { variant?: "sticky" | "card" }) {
  const [adults, setAdults] = useState(15)
  const total = Math.max(MINIMUM_SPEND, Math.round(adults * GUEST_TIERS.adult.price * 100) / 100)
  const totalLabel = `$${total % 1 === 0 ? total.toFixed(0) : total.toFixed(2)}`
  const href = `/quote?source=menu_estimator&adults=${adults}`
  const onQuote = () => trackEvent("lead_start", { contact_surface: "menu_estimator", adults })

  if (variant === "card") {
    return (
      <div className="flex flex-col gap-4 rounded-[28px] border border-ink/10 bg-white p-6 shadow-organic-lg">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-clay-600">Quick estimate</p>
        <EstimatorRow
          label="Adults"
          sub={`any day · $${GUEST_TIERS.adult.price.toFixed(2)}`}
          value={adults}
          onValueChange={setAdults}
          min={1}
        />
        <div className="flex items-baseline gap-1.5 border-t border-ink/10 pt-3">
          <span className="font-serif text-[40px] font-extrabold leading-none">{totalLabel}</span>
          <span className="text-[13px] text-clay-600">all-in, no travel fee within 50 mi</span>
        </div>
        <Link href={href} onClick={onQuote} className="inline-flex h-[50px] items-center justify-center rounded-full bg-flame text-[15px] font-semibold text-white hover:bg-flame-600">
          Get my exact quote
        </Link>
        <p className="text-center text-xs text-clay-600">Kids, weekday special and add-ons on the next screen</p>
      </div>
    )
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 bg-[linear-gradient(to_top,#f7efe2_70%,transparent)] px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-4 lg:hidden">
      <div className="flex items-center gap-2 rounded-[28px] border border-ink/10 bg-white py-3 pl-[18px] pr-3 shadow-organic-lg">
        <div className="flex-1">
          <p className="text-xs text-clay-600">{adults} adults · any day</p>
          <p className="font-serif text-[22px] font-extrabold leading-[1.1]">{totalLabel}</p>
        </div>
        <button type="button" aria-label="Fewer adults" onClick={() => setAdults((a) => Math.max(1, a - 1))} className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/15 text-ink">
          <Minus className="h-4 w-4" />
        </button>
        <button type="button" aria-label="More adults" onClick={() => setAdults((a) => Math.min(200, a + 1))} className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/15 text-ink">
          <Plus className="h-4 w-4" />
        </button>
        <Link href={href} onClick={onQuote} className="inline-flex h-11 items-center rounded-full bg-flame px-4 text-sm font-semibold text-white">
          Exact quote
        </Link>
      </div>
    </div>
  )
}
