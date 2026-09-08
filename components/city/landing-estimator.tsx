"use client"

import { useState } from "react"
import Link from "next/link"
import { Mail, MessageSquare, Minus, Phone, Plus } from "lucide-react"
import { useLocCity } from "@/components/city/geo-city-name"
import { phone, siteConfig } from "@/config/site"
import { trackEvent } from "@/lib/tracking"
import { GUEST_TIERS, MINIMUM_SPEND, WEEKDAY_SPECIAL, roundCurrency } from "@/config/pricing-rules"

// The ad landing page's 30-second estimate (Claude Design "Realhibachi Landing
// Page", 2026-09-08): adults stepper, any-day / Mon–Thu toggle, one total, one
// button. Kids, the exact date and add-ons are handled on /quote — the 09-07
// tapes showed every extra field on this screen cost handoffs. The card and
// the phone's sticky bar share this state, so the number the visitor taps
// through with is the number they see on /quote.

const fmt = (v: number) => {
  const r = roundCurrency(v)
  return `$${r.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function LandingEstimator({
  citySlug,
  cityName,
  source,
  smsHref,
}: {
  citySlug: string
  cityName: string
  source?: string
  smsHref?: string
}) {
  const shownCity = useLocCity(cityName)
  const [adults, setAdults] = useState(15)
  const [weekday, setWeekday] = useState(false)

  const qualifies = weekday && adults >= WEEKDAY_SPECIAL.minAdultEquivalents
  const rate = qualifies ? GUEST_TIERS.adult.weekdayPrice : GUEST_TIERS.adult.price
  const raw = roundCurrency(adults * rate)
  const total = Math.max(raw, MINIMUM_SPEND)
  const minApplied = !qualifies && raw < MINIMUM_SPEND

  const attribution = source ?? `city_${citySlug.replace(/-/g, "_")}`
  const params = new URLSearchParams({ source: attribution, adults: String(adults) })
  if (weekday) params.set("plan", "weekday")
  const quoteHref = `/quote?${params.toString()}`

  const planLabel = qualifies
    ? `Weekday Special · ${adults} adults`
    : minApplied
      ? `Standard · $${MINIMUM_SPEND} event minimum`
      : `Standard · ${adults} adults`
  const planShort = qualifies ? "Mon–Thu" : "any day"

  const onQuote = (surface: string) => () =>
    trackEvent("lead_start", { contact_surface: surface, adults, quote_plan: qualifies ? "weekday" : "standard", quote_total: total })
  const emailHref = `mailto:${siteConfig.contact.email}?subject=${encodeURIComponent(`Hibachi quote — ${adults} adults in ${shownCity}`)}&body=${encodeURIComponent(
    `Hi Real Hibachi,\n\nI priced a party on your site:\n- Guests: ${adults} adults\n- Location: ${shownCity}\n- Estimate shown: ${fmt(total)} (${qualifies ? "Weekday Special" : "Standard"})\n\nMy date / questions:\n`,
  )}`
  const onEmailClick = () =>
    trackEvent("contact_email_click", {
      contact_surface: "city_calculator",
      city_or_zip: shownCity,
      adults,
      kids: 0,
      quote_plan: qualifies ? "weekday" : "standard",
      quote_total: total,
      event_date: "unspecified",
    })

  const stepBtn = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink transition disabled:opacity-35"
  const toggle = (on: boolean) =>
    `h-11 flex-1 rounded-full text-[13px] font-semibold transition ${on ? "bg-flame text-white" : "bg-cream text-ink hover:bg-ink/5"}`

  return (
    <>
      <div id="price" className="scroll-mt-24 flex flex-col gap-3.5 rounded-[28px] border border-ink/10 bg-white p-[18px] shadow-organic-lg lg:p-[22px]">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-bold uppercase tracking-[0.06em] text-clay-600">Your {shownCity} party</span>
          <span className="text-xs text-clay-600">30-sec estimate</span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex-1">
            <p className="text-[15px] font-semibold">Adults</p>
            <p className="text-xs text-clay-600">kids 5–12 half · under 5 free</p>
          </div>
          <button type="button" aria-label="Fewer adults" disabled={adults <= 1} onClick={() => setAdults((a) => Math.max(1, a - 1))} className={`${stepBtn} border border-ink/15`}>
            <Minus className="h-4 w-4" />
          </button>
          <span data-quote-field="adults" className="w-9 text-center font-serif text-[26px] font-extrabold tabular-nums">{adults}</span>
          <button type="button" aria-label="More adults" onClick={() => setAdults((a) => Math.min(200, a + 1))} className={`${stepBtn} bg-flame text-white`}>
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-2" role="radiogroup" aria-label="Pricing plan">
          <button type="button" role="radio" aria-checked={!weekday} onClick={() => setWeekday(false)} className={toggle(!weekday)}>
            Any day · ${GUEST_TIERS.adult.price.toFixed(2)}
          </button>
          <button type="button" role="radio" aria-checked={weekday} onClick={() => setWeekday(true)} className={toggle(weekday)}>
            Mon–Thu · ${GUEST_TIERS.adult.weekdayPrice.toFixed(2)}
          </button>
        </div>
        <div className="flex items-end justify-between border-t border-ink/10 pt-2">
          <div>
            <p className="text-xs text-clay-600">{planLabel}</p>
            <p className="font-serif text-4xl font-extrabold leading-none lg:text-[40px]" aria-live="polite">
              {fmt(total)}
            </p>
          </div>
          <p className="text-right text-xs font-semibold leading-snug text-gold-700">
            Travel included
            <br />
            No fees hidden
          </p>
        </div>
        {weekday && !qualifies ? (
          <p className="rounded-lg bg-flame-100 px-2.5 py-2 text-xs leading-snug text-flame-700">
            Weekday Special unlocks at {WEEKDAY_SPECIAL.minAdultEquivalents} guests — add {WEEKDAY_SPECIAL.minAdultEquivalents - adults} more, or switch to
            any-day pricing.
          </p>
        ) : null}
        <Link
          href={quoteHref}
          onClick={onQuote("landing_card")}
          className="flex h-[52px] items-center justify-center rounded-full bg-flame text-base font-bold text-white transition hover:bg-flame-600"
        >
          Get my exact quote
        </Link>
        <p className="text-center text-xs text-clay-600">No phone number needed · exact travel fee shown before you pay</p>
        <div className="flex items-center justify-center gap-4 text-xs font-semibold text-clay-700">
          {smsHref ? (
            <a href={smsHref} className="inline-flex items-center gap-1 hover:text-flame-700">
              <MessageSquare className="h-3.5 w-3.5" /> Text us
            </a>
          ) : null}
          <a href={emailHref} onClick={onEmailClick} className="inline-flex items-center gap-1 hover:text-flame-700">
            <Mail className="h-3.5 w-3.5" /> Email us
          </a>
        </div>
      </div>

      {/* Phones: price + call + quote, always in reach. */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2.5 bg-[linear-gradient(to_top,#f7efe2_75%,transparent)] px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 lg:hidden">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] text-clay-600">
            {adults} adults · {planShort}
          </p>
          <p className="font-serif text-[22px] font-extrabold leading-none">{fmt(total)}</p>
        </div>
        <a
          href={phone.voice.tel}
          aria-label={`Call ${phone.voice.display}`}
          onClick={() => trackEvent("phone_click", { contact_surface: "landing_sticky" })}
          className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full border border-ink/15 bg-white text-ink"
        >
          <Phone className="h-5 w-5" />
        </a>
        <Link
          href={quoteHref}
          onClick={onQuote("landing_sticky")}
          className="flex h-[50px] items-center rounded-full bg-flame px-5 text-[15px] font-bold text-white shadow-organic-lg"
        >
          Get quote
        </Link>
      </div>
    </>
  )
}
