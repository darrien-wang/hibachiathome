"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { CalendarDays, Check, Phone } from "lucide-react"
import EstimatorRow from "@/components/ui/estimator-row"
import { useLocCity } from "@/components/city/geo-city-name"
import { phone } from "@/config/site"
import { trackEvent } from "@/lib/tracking"
import {
  GUEST_TIERS,
  MINIMUM_SPEND,
  calcSimpleEstimate,
  checkWeekdayEligibility,
  displayRangeForEstimate,
  formatDisplayRange,
  partySizeDiscountCode,
  roundCurrency,
  weekdayBlackoutLabel,
} from "@/config/pricing-rules"

// The ad landing page's estimate card (Claude Design "Realhibachi Landing
// Page" board, 决策日志 D-0911-05), reordered 2026-09-13: contact first,
// then the price (D-0913-08).
//
// Step 1 asks for a mobile number and an email and nothing else. The lead is
// saved the moment they are given (stage "contact"), so a visitor who leaves
// after step 1 is still a lead the daily report can chase. Step 2 is the
// estimator: guests, optional date, and the exact total with the Party Size
// Discount code shown on screen — no price bracket any more, the contact is
// already in hand. "Text me this quote" sends the same SMS + email as before
// (stage "quote") and the card flips to a receipt in place. Every other CTA
// on the page (sticky bar, final section) points back at this card.
//
// A returning visitor who already unlocked on /quote or here (localStorage
// `rh_quote_unlock`, shared with /quote) lands on step 2 directly.

// The card renders twice per page (desktop hero slot + phone slot, one of
// them display:none), so the input is found by attribute and visibility, not id.
export const LANDING_PHONE_ATTR = "data-landing-phone"
const CONTACT_KEY = "rh_quote_unlock"

const fmt = (v: number) => {
  const r = roundCurrency(v)
  return `$${r.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

function readSavedContact(): { phone: string; email: string } | null {
  try {
    const raw = window.localStorage.getItem(CONTACT_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as { phone?: string; email?: string }
    if (!saved.phone || !saved.email) return null
    return { phone: saved.phone, email: saved.email }
  } catch {
    return null
  }
}

/**
 * Scrolls the card's phone input into view and focuses it (used by every CTA
 * on the page). Once the contact is given the input is gone, so the card
 * itself is brought into view instead.
 */
export function focusLandingPhone() {
  const el = [...document.querySelectorAll<HTMLInputElement>(`[${LANDING_PHONE_ATTR}]`)].find((n) => n.offsetParent !== null)
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    window.setTimeout(() => el.focus({ preventScroll: true }), 350)
    return
  }
  const card = [...document.querySelectorAll<HTMLElement>("#price")].find((n) => n.offsetParent !== null)
  card?.scrollIntoView({ behavior: "smooth", block: "start" })
}

export default function LandingEstimator({
  citySlug,
  cityName,
  lockCity = false,
  source,
  travelFee,
  proofImage = "/gallery/real-hibachi-party-orange-county-night-fire-show-18.jpg",
  proofQuote = { text: "Chef John was sooooo much fun. 5 stars!", name: "Beatrix B.", source: "Google review" },
}: {
  citySlug: string
  cityName: string
  /** Keep cityName even when ?loc= names the visitor's city (destination pages). */
  lockCity?: boolean
  source?: string
  /** Approximate travel fee for this city (config/city-travel); 0 / undefined = included. */
  travelFee?: number | null
  /** Real party photo shown inside the card (a different one from the hero). */
  proofImage?: string
  proofQuote?: { text: string; name: string; source: string }
}) {
  const shownCity = useLocCity(cityName, !lockCity)
  const [step, setStep] = useState<1 | 2>(1)
  const [adults, setAdults] = useState(15)
  const [kids, setKids] = useState(0)
  const [date, setDate] = useState("")
  const [manualWeekday, setManualWeekday] = useState(false)
  const [phoneValue, setPhoneValue] = useState("")
  const [email, setEmail] = useState("")
  const [phoneErr, setPhoneErr] = useState(false)
  const [emailErr, setEmailErr] = useState(false)
  const [contactBusy, setContactBusy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<null | { total: number; emailed: boolean; smsDelivered: boolean; depositUrl: string | null; discountCode: string | null; discount: number }>(null)
  const [serverErr, setServerErr] = useState<string | null>(null)
  const startedRef = useRef(false)
  const leadSentRef = useRef(false)
  const cardRef = useRef<HTMLDivElement | null>(null)

  // Already gave us the contact (here or on /quote): straight to the price.
  useEffect(() => {
    const saved = readSavedContact()
    if (!saved) return
    setPhoneValue(saved.phone)
    setEmail(saved.email)
    leadSentRef.current = true
    setStep(2)
  }, [])

  // Height of the on-screen keyboard (0 when closed). The sticky bar is moved
  // up by this much so the button stays reachable while the number is being
  // typed: 2026-09-12 recordings showed visitors typing a number and never
  // finding the button underneath the keyboard.
  const [keyboardInset, setKeyboardInset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    let raf = 0
    const measure = () => {
      raf = 0
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
      setKeyboardInset(inset > 80 ? inset : 0)
    }
    const schedule = () => {
      if (!raf) raf = window.requestAnimationFrame(measure)
    }
    vv.addEventListener("resize", schedule)
    vv.addEventListener("scroll", schedule)
    return () => {
      if (raf) window.cancelAnimationFrame(raf)
      vv.removeEventListener("resize", schedule)
      vv.removeEventListener("scroll", schedule)
    }
  }, [])

  const dateKnown = /^\d{4}-\d{2}-\d{2}$/.test(date)
  const eligibility = useMemo(() => (dateKnown ? checkWeekdayEligibility(date, { adult: adults, child: kids, toddler: 0 }) : null), [dateKnown, date, adults, kids])
  const blackout = dateKnown ? weekdayBlackoutLabel(date) : null
  // A real date decides the rate; without one the visitor's toggle stands.
  const weekday = eligibility ? eligibility.isEligible : manualWeekday

  const fee = travelFee && travelFee > 0 ? Math.round(travelFee) : 0
  // One shared calculation for every simple estimator: tier rate, the Party
  // Size Discount, then the $599 floor (which applies on weekday dates too —
  // 2026-09-13: five adults on a Thursday were being shown $274.50).
  const est = calcSimpleEstimate({ adults, kids, weekdaySpecial: weekday, travelFee: fee })
  const minApplied = est.minApplied
  const sizeOff = est.partySizeDiscountApplied
  const total = est.total
  const discountCode = sizeOff > 0 ? partySizeDiscountCode(adults + kids) : null
  // Before the contact is given the sticky bar teases a bracket, same rule as
  // every other estimator on the site (D-0913-06).
  const rangeLabel = formatDisplayRange(displayRangeForEstimate(est))

  const attribution = source ?? `city_${citySlug.replace(/-/g, "_")}`
  const phoneReady = phoneValue.replace(/\D/g, "").replace(/^1/, "").length === 10
  const emailReady = EMAIL_RE.test(email.trim())
  const guestsShort = kids > 0 ? `${adults} adults · ${kids} kids` : `${adults} adults`
  const planShort = weekday ? "Mon–Thu" : "any day"
  const planLabel =
    (minApplied ? `${weekday ? "Weekday Special" : "Standard"} · $${MINIMUM_SPEND} event minimum` : weekday ? `Weekday Special · ${guestsShort}` : `Standard · ${guestsShort}`) +
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
    if (adults !== 15 || kids !== 0 || date || phoneValue || email) markStarted()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adults, kids, date, phoneValue, email])

  const quotePayload = () => ({
    citySlug,
    cityName: shownCity,
    source: attribution,
    adults,
    kids,
    eventDate: dateKnown ? date : "",
    plan: weekday ? "weekday" : "standard",
    travelFee: fee,
    phone: phoneValue,
    email: email.trim(),
    pagePath: window.location.pathname,
  })

  const validateContact = () => {
    if (!phoneReady) {
      setPhoneErr(true)
      focusLandingPhone()
      return false
    }
    if (!emailReady) {
      setEmailErr(true)
      document.querySelector<HTMLInputElement>("[data-landing-email]")?.focus()
      return false
    }
    return true
  }

  // Step 1 → 2. The lead is written now, before any price is shown; the
  // quote step re-sends everything, so a failure here only costs the early
  // save, never the visitor's progress.
  const submitContact = async () => {
    if (!validateContact()) return
    setContactBusy(true)
    setServerErr(null)
    try {
      const res = await fetch("/api/landing-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...quotePayload(), stage: "contact" }),
      })
      const p = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (p?.error === "phone_invalid") {
        setPhoneErr(true)
        setServerErr("That number doesn't look right — 10 digits, US mobile.")
        return
      }
      if (p?.error === "email_invalid" || p?.error === "email_required") {
        setEmailErr(true)
        setServerErr("Add a valid email — the exact price goes there too.")
        return
      }
    } catch {
      // Offline or blocked: carry on, the quote step writes the lead again.
    } finally {
      setContactBusy(false)
    }
    try {
      window.localStorage.setItem(CONTACT_KEY, JSON.stringify({ phone: phoneValue.trim(), email: email.trim(), at: Date.now() }))
    } catch {}
    if (!leadSentRef.current) {
      leadSentRef.current = true
      // Same event the /quote booking request fires, so GA4 / Ads / ChatGPT
      // count it as the lead it is; contact_surface tells the two apart.
      trackEvent("booking_submit", {
        lead_source: attribution,
        lead_channel: "website_landing_quote",
        lead_type: "booking_inquiry",
        booking_request: true,
        contact_surface: "landing_estimator",
        quote_surface: attribution,
        city_or_zip: shownCity,
        guest_count: adults + kids,
        quote_plan: weekday ? "weekday" : "standard",
        // Step 1 is the conversion, but no party has been priced yet: the card
        // still holds its default 15 adults. Report the $599 event minimum,
        // the least any booking is worth, instead of an invented total.
        value: MINIMUM_SPEND,
        value_basis: "event_minimum",
        currency: "USD",
      })
    }
    setStep(2)
    window.setTimeout(() => cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50)
  }

  // Step 2: text + email the exact price and flip to the receipt.
  const submit = async () => {
    if (!validateContact()) {
      setStep(1)
      return
    }
    setBusy(true)
    setServerErr(null)
    try {
      const res = await fetch("/api/landing-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...quotePayload(), stage: "quote" }),
      })
      const p = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; total?: number; emailed?: boolean; smsDelivered?: boolean; depositUrl?: string; discountCode?: string | null; discount?: number } | null
      if (!res.ok || !p?.ok) {
        setServerErr(
          p?.error === "phone_invalid"
            ? "That number doesn't look right — 10 digits, US mobile."
            : p?.error === "email_required" || p?.error === "email_invalid"
              ? "Add a valid email — we send the exact price there too."
              : "Couldn't send just now. Call or text (213) 770-7788 and we'll quote you right away.",
        )
        return
      }
      setSent({ total: p.total ?? total, emailed: Boolean(p.emailed), smsDelivered: p.smsDelivered !== false, depositUrl: typeof p.depositUrl === "string" ? p.depositUrl : null, discountCode: p.discountCode ?? null, discount: p.discount ?? 0 })
      trackEvent("quote_sent", {
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
  const sending = busy || contactBusy

  return (
    <>
      {/* text-ink is explicit: on desktop this card sits inside the hero, which is text-white. */}
      <div ref={cardRef} id="price" className="scroll-mt-24 flex flex-col gap-3.5 rounded-[28px] border border-ink/10 bg-white p-[18px] text-ink shadow-organic-lg lg:p-[22px]">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-bold uppercase tracking-[0.06em] text-clay-600">Your {shownCity} party</span>
          <span className="text-xs text-clay-600">{step === 1 ? "Step 1 of 2 · 30 sec" : "Step 2 of 2"}</span>
        </div>

        {step === 1 ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!sending) void submitContact()
            }}
          >
            <p className="text-[15px] font-semibold leading-snug">Where should we send your exact price?</p>
            <input
              data-landing-phone=""
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              enterKeyHint="next"
              placeholder="Your mobile number"
              aria-label="Your mobile number"
              value={phoneValue}
              onChange={(e) => {
                setPhoneValue(e.target.value)
                setPhoneErr(false)
                setServerErr(null)
              }}
              className={`${input} ${phoneErr ? "border-flame ring-2 ring-flame/30" : ""}`}
            />
            <input
              data-landing-email=""
              type="email"
              inputMode="email"
              autoComplete="email"
              enterKeyHint="go"
              placeholder="Your email"
              aria-label="Email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setEmailErr(false)
                setServerErr(null)
              }}
              className={`${input} ${emailErr ? "border-flame ring-2 ring-flame/30" : ""}`}
            />
            <button
              type="submit"
              // Keep the input focused (and the keyboard open) through the tap,
              // otherwise iOS blurs first, the layout shifts, and the click is lost.
              onMouseDown={(e) => e.preventDefault()}
              disabled={sending}
              className="flex h-[52px] items-center justify-center rounded-full bg-flame text-base font-bold text-white transition hover:bg-flame-600 disabled:opacity-60"
            >
              {contactBusy ? "One sec…" : "Next: see my price →"}
            </button>
            <p className={`text-center text-xs ${phoneErr || emailErr || serverErr ? "font-semibold text-flame-700" : "text-clay-600"}`}>
              {serverErr ??
                (phoneErr
                  ? "Enter a 10-digit mobile number so we can text the price."
                  : emailErr
                    ? "Add a valid email — the exact price goes there too."
                    : "Exact price + your party discount code on the next screen and by text · a real person follows up within 15 min · no spam")}
            </p>
          </form>
        ) : (
          <>
            <p className="-mt-1 text-xs text-clay-600">
              Sending to {prettyPhone(phoneValue)}
              {sent ? null : (
                <>
                  {" · "}
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1)
                      window.setTimeout(focusLandingPhone, 50)
                    }}
                    className="font-semibold text-flame underline underline-offset-2"
                  >
                    change
                  </button>
                </>
              )}
            </p>

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
                <p className="mt-1 text-[11px] font-semibold text-gold-700">
                  {discountCode ? `Code ${discountCode} · −$${sizeOff} party size discount included` : "Your exact price · nothing charged"}
                </p>
              </div>
              <p className="text-right text-xs font-semibold leading-snug text-gold-700">
                {fee > 0 ? `~$${fee} travel added` : "Travel included"}
                <br />
                {weekday ? "free platter + tables & chairs" : "No fees hidden"}
              </p>
            </div>

            {sent ? (
              <div className="flex items-start gap-3 rounded-[20px] border border-emerald-200 bg-emerald-50 p-3.5" role="status">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <Check className="h-5 w-5" strokeWidth={3} />
                </span>
                <div className="min-w-0 flex-1 text-sm leading-snug">
                  {/* Twilio "accepted" is not "delivered" (T-Mobile rejected every text
                      on 2026-09-12), so the quote is repeated on screen too. */}
                  <p className="font-bold">{sent.smsDelivered ? `Texted to ${prettyPhone(phoneValue)}` : `We have your number: ${prettyPhone(phoneValue)}`}</p>
                  <p className="mt-0.5 text-clay-700">
                    {sent.smsDelivered
                      ? `If the text${sent.emailed ? " or email" : ""} hasn't landed in a minute, everything is right here.`
                      : "The text is delayed, so here is everything it would have said."}{" "}
                    A real person follows up within 15 min by text or email.
                  </p>
                  <p className="mt-2 font-serif text-2xl font-extrabold leading-none">{fmt(sent.total)}</p>
                  {sent.discountCode ? (
                    <p className="mt-1 text-xs font-semibold text-gold-700">Code {sent.discountCode} · −${sent.discount} party size discount, applied automatically when you book</p>
                  ) : null}
                  <p className="text-xs text-clay-600">
                    {guestsShort} · {planShort}
                    {fee > 0 ? ` · incl. ~$${fee} travel` : ""}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!sending) void submit()
                  }}
                  disabled={sending}
                  className="flex h-[52px] items-center justify-center rounded-full bg-flame text-base font-bold text-white transition hover:bg-flame-600 disabled:opacity-60"
                >
                  {busy ? "Sending…" : "Text me this quote"}
                </button>
                <p className={`text-center text-xs ${serverErr ? "font-semibold text-flame-700" : "text-clay-600"}`}>
                  {serverErr ?? `Goes to ${prettyPhone(phoneValue)} and ${email.trim()} · a real person follows up within 15 min`}
                </p>
              </div>
            )}
          </>
        )}

        {/* Proof lives inside the card: handing over a phone number is a trust decision. */}
        <div className="flex items-center gap-3 border-t border-ink/10 pt-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full">
            <Image src={proofImage} alt="Real Hibachi party" fill sizes="48px" className="object-cover saturate-[1.15]" />
          </div>
          <div className="min-w-0 text-xs leading-snug">
            <p className="text-ink">
              &ldquo;{proofQuote.text}&rdquo; <span className="text-clay-600">— {proofQuote.name}, {proofQuote.source}</span>
            </p>
            <p className="mt-0.5 font-semibold text-clay-700">We reply within 15 min · free to cancel 72h+</p>
          </div>
        </div>
      </div>

      {/* Phones: price + call + the one action, always in reach. */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2.5 bg-[linear-gradient(to_top,#f7efe2_75%,transparent)] px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 lg:hidden"
        style={keyboardInset ? { transform: `translateY(-${keyboardInset}px)` } : undefined}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] text-clay-600">{step === 1 ? "Exact price after step 1" : `${guestsShort} · ${planShort}`}</p>
          <p className="font-serif text-[22px] font-extrabold leading-none">{step === 1 ? rangeLabel : fmt(total)}</p>
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
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (sent || sending) return
            if (step === 2) {
              void submit()
              return
            }
            if (phoneReady && emailReady) {
              void submitContact()
              return
            }
            trackEvent("lead_start", { contact_surface: "landing_sticky", adults, kids, quote_plan: weekday ? "weekday" : "standard", quote_total: total })
            focusLandingPhone()
          }}
          className={`flex h-[50px] items-center rounded-full px-5 text-[15px] font-bold shadow-organic-lg ${sent ? "bg-emerald-600 text-white" : "bg-flame text-white"}`}
        >
          {sent ? "Sent ✓" : sending ? "Sending…" : step === 2 ? "Text me this quote" : phoneReady && emailReady ? "Next: my price →" : "Get my price"}
        </button>
      </div>
    </>
  )
}
