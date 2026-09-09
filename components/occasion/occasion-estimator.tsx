"use client"

import { useState } from "react"
import Link from "next/link"
import EstimatorRow from "@/components/ui/estimator-row"
import { GUEST_TIERS, MINIMUM_SPEND, DEPOSIT_AMOUNT, roundCurrency } from "@/config/pricing-rules"
import { trackEvent } from "@/lib/tracking"

// The occasion page's 30-second estimate (Claude Design "Realhibachi Party",
// 2026-09-08): adults + kids steppers, Standard-plan total with the $599
// minimum called out before anyone books, one button. Weekday special and
// add-ons live on /quote. The card and the phone's sticky bar share state.

const fmt = (v: number) => `$${roundCurrency(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function OccasionEstimator({
  occasionLabel,
  source,
  smsHref,
  variant = "card",
}: {
  /** Lower-case occasion name, e.g. "birthday party" — "Your birthday party". */
  occasionLabel: string
  source: string
  smsHref: string
  /** "card" renders the estimator card; "sticky" renders only the phone bar. */
  variant?: "card" | "sticky"
}) {
  const [adults, setAdults] = useState(10)
  const [kids, setKids] = useState(2)
  const raw = roundCurrency(adults * GUEST_TIERS.adult.price + kids * GUEST_TIERS.child.price)
  const underMin = raw < MINIMUM_SPEND
  const total = Math.max(raw, MINIMUM_SPEND)
  const minAdults = Math.ceil(MINIMUM_SPEND / GUEST_TIERS.adult.price)
  const params = new URLSearchParams({ source, adults: String(adults), kids: String(kids) })
  const quoteHref = `/quote?${params.toString()}`
  const onQuote = (surface: string) => () => trackEvent("lead_start", { contact_surface: surface, adults, kids, quote_total: total })
  const onSms = (surface: string) => () => trackEvent("sms_click", { contact_surface: surface })

  const row = (label: string, sub: string, value: number, set: (v: number) => void, min: number, field?: string) => (
    <EstimatorRow label={label} sub={sub} value={value} onValueChange={set} min={min} data-quote-field={field} />
  )

  if (variant === "sticky") {
    return (
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 bg-[linear-gradient(180deg,rgba(247,239,226,0)_0%,#f7efe2_30%)] px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 lg:hidden">
        <a href={smsHref} onClick={onSms("occasion_sticky")} className="inline-flex h-[50px] items-center rounded-full border border-ink/15 bg-white px-[18px] text-sm font-semibold text-ink">
          Text us
        </a>
        <Link href={quoteHref} onClick={onQuote("occasion_sticky")} className="flex h-[50px] flex-1 items-center justify-center rounded-full bg-flame text-[15px] font-bold text-white shadow-organic-lg">
          Get exact quote · {fmt(total)}
        </Link>
      </div>
    )
  }

  return (
    <div id="price" className="scroll-mt-24 flex flex-col gap-3.5 rounded-[28px] border border-ink/10 bg-white p-[18px] text-ink shadow-organic-lg lg:p-[22px]">
      <div className="flex items-baseline justify-between gap-2.5">
        <span className="min-w-0 truncate text-[13px] font-bold uppercase tracking-[0.06em] text-clay-600">Your {occasionLabel}</span>
        <span className="shrink-0 text-xs text-clay-600">30-sec estimate</span>
      </div>
      {row("Adults", `$${GUEST_TIERS.adult.price.toFixed(2)} each`, adults, setAdults, 1, "adults")}
      {row("Kids 5–12", `$${GUEST_TIERS.child.price.toFixed(2)} · under 5 free`, kids, setKids, 0, "kids")}
      <div className="flex items-end justify-between border-t border-ink/10 pt-2">
        <div>
          <p className="text-xs text-clay-600">{underMin ? "Event minimum" : `${adults} adults · ${kids} kids`}</p>
          <p className="font-serif text-4xl font-extrabold leading-none lg:text-[38px]" aria-live="polite">
            {fmt(total)}
          </p>
        </div>
        <p className="text-right text-xs font-semibold leading-snug text-gold-700">
          Setup &amp; cleanup
          <br />
          included
        </p>
      </div>
      {underMin ? (
        <p className="rounded-lg bg-flame-100 px-2.5 py-2 text-xs leading-snug text-flame-700">
          Small group? The ${MINIMUM_SPEND} event minimum still applies — {minAdults} adults covers it, or add upgrades like filet or lobster.
        </p>
      ) : null}
      <div className="hidden flex-col gap-1.5 text-[13px] leading-snug text-clay-700 lg:flex">
        <span className="flex gap-2"><span className="font-bold text-gold-700">✓</span>Chef, grill, 2 proteins per guest, rice, veggies, salad</span>
        <span className="flex gap-2"><span className="font-bold text-gold-700">✓</span>Live fire show, games, setup and cleanup</span>
      </div>
      <Link href={quoteHref} onClick={onQuote("occasion_card")} className="flex h-[52px] items-center justify-center rounded-full bg-flame text-base font-bold text-white transition hover:bg-flame-600">
        Get my exact quote
      </Link>
      <a href={smsHref} onClick={onSms("occasion_card")} className="hidden h-[46px] items-center justify-center rounded-full border border-ink/15 text-sm font-semibold text-ink lg:flex">
        Text (213) 770-7788
      </a>
      <p className="text-center text-xs text-clay-600">${DEPOSIT_AMOUNT.toFixed(2)} refundable deposit locks your date · no sign-up</p>
    </div>
  )
}
