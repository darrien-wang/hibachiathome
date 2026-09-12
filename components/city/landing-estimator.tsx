"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { CalendarDays, Check, Phone } from "lucide-react"
import EstimatorRow from "@/components/ui/estimator-row"
import { useLocCity } from "@/components/city/geo-city-name"
import { phone } from "@/config/site"
import { trackEvent } from "@/lib/tracking"
import { GUEST_TIERS, DEPOSIT_AMOUNT, MINIMUM_SPEND, checkWeekdayEligibility, roundCurrency, weekdayBlackoutLabel } from "@/config/pricing-rules"

// The ad landing page's estimate card, revised 2026-09-12 from the Claude
// Design "Realhibachi Landing Page" board (决策日志 D-0911-05).
//
// The previous card sent visitors to /quote to re-enter everything; 8% of
// paid sessions survived that hop while 9.8% had already started typing here.
// So the card is now the whole form: guests, an optional date, one phone
// number, "Text me this quote". The server prices it from config, texts the
// estimate plus a deposit link from the business line, and the card flips to
// a receipt in place. Every CTA on the page (sticky bar, final section)
// points back at this one input instead of leaving the page.
//
// Desktop gets an optional email too, because sms: links are dead there
// (D-0908-04) and some people at a desk just prefer mail.

// The card renders twice per page (desktop hero slot + phone slot, one of
// them display:none), so the input is found by attribute and visibility, not id.
export const LANDING_PHONE_ATTR = "data-landing-phone"

const fmt = (v: number) => {
  const r = roundCurrency(v)
  return `$${r.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

function describeDate(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (Number.isNaN(d.getTime())) return null
  return `${WEEKDAY_NAMES[d.getDay()]} ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
}

function prettyPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(-10)
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : raw
}

/** Scrolls the card's phone input into view and focuses it (used by every CTA on the page). */
export function focusLandingPhone() {
  const el = [...document.querySelectorAll<HTMLInputElement>(`[${LANDING_PHONE_ATTR}]`)].find((n) => n.offsetParent !== null)
  if (!el) return
  el.scrollIntoView({ behavior: "smooth", block: "center" })
  window.setTimeout(() => el.focus({ preventScroll: true }), 350)
}

export default function LandingEstimator({
  citySlug,
  cityName,
  source,
  travelFee,
  proofImage = "/gallery/real-hibachi-party-orange-county-night-fire-show-18.jpg",
  proofQuote = { text: "Chef John was sooooo much fun. 5 stars!", name: "Beatrix B.", source: "Google review" },
}: {
  citySlug: string
  cityName: string
  source?: string
  /** Approximate travel fee for this city (config/city-travel); 0 / undefined = included. */
  travelFee?: number | null
  /** Real party photo shown inside the card (a different one from the hero). */
  proofImage?: string
  proofQuote?: { text: string; name: string; source: string }
}) {
  const shownCity = useLocCity(cityName)
  const [adults, setAdults] = useState(15)
  const [kids, setKids] = useState(0)
  const [date, setDate] = useState("")
  const [manualWeekday, setManualWeekday] = useState(false)
  const [phoneValue, setPhoneValue] = useState("")
  const [email, setEmail] = useState("")
  const [phoneErr, setPhoneErr] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<null | { total: number; emailed: boolean; smsDelivered: boolean }>(null)
  const [serverErr, setServerErr] = useState<string | null>(null)
  const startedRef = useRef(false)

  const dateKnown = /^\d{4}-\d{2}-\d{2}$/.test(date)
  const eligibility = useMemo(() => (dateKnown ? checkWeekdayEligibility(date, { adult: adults, child: kids, toddler: 0 }) : null), [dateKnown, date, adults, kids])
  const blackout = dateKnown ? weekdayBlackoutLabel(date) : null
  // A real date decides the rate; without one the visitor's toggle stands.
  const weekday = eligibility ? eligibility.isEligible : manualWeekday

  const subtotal = roundCurrency(
    adults * (weekday ? GUEST_TIERS.adult.weekdayPrice : GUEST_TIERS.adult.price) + kids * (weekday ? GUEST_TIERS.child.weekdayPrice : GUEST_TIERS.child.price),
  )
  const fee = travelFee && travelFee > 0 ? Math.round(travelFee) : 0
  const minApplied = !weekday && subtotal < MINIMUM_SPEND
  const total = (weekday ? subtotal : Math.max(subtotal, MINIMUM_SPEND)) + fee

  const attribution = source ?? `city_${citySlug.replace(/-/g, "_")}`
  const guestsShort = kids > 0 ? `${adults} adults · ${kids} kids` : `${adults} adults`
  const planShort = weekday ? "Mon–Thu" : "any day"
  const planLabel =
    (weekday ? `Weekday Special · ${guestsShort}` : minApplied ? `Standard · $${MINIMUM_SPEND} event minimum` : `Standard · ${guestsShort}`) +
    (fee > 0 ? ` · incl. ~$${fee} travel` : "")
  const dateStatus = !dateKnown
    ? "optional"
    : blackout
      ? `${describeDate(date)} · holiday rate`
      : weekday
        ? `${describeDate(date)} · Mon–Thu rate`
        : `${describeDate(date)} · any-day rate`

  // First interaction with the card = quote_started, same as /quote counts it.
  const markStarted = () => {
    if (startedRef.current) return
    startedRef.current = true
    trackEvent("quote_started", { contact_surface: "landing_estimator", quote_surface: attribution, source: "landing_estimator" })
  }

  useEffect(() => {
    if (adults !== 15 || kids !== 0 || date || phoneValue) markStarted()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adults, kids, date, phoneValue])

  const submit = async () => {
    const digits = phoneValue.replace(/\D/g, "")
    if (digits.replace(/^1/, "").length !== 10) {
      setPhoneErr(true)
      focusLandingPhone()
      return
    }
    setBusy(true)
    setServerErr(null)
    try {
      const res = await fetch("/api/landing-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          citySlug,
          cityName: shownCity,
          source: attribution,
          adults,
          kids,
          eventDate: dateKnown ? date : "",
          plan: weekday ? "weekday" : "standard",
          travelFee: fee,
          phone: phoneValue,
          email: email.trim() || undefined,
          pagePath: window.location.pathname,
        }),
      })
      const p = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; total?: number; emailed?: boolean; smsDelivered?: boolean } | null
      if (!res.ok || !p?.ok) {
        setServerErr(p?.error === "phone_invalid" ? "That number doesn't look right — 10 digits, US mobile." : "Couldn't send just now. Call or text (213) 770-7788 and we'll quote you right away.")
        return
      }
      setSent({ total: p.total ?? total, emailed: Boolean(p.emailed), smsDelivered: p.smsDelivered !== false })
      // Same event the /quote booking request fires, so GA4 / Ads / ChatGPT
      // count it as the lead it is; contact_surface tells the two apart.
      trackEvent("booking_submit", {
        lead_source: attribution,
        lead_channel: "website_landing_quote",
        lead_type: "booking_request",
        booking_request: true,
        contact_surface: "landing_estimator",
        quote_surface: attribution,
        city_or_zip: shownCity,
        guest_count: adults + kids,
        quote_plan: weekday ? "weekday" : "standard",
        quote_total: total,
        event_date: dateKnown ? date : "unspecified",
        value: total,
        currency: "USD",
      })
    } catch {
      setServerErr("Couldn't send just now. Call or text (213) 770-7788 and we'll quote you right away.")
    } finally {
      setBusy(false)
    }
  }

  const toggle = (on: boolean) =>
    `h-11 flex-1 rounded-full text-[13px] font-semibold transition ${on ? "bg-flame text-white" : "bg-cream text-ink hover:bg-ink/5"}`
  const input = "h-12 w-full rounded-full border border-ink/15 bg-white px-4 text-[15px] text-ink placeholder:text-clay-600/80 focus:border-flame focus:outline-none focus:ring-2 focus:ring-flame/30"

  return (
    <>
      {/* text-ink is explicit: on desktop this card sits inside the hero, which is text-white. */}
      <div id="price" className="scroll-mt-24 flex flex-col gap-3.5 rounded-[28px] border border-ink/10 bg-white p-[18px] text-ink shadow-organic-lg lg:p-[22px]">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-bold uppercase tracking-[0.06em] text-clay-600">Your {shownCity} party</span>
          <span className="text-xs text-clay-600">30-sec estimate</span>
        </div>

        <EstimatorRow label="Adults" sub="13 and up" value={adults} onValueChange={setAdults} min={1} data-quote-field="adults" />
        <EstimatorRow label="Kids 5–12" sub="half price · under 5 free" value={kids} onValueChange={setKids} min={0} data-quote-field="kids" />

        <label className="flex items-center gap-2.5">
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Party date</span>
            <span className={`block text-xs ${blackout ? "text-clay-700" : weekday && dateKnown ? "text-emerald-700" : "text-clay-600"}`}>{dateStatus}</span>
          </span>
          <span className="relative flex items-center">
            <CalendarDays className="pointer-events-none absolute left-3 h-4 w-4 text-clay-600" aria-hidden="true" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Party date (optional)"
              data-quote-field="date"
              className="h-11 w-[150px] rounded-full border border-ink/15 bg-cream pl-9 pr-2 text-[13px] text-ink focus:border-flame focus:outline-none"
            />
          </span>
        </label>

        {!dateKnown ? (
          <div className="flex gap-2" role="radiogroup" aria-label="Pricing plan">
            <button type="button" role="radio" aria-checked={!manualWeekday} onClick={() => setManualWeekday(false)} className={toggle(!manualWeekday)}>
              Any day · ${GUEST_TIERS.adult.price.toFixed(2)}
            </button>
            <button type="button" role="radio" aria-checked={manualWeekday} onClick={() => setManualWeekday(true)} className={toggle(manualWeekday)}>
              Mon–Thu · ${GUEST_TIERS.adult.weekdayPrice.toFixed(2)}
            </button>
          </div>
        ) : null}

        <div className="flex items-end justify-between border-t border-ink/10 pt-2">
          <div>
            <p className="text-xs text-clay-600">{planLabel}</p>
            <p className="font-serif text-4xl font-extrabold leading-none lg:text-[40px]" aria-live="polite">
              {fmt(total)}
            </p>
          </div>
          <p className="text-right text-xs font-semibold leading-snug text-gold-700">
            {fee > 0 ? `~$${fee} travel added` : "Travel included"}
            <br />
            {weekday ? "free appetizer platter" : "No fees hidden"}
          </p>
        </div>

        {sent ? (
          <div className="flex items-start gap-3 rounded-[20px] border border-emerald-200 bg-emerald-50 p-3.5" role="status">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
              <Check className="h-5 w-5" strokeWidth={3} />
            </span>
            <div className="text-sm leading-snug">
              <p className="font-bold">{sent.smsDelivered ? `Texted to ${prettyPhone(phoneValue)}` : `We have your number: ${prettyPhone(phoneValue)}`}</p>
              <p className="mt-0.5 text-clay-700">
                {sent.smsDelivered
                  ? `Your ${fmt(sent.total)} quote and the ${fmt(DEPOSIT_AMOUNT)} deposit link are in your messages${sent.emailed ? " and your inbox" : ""}.`
                  : `The text is delayed, so a real person will call you with your ${fmt(sent.total)} quote.`}{" "}
                A real person calls within 15 min.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <input
              data-landing-phone=""
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="Your mobile number"
              aria-label="Your mobile number"
              value={phoneValue}
              onChange={(e) => {
                setPhoneValue(e.target.value)
                setPhoneErr(false)
              }}
              onKeyDown={(e) => e.key === "Enter" && !busy && void submit()}
              className={`${input} ${phoneErr ? "border-flame ring-2 ring-flame/30" : ""}`}
            />
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="Email (optional — deposit link goes here too)"
              aria-label="Email (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${input} hidden lg:block`}
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy}
              className="flex h-[52px] items-center justify-center rounded-full bg-flame text-base font-bold text-white transition hover:bg-flame-600 disabled:opacity-60"
            >
              {busy ? "Sending…" : "Text me this quote"}
            </button>
            <p className={`text-center text-xs ${phoneErr || serverErr ? "font-semibold text-flame-700" : "text-clay-600"}`}>
              {serverErr ?? (phoneErr ? "Enter a 10-digit mobile number so we can text the quote." : `Just your number · quote + ${fmt(DEPOSIT_AMOUNT)} deposit link by text · no spam`)}
            </p>
          </div>
        )}

        {/* Proof lives inside the card: paying a deposit is a trust decision. */}
        <div className="flex items-center gap-3 border-t border-ink/10 pt-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full">
            <Image src={proofImage} alt="Real Hibachi party" fill sizes="48px" className="object-cover saturate-[1.15]" />
          </div>
          <div className="min-w-0 text-xs leading-snug">
            <p className="text-ink">
              &ldquo;{proofQuote.text}&rdquo; <span className="text-clay-600">— {proofQuote.name}, {proofQuote.source}</span>
            </p>
            <p className="mt-0.5 font-semibold text-clay-700">We call back within 15 min · deposit refundable 72h+</p>
          </div>
        </div>
      </div>

      {/* Phones: price + call + the one action, always in reach. */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2.5 bg-[linear-gradient(to_top,#f7efe2_75%,transparent)] px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 lg:hidden">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] text-clay-600">
            {guestsShort} · {planShort}
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
        <button
          type="button"
          onClick={() => {
            if (sent) return
            trackEvent("lead_start", { contact_surface: "landing_sticky", adults, kids, quote_plan: weekday ? "weekday" : "standard", quote_total: total })
            focusLandingPhone()
          }}
          className={`flex h-[50px] items-center rounded-full px-5 text-[15px] font-bold shadow-organic-lg ${sent ? "bg-emerald-600 text-white" : "bg-flame text-white"}`}
        >
          {sent ? "Sent ✓" : "Text me quote"}
        </button>
      </div>
    </>
  )
}
