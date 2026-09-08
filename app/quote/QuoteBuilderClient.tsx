"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import ProofStrip from "@/components/proof-strip"
import AppreciationBanner from "@/components/appreciation-banner"
import AvailabilityCalendar from "@/components/quote/availability-calendar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import GuestCountInput from "@/components/ui/guest-count-input"
import GuestStepper from "@/components/ui/guest-stepper"
import InfoTip from "@/components/ui/info-tip"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Phone, MessageSquare, MessageCircle, Mail, AlertTriangle, Calculator, ChevronDown, CircleHelp, Sunset, CloudRain, CloudSun, ThermometerSun, CalendarDays, CheckCircle2, Gift, MapPin, Star, X } from "lucide-react"
import { phone, siteConfig, whatsappHref } from "@/config/site"
import { getQuoteContactTemplates } from "@/config/quote-contact-templates"
import { QUOTE_SLOTS_URGENCY_ENABLED, QUOTE_SOURCE } from "@/config/quote-features"
import {
  DEFAULT_REGION_CODE,
  getRegionalPolicySnapshot,
  type RegionCode,
} from "@/config/regional-policies"
import {
  GUEST_TIERS,
  MINIMUM_SPEND,
  WEEKDAY_SPECIAL,
  DEPOSIT_AMOUNT,
  calcAdultEquivalents,
  isWeekdayEligibleDate,
} from "@/config/pricing-rules"
import { useActiveRegion } from "@/lib/use-active-region"
import { getAdRefCode, getStoredGclid, trackEvent } from "@/lib/tracking"
import { PROOF_MEDIA } from "@/config/proof-media"
import {
  buildEmailPayload,
  buildSmsBody,
  buildQuoteSummary,
  calculateQuote,
  type QuoteInput,
  type QuoteRange,
} from "@/lib/quote-builder"

const DEFAULT_INPUT: QuoteInput = {
  eventDate: "",
  location: "",
  adults: 10,
  kids: 0,
  pricingTier: "standard",
  weekdaySaverProteins: {
    chicken: true,
    steak: true,
    shrimp: true,
  },
  tablewareRental: false,
  tent10x10: false,
  budget: undefined,
  addOns: {
    steak: false,
    shrimp: false,
    lobster: false,
  },
  loyaltyStatus: undefined,
}

const EVENT_TIME_OPTIONS = ["13:00", "16:00", "19:00", "21:00"] as const

const QUOTE_PROOF_MEDIA = PROOF_MEDIA

// Verbatim 5-star Google reviews from the Real Hibachi listing (owner-supplied
// screenshots, 2026-08). Kelsey's quote is truncated before an alcohol mention
// to stay clear of the A2P/CTIA content rules the rest of the site follows.
const QUOTE_TESTIMONIALS = [
  {
    name: "Spencer Sprowls",
    color: "from-violet-500 to-purple-600",
    text: "Bling is an amazing chef!! He makes the party 100x better and will make amazing food for you.",
  },
  {
    name: "Kelsey Molnar",
    color: "from-orange-400 to-red-500",
    text: "Real Hibachi is such a fun experience! I decided to hire for my sisters 30th bday and it was an absolute success! We had Chef Bling and he was a riot and so sweet! I told him it was a surprise and he made it SO FUN! HIGHLY RECOMMEND, HIGHLY AFFORDABLE, so delicious…",
  },
  {
    name: "David Armstrong",
    color: "from-stone-500 to-stone-700",
    text: "Chef Bling curated a brilliant display of culinary mastery and phenomenal vibes to create an forgettable evening for the bros and I. 2 thumbs up.",
  },
  {
    name: "Warren Zhang",
    color: "from-sky-500 to-blue-600",
    text: "Bling was a great chef and also very personable! He made our night and it was my birthday! Best night ever!",
  },
  {
    name: "Laura Gallop",
    color: "from-rose-400 to-pink-600",
    text: "Chef Bling and Chef Noodle was great! Very entertaining and food was delicious.",
  },
  {
    name: "Lisa Craven",
    color: "from-emerald-500 to-green-700",
    text: "Chef blue was absolutely amazing!!! Super friendly and personable. So fun and interactive. Knew how to switch it up between adults and kids. Food was delicious and he was great! Highly recommend !",
  },
  {
    name: "Max Schwenk",
    color: "from-amber-500 to-yellow-600",
    text: "Unbelievable experience! Bling was the best chef ever!",
  },
  {
    name: "Judy Gothelf",
    color: "from-cyan-500 to-teal-600",
    text: "What a great experience having Blue as our chef! Aside from the fact that he made delicious food, he was so much fun and so engaging! We loved having him here to celebrate our friend's BIG birthday!",
  },
  {
    name: "Karen Wertheimer",
    color: "from-red-500 to-rose-700",
    text: "Just had a wonderful dinner prepared by Blue. He was engaging and entertaining. I would recommend this for any occasion.",
  },
  {
    name: "Beatrix Barrera",
    color: "from-fuchsia-500 to-purple-700",
    text: "Chef John was our personal chef and he was sooooo much fun. I highly recommend requesting for him because aside from the delicious food, there was so much laughing because of him. 5 stars for the service, 5 stars for the food, 5 stars for Chef John! Definitely will do this again!",
  },
] as const
const QUOTE_STARTED_INPUT_FIELDS: Array<keyof QuoteInput> = ["eventDate", "location", "adults", "kids"]
const WEEKDAY_SAVER_MENU_DETAIL = `Full menu, 2 regular proteins per guest + ${WEEKDAY_SPECIAL.appetizerPlatter.label.toLowerCase()} (${WEEKDAY_SPECIAL.appetizerPlatter.detail})`

function encodeUrlComponent(value: string): string {
  return encodeURIComponent(value)
}

type WeatherPreview = {
  eventTimeLabel: string
  sunsetTime: string
  rainChance: number
  willRain: boolean
  temperatureF: number
  source?: string
}

type BookingConfirmation = {
  bookingId?: string
  customerName: string
  customerEmail: string
  customerPhone: string
  eventDate: string
  eventTime: string
  location: string
  adults: number
  kids: number
  pricingTierLabel: string
  estimateLow: number
  estimateHigh: number
  tablewareRental: boolean
  tent10x10: boolean
  premiumUpgrades: string[]
  customerEmailDelivered: boolean
}

type QuoteToast = {
  id: number
  kind: "urgency" | "error" | "promo"
  title: string
  detail?: string
}

function describeEventDate(eventDate: string): { weekday: string; label: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(eventDate ?? "")
  if (!match) return null
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (Number.isNaN(parsed.getTime())) return null
  return {
    weekday: parsed.toLocaleDateString("en-US", { weekday: "long" }),
    label: parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }
}

type SlotAvailability = {
  remaining: number
  slots: Record<string, boolean>
}

// Marketing fallback when the availability API is unreachable: a stable
// pseudo-random 1-3 so the scarcity hint still renders. Real data, when it
// loads, replaces this — but is display-only and never blocks a selection,
// because the reservations data behind it is not actively maintained.
function pseudoSlotsLeft(eventDate: string, location: string): number | null {
  const normalizedLocation = location.trim().toLowerCase()
  if (!eventDate || !normalizedLocation) return null
  const seed = `${eventDate}-${normalizedLocation}`
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0
  }
  return (Math.abs(hash) % 3) + 1
}

// "Who sent you?" — the backstop that catches referrals whose code was
// forgotten. Values land in leads.hear_about_us; the vendor/host/guest options
// are the ones partner commissions get reconciled against.
const HEAR_ABOUT_US_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "friend_family", label: "Friend or family" },
  { value: "past_party", label: "I was a guest at a Real Hibachi party" },
  { value: "google", label: "Google" },
  { value: "instagram_tiktok", label: "Instagram / TikTok" },
  { value: "facebook", label: "Facebook" },
  { value: "yelp", label: "Yelp" },
  { value: "vendor", label: "Party vendor (rentals, decor, cake…)" },
  { value: "host_planner", label: "Airbnb host or party planner" },
  { value: "other", label: "Other" },
]

export default function QuoteBuilderClient() {
  const [input, setInput] = useState<QuoteInput>(DEFAULT_INPUT)
  const [showAvailabilityCalendar, setShowAvailabilityCalendar] = useState(false)
  const activeRegion = useActiveRegion(DEFAULT_REGION_CODE)
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [smsConsent, setSmsConsent] = useState(false)
  const [eventTime, setEventTime] = useState("")
  const [referralCode, setReferralCode] = useState("")
  const [hearAboutUs, setHearAboutUs] = useState("")
  const [tablewareTooltipOpen, setTablewareTooltipOpen] = useState(false)
  const [weatherExpanded, setWeatherExpanded] = useState(false)
  const [slotAvailability, setSlotAvailability] = useState<SlotAvailability | null>(null)
  const [weatherPreview, setWeatherPreview] = useState<WeatherPreview | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [travelFeeRange, setTravelFeeRange] = useState<QuoteRange>({ low: 0, high: 0 })
  const [quoteStartIntentCaptured, setQuoteStartIntentCaptured] = useState(false)
  const [quoteStartedTracked, setQuoteStartedTracked] = useState(false)
  const [quoteCompletedTracked, setQuoteCompletedTracked] = useState(false)
  const [bookingRequestSubmitting, setBookingRequestSubmitting] = useState(false)
  const [bookingConfirmation, setBookingConfirmation] = useState<BookingConfirmation | null>(null)
  const [toasts, setToasts] = useState<QuoteToast[]>([])
  const urgencyToastKeyRef = useRef("")
  const promoStageRef = useRef<"none" | "teased" | "unlocked">("none")
  const mediaStripRef = useRef<HTMLDivElement | null>(null)

  // Package B (2026-09-07): the hero carries the three core inputs and both
  // plans, so a paid visitor prices the party on the first screen. Once they
  // touch an input, a sticky "Text us this quote" bar keeps the SMS-first CTA
  // on screen (measured against the visual viewport so the keyboard counts
  // as covering it).
  const [heroTouched, setHeroTouched] = useState(false)
  // 2026-09-08 redesign: /quote is a 3-step wizard (who's coming → your price → lock your date).
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const weekdayNudgeRef = useRef(false)
  const suppressRevertToastRef = useRef(false)
  const [smsCtaVisible, setSmsCtaVisible] = useState(true)
  const smsButtonRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    if (!heroTouched) return
    const check = () => {
      const el = smsButtonRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const vv = window.visualViewport
      const top = vv ? vv.offsetTop : 0
      const bottom = top + (vv ? vv.height : window.innerHeight)
      setSmsCtaVisible(r.top >= top && r.bottom <= bottom)
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
  }, [heroTouched])

  // Prefill guest counts handed over by city-page calculators, plus referral
  // codes arriving via partner links (?ref=RH-MARIA50). Read from
  // window.location instead of useSearchParams — that hook once bailed the
  // whole page to CSR and emptied the SSR HTML (see lib/use-active-region).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ref = (params.get("ref") ?? params.get("code") ?? "").toUpperCase().replace(/\s+/g, "").slice(0, 32)
    if (ref) {
      setReferralCode(ref)
      setHearAboutUs((previous) => previous || "friend_family")
    }
    const adults = Number.parseInt(params.get("adults") ?? "", 10)
    const kids = Number.parseInt(params.get("kids") ?? "", 10)
    // Landing-page estimators also hand over the date and, when the party
    // already qualifies, plan=weekday — so the visitor sees the same price on
    // /quote that they just saw on the page (the eligibility effect below
    // still reverts to Standard if the numbers no longer qualify).
    const date = params.get("date") ?? ""
    const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date)
    const wantsWeekday = params.get("plan") === "weekday"
    if (!Number.isFinite(adults) && !Number.isFinite(kids) && !dateOk && !wantsWeekday) return
    // The landing estimator shows the Weekday price before a date is picked;
    // without a date the tier below reverts to Standard and the number jumps.
    // Say why, once, instead of letting the price silently change.
    if (wantsWeekday && !dateOk) {
      weekdayNudgeRef.current = true
      // The eligibility effect reverts the tier right after; one toast is enough.
      suppressRevertToastRef.current = true
    }
    setInput((previous) => ({
      ...previous,
      ...(Number.isFinite(adults) && adults > 0 && adults <= 200 ? { adults } : {}),
      ...(Number.isFinite(kids) && kids >= 0 && kids <= 200 ? { kids } : {}),
      ...(dateOk ? { eventDate: date } : {}),
      ...(wantsWeekday ? { pricingTier: "weekday_saver" as const } : {}),
    }))
  }, [])

  // Auto ping-pong drift for the media strip: ~24px/s, reverses at the ends,
  // pauses for a few seconds whenever the visitor touches or scrolls it.
  useEffect(() => {
    const el = mediaStripRef.current
    if (!el) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    let direction = 1
    let pausedUntil = 0
    let raf = 0
    // Float accumulator: browsers round scrollLeft on write, so adding a
    // sub-pixel step to el.scrollLeft directly gets swallowed and the strip
    // never moves (seen on mobile). Track position ourselves instead.
    let pos: number | null = null
    const pause = () => {
      pausedUntil = Date.now() + 4000
      pos = null
    }
    el.addEventListener("pointerdown", pause, { passive: true })
    el.addEventListener("touchstart", pause, { passive: true })
    el.addEventListener("wheel", pause, { passive: true })

    const step = () => {
      if (Date.now() > pausedUntil) {
        const max = el.scrollWidth - el.clientWidth
        if (max > 1) {
          // Resync after a pause or if the user dragged the strip elsewhere.
          if (pos === null || Math.abs(el.scrollLeft - pos) > 2) pos = el.scrollLeft
          pos += direction * 1
          if (pos >= max) {
            pos = max
            direction = -1
          } else if (pos <= 0) {
            pos = 0
            direction = 1
          }
          el.scrollLeft = pos
        }
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener("pointerdown", pause)
      el.removeEventListener("touchstart", pause)
      el.removeEventListener("wheel", pause)
    }
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id))
  }, [])

  const pushToast = useCallback(
    (kind: QuoteToast["kind"], title: string, detail?: string) => {
      const id = Date.now() + Math.random()
      // Two on screen at most: three stacked toasts covered the whole hero on a 390px phone.
      setToasts((previous) => [...previous.slice(-1), { id, kind, title, detail }])
      window.setTimeout(() => dismissToast(id), kind === "urgency" ? 10000 : 6500)
    },
    [dismissToast],
  )

  useEffect(() => {
    if (!weekdayNudgeRef.current) return
    weekdayNudgeRef.current = false
    pushToast("promo", "Pick a Mon–Thu date to keep the Weekday price", "It only needs a Monday–Thursday date — and it comes with a free appetizer platter.")
  }, [pushToast])
  const quoteSurface = "quote_builder"
  const regionPolicySnapshot = useMemo(() => getRegionalPolicySnapshot(activeRegion), [activeRegion])
  const activeRegionDefinition = regionPolicySnapshot.region
  const weekdaySaverPolicy = regionPolicySnapshot.pricingPolicies.weekday_saver.definition
  const weekdaySaverEnabled = regionPolicySnapshot.pricingPolicies.weekday_saver.enabled

  // Weekday Special is offered, never auto-applied: the plan only shows up
  // once the party qualifies (Mon-Thu date, enough guests, region allows it)
  // and the customer taps it themselves to take the discount. Default stays
  // Standard. If a later edit breaks eligibility while it's selected, we
  // revert to Standard and say why.
  const weekdayAdultEquivalents = calcAdultEquivalents({
    adult: Math.max(0, Math.floor(input.adults || 0)),
    child: Math.max(0, Math.floor(input.kids || 0)),
    toddler: 0,
  })
  const weekdayDateOk = Boolean(input.eventDate) && isWeekdayEligibleDate(input.eventDate)
  const hasPremiumUpgrades = input.addOns.steak || input.addOns.shrimp || input.addOns.lobster
  // No headcount gate any more: a Mon–Thu date is the whole condition.
  const weekdayEligible = weekdaySaverEnabled && weekdayDateOk

  const standardRatesLabel = `$${GUEST_TIERS.adult.price.toFixed(2)}/adult, $${GUEST_TIERS.child.price.toFixed(2)}/child`
  const weekdayRatesLabel = `$${GUEST_TIERS.adult.weekdayPrice.toFixed(2)}/adult, $${GUEST_TIERS.child.weekdayPrice.toFixed(2)}/child`
  const weekdayAdultRateLabel = `$${GUEST_TIERS.adult.weekdayPrice.toFixed(2)}/adult`

  // What Weekday Special would save this exact party — shown when it applies.
  const weekdaySavings = useMemo(() => {
    const adults = Math.max(0, Math.floor(input.adults || 0))
    const kids = Math.max(0, Math.floor(input.kids || 0))
    const standardBase = Math.max(adults * GUEST_TIERS.adult.price + kids * GUEST_TIERS.child.price, MINIMUM_SPEND)
    const weekdayBase = Math.max(
      adults * GUEST_TIERS.adult.weekdayPrice + kids * GUEST_TIERS.child.weekdayPrice,
      MINIMUM_SPEND,
    )
    return Math.round(standardBase - weekdayBase)
  }, [input.adults, input.kids])

  // One line telling the customer how to unlock Weekday Special — shown only
  // while the party does NOT qualify (once it does, the selectable plan card
  // takes over).
  const weekdayHint = useMemo(() => {
    if (weekdayEligible || input.pricingTier === "weekday_saver") return null
    if (!weekdaySaverEnabled) return weekdaySaverPolicy.unavailableMessage
    if (!input.eventDate) {
      return `Pick a Mon–Thu date for the Weekday Special — ${weekdayAdultRateLabel} plus a free appetizer platter.`
    }
    const described = describeEventDate(input.eventDate)
    return described
      ? `${described.label} is a ${described.weekday} — the Weekday Special (${weekdayAdultRateLabel} + free appetizer platter) is Mon–Thu only.`
      : `Weekday Special (${weekdayAdultRateLabel} + free appetizer platter) is Mon–Thu only.`
  }, [
    input.eventDate,
    input.pricingTier,
    weekdayAdultRateLabel,
    weekdayEligible,
    weekdaySaverEnabled,
    weekdaySaverPolicy.unavailableMessage,
  ])

  // If an edit breaks eligibility while Weekday Special is selected, revert
  // to Standard and say why — losing the discount silently reads as a price
  // hike.
  useEffect(() => {
    if (input.pricingTier !== "weekday_saver" || weekdayEligible) return
    setInput((previous) => ({ ...previous, pricingTier: "standard" }))
    if (suppressRevertToastRef.current) {
      suppressRevertToastRef.current = false
      return
    }
    const described = input.eventDate ? describeEventDate(input.eventDate) : null
    const reason = !weekdaySaverEnabled
      ? weekdaySaverPolicy.unavailableMessage
      : !weekdayDateOk
        ? described
          ? `${described.label} is a ${described.weekday} — Weekday Special is Mon–Thu only.`
          : "Weekday Special needs a Mon–Thu event date."
        : "Weekday Special needs a Mon–Thu event date."
    pushToast("error", "Back to Standard Plan pricing", reason)
  }, [
    input.eventDate,
    input.pricingTier,
    pushToast,
    weekdayDateOk,
    weekdayEligible,
    weekdaySaverEnabled,
    weekdaySaverPolicy.unavailableMessage,
  ])

  // Nudge when the option becomes available — it appears mid-form where the
  // customer may no longer be looking. Once per page load: eligibility can
  // flap while numbers are being edited, and repeat toasts read as nagging.
  const weekdayNudgeShownRef = useRef(false)
  useEffect(() => {
    if (!weekdayEligible || weekdayNudgeShownRef.current || input.pricingTier === "weekday_saver") return
    weekdayNudgeShownRef.current = true
    pushToast(
      "promo",
      "You qualify for Weekday Special",
      `Mon–Thu date — tap the green plan for ${weekdayAdultRateLabel} instead of $${GUEST_TIERS.adult.price.toFixed(2)}, with a free appetizer platter.`,
    )
  }, [input.pricingTier, pushToast, weekdayAdultRateLabel, weekdayEligible])
  // Display-only scarcity: real remaining capacity clamped to 1-3 (never zero —
  // customers must always be able to book), with a stable pseudo value as the
  // fallback when the API is unavailable.
  const slotsLeft = useMemo(() => {
    if (slotAvailability !== null) {
      return Math.max(1, Math.min(3, slotAvailability.remaining))
    }
    return pseudoSlotsLeft(input.eventDate, input.location)
  }, [input.eventDate, input.location, slotAvailability])
  const shouldShowWeatherCard = Boolean(input.eventDate && input.location.trim())

  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.eventDate)) {
      setSlotAvailability(null)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/quote/slot-availability?date=${input.eventDate}`, {
          signal: controller.signal,
          cache: "no-store",
        })
        if (!response.ok) {
          setSlotAvailability(null)
          return
        }
        const data = await response.json()
        const remaining = Number(data?.remaining)
        const slotEntries: Record<string, boolean> = {}
        for (const slot of data?.slots ?? []) {
          if (typeof slot?.time === "string") slotEntries[slot.time] = Boolean(slot?.available)
        }
        if (Number.isFinite(remaining)) {
          setSlotAvailability({ remaining, slots: slotEntries })
        } else {
          setSlotAvailability(null)
        }
      } catch {
        // real availability is a progressive enhancement; stay quiet on failure
      }
    }, 300)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [input.eventDate])

  const result = useMemo(() => calculateQuote(input, travelFeeRange), [input, travelFeeRange])

  useEffect(() => {
    if (!QUOTE_SLOTS_URGENCY_ENABLED || slotsLeft === null) return
    // Only after every required input is complete (date, time, location, guests),
    // and only once typing has settled — otherwise each ZIP keystroke would pop
    // a fresh toast. slotsLeft is real remaining capacity from the reservations
    // table, so only surface it when it is genuinely scarce.
    if (!result.hasCoreInputs || !eventTime || input.location.trim().length < 3) return

    const key = `${input.eventDate}|${input.location.trim().toLowerCase()}`
    if (urgencyToastKeyRef.current === key) return

    const timer = window.setTimeout(() => {
      if (urgencyToastKeyRef.current === key) return
      urgencyToastKeyRef.current = key
      pushToast(
        "urgency",
        `Only ${slotsLeft} booking ${slotsLeft === 1 ? "slot" : "slots"} left on this date`,
        "Book soon to hold yours.",
      )
    }, 1200)

    return () => window.clearTimeout(timer)
  }, [eventTime, input.eventDate, input.location, pushToast, result.hasCoreInputs, slotsLeft])

  useEffect(() => {
    // Large-party appetizer promo: tease once when the count gets close (15-19),
    // congratulate once when it crosses 20. Event-driven toasts only — the
    // persistent mention lives in the quote card itself.
    const guests = result.guestCount
    if (result.includesAppetizerPlatter) return // the Weekday Special already includes it
    if (guests >= 20) {
      if (promoStageRef.current !== "unlocked") {
        promoStageRef.current = "unlocked"
        pushToast(
          "promo",
          "Free appetizer platter unlocked",
          "Parties of 20+ get gyoza, edamame & spring rolls included ($40 value).",
        )
      }
    } else if (guests >= 15 && promoStageRef.current === "none" && quoteStartIntentCaptured) {
      promoStageRef.current = "teased"
      const short = 20 - guests
      pushToast(
        "promo",
        `${short} more guest${short === 1 ? "" : "s"} = free appetizer platter`,
        "Parties of 20+ get gyoza, edamame & spring rolls free ($40 value).",
      )
    }
  }, [result.guestCount, result.includesAppetizerPlatter, pushToast, quoteStartIntentCaptured])

  const quoteSummary = useMemo(() => buildQuoteSummary(input, result), [input, result])
  const contactTemplates = useMemo(() => getQuoteContactTemplates(), [])
  const smsBody = useMemo(
    () => buildSmsBody(input, result, contactTemplates.sms),
    [input, result, contactTemplates.sms],
  )
  const emailPayload = useMemo(
    () =>
      buildEmailPayload(input, result, {
        subject: contactTemplates.emailSubject,
        body: contactTemplates.emailBody,
      }),
    [input, result, contactTemplates.emailBody, contactTemplates.emailSubject],
  )
  const isWeekdaySaverTier = input.pricingTier === "weekday_saver"
  const weekdaySaverProteinsValue = isWeekdaySaverTier ? WEEKDAY_SAVER_MENU_DETAIL : "n/a"

  useEffect(() => {
    const destination = input.location.trim()
    if (!destination) {
      setTravelFeeRange({ low: 0, high: 0 })
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/quote/travel-fee?destination=${encodeURIComponent(destination)}`, {
          method: "GET",
          signal: controller.signal,
          cache: "no-store",
        })
        if (!response.ok) return

        const data = await response.json()
        const low = Number(data?.travel_fee_range?.low)
        const high = Number(data?.travel_fee_range?.high)

        if (Number.isFinite(low) && Number.isFinite(high)) {
          setTravelFeeRange({ low, high })
        }
      } catch {
        // keep current fee range on transient network errors
      }
    }, 300)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [input.location])

  useEffect(() => {
    const destination = input.location.trim()
    const eventDate = input.eventDate
    const selectedEventTime = eventTime || "19:00"

    if (!destination || !eventDate) {
      setWeatherPreview(null)
      setWeatherLoading(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setWeatherLoading(true)
      try {
        const response = await fetch(
          `/api/quote/weather?destination=${encodeURIComponent(destination)}&eventDate=${encodeURIComponent(eventDate)}&eventTime=${encodeURIComponent(selectedEventTime)}`,
          {
            method: "GET",
            signal: controller.signal,
            cache: "no-store",
          },
        )

        if (!response.ok) {
          setWeatherPreview(null)
          return
        }

        const data = await response.json()
        const eventTimeLabel = typeof data?.event_time_label === "string" ? data.event_time_label : ""
        const sunsetTime = typeof data?.sunset_time === "string" ? data.sunset_time : ""
        const rainChance = Number(data?.rain_chance)
        const willRain = Boolean(data?.will_rain)
        const temperatureF = Number(data?.temperature_f)

        if (!sunsetTime || !eventTimeLabel || !Number.isFinite(rainChance) || !Number.isFinite(temperatureF)) {
          setWeatherPreview(null)
          return
        }

        setWeatherPreview({
          eventTimeLabel,
          sunsetTime,
          rainChance: Math.round(rainChance),
          willRain,
          temperatureF: Math.round(temperatureF),
          source: typeof data?.source === "string" ? data.source : undefined,
        })
      } catch {
        // keep previous weather snapshot on transient errors
      } finally {
        setWeatherLoading(false)
      }
    }, 350)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [eventTime, input.eventDate, input.location])

  // One quote_view per page load — the denominator for every /quote funnel rate.
  useEffect(() => {
    trackEvent("quote_view", { quote_surface: quoteSurface, quote_tier: input.pricingTier })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const hasAnyInput = Boolean(input.eventDate || input.location || input.adults > 0 || input.kids > 0)
    if (!quoteStartedTracked && quoteStartIntentCaptured && hasAnyInput) {
      trackEvent("quote_started", {
        quote_surface: quoteSurface,
        quote_tier: input.pricingTier,
        adults: input.adults,
        kids: input.kids,
        tableware_rental: input.tablewareRental,
        tent_10x10: input.tent10x10,
      })
      setQuoteStartedTracked(true)
    }
  }, [input, quoteStartIntentCaptured, quoteStartedTracked, quoteSurface])

  const lastTrackedTierRef = useRef<string | null>(null)
  useEffect(() => {
    if (lastTrackedTierRef.current === null) {
      lastTrackedTierRef.current = input.pricingTier
      return
    }
    if (lastTrackedTierRef.current === input.pricingTier) return
    lastTrackedTierRef.current = input.pricingTier
    // URL prefill and the eligibility revert change the tier on load; only a
    // visitor's own tap counts as a plan selection.
    if (!quoteStartIntentCaptured && !heroTouched) return
    trackEvent("quote_plan_select", { quote_surface: quoteSurface, quote_tier: input.pricingTier })
  }, [input.pricingTier, quoteSurface, quoteStartIntentCaptured, heroTouched])

  useEffect(() => {
    if (!quoteCompletedTracked && result.hasCoreInputs) {
      trackEvent("quote_completed", {
        quote_surface: quoteSurface,
        quote_tier: input.pricingTier,
        city_or_zip: input.location || "unspecified",
        tableware_rental: input.tablewareRental,
        tent_10x10: input.tent10x10,
        add_on_steak: input.addOns.steak,
        add_on_shrimp: input.addOns.shrimp,
        add_on_lobster: input.addOns.lobster,
        weekday_saver_proteins: weekdaySaverProteinsValue,
        guest_count: result.guestCount,
        estimate_low: result.totalRange.low,
        estimate_high: result.totalRange.high,
        budget_fit: result.budgetFit,
      })
      setQuoteCompletedTracked(true)
    }
  }, [input, result, quoteCompletedTracked, quoteSurface, weekdaySaverProteinsValue])

  const handleFieldChange = (field: keyof QuoteInput, value: string | number | boolean | undefined) => {
    if (!quoteStartIntentCaptured && QUOTE_STARTED_INPUT_FIELDS.includes(field)) {
      setQuoteStartIntentCaptured(true)
    }
    setInput((prev) => ({ ...prev, [field]: value }))
  }

  // Tap to take the weekday rate, tap again to go back. Upgrades stay as
  // they are — the Weekday Special carries the full menu.
  const handleWeekdaySaverToggle = () => {
    setInput((prev) => ({
      ...prev,
      pricingTier: prev.pricingTier === "weekday_saver" ? "standard" : "weekday_saver",
    }))
  }

  // First-screen estimate for the hero: same rates as the builder, before the
  // visitor has typed a city (the builder needs city/ZIP for the exact range).
  const heroAdults = Math.max(0, Math.floor(input.adults || 0))
  const heroKids = Math.max(0, Math.floor(input.kids || 0))
  const heroEstimate = (weekday: boolean) => {
    const adultRate = weekday ? GUEST_TIERS.adult.weekdayPrice : GUEST_TIERS.adult.price
    const kidRate = weekday ? GUEST_TIERS.child.weekdayPrice : GUEST_TIERS.child.price
    const subtotal = Math.round((heroAdults * adultRate + heroKids * kidRate) * 100) / 100
    return Math.max(subtotal, MINIMUM_SPEND)
  }
  const fmtMoney = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2))
  const scrollToBuilder = (focusId: string) => {
    document.getElementById("quote-builder")?.scrollIntoView({ behavior: "smooth", block: "start" })
    window.setTimeout(() => document.getElementById(focusId)?.focus(), 450)
  }
  const onHeroPlanClick = (plan: "weekday" | "standard") => {
    setHeroTouched(true)
    if (plan === "weekday") {
      if (weekdayEligible && input.pricingTier !== "weekday_saver") handleWeekdaySaverToggle()
      if (!weekdayEligible) {
        pushToast(
          "error",
          "Weekday Special needs a Mon–Thu date",
          `Pick a Monday–Thursday date for ${weekdayAdultRateLabel} and a free appetizer platter. The Standard Plan at $${GUEST_TIERS.adult.price.toFixed(2)}/person applies any day.`,
        )
      }
    } else if (input.pricingTier === "weekday_saver") {
      handleWeekdaySaverToggle()
    }
    scrollToBuilder(input.eventDate ? "quote-location" : "quote-event-date")
  }

  // Upgrades are available on every tier, Weekday Special included.
  const handleAddOnToggle = (key: keyof QuoteInput["addOns"], checked: boolean) => {
    setInput((prev) => ({
      ...prev,
      addOns: {
        ...prev.addOns,
        [key]: checked,
      },
    }))
  }

  const [adRefCode, setAdRefCode] = useState<string | undefined>(undefined)
  useEffect(() => {
    setAdRefCode(getAdRefCode())
  }, [])

  // Two lines: texts go to the handset a person answers, calls go through
  // Twilio. Showing one number for both is what puts a customer's text
  // somewhere nobody can reply from.
  const smsPhoneDisplay = phone.sms.display
  const voicePhoneDisplay = phone.voice.display
  const phoneRaw = phone.sms.e164
  const displayEmail = "support@realhibachi.com"
  const emailTo = "support@realhibachi.com"
  // The code has to survive the SMS path too, or every "text us this quote"
  // referral becomes unattributable — append it to the prefilled message.
  const trimmedReferralCode = referralCode.toUpperCase().replace(/\s+/g, "").slice(0, 32)
  const smsBodyWithReferral = trimmedReferralCode ? `${smsBody}\nReferral code: ${trimmedReferralCode}` : smsBody
  // Paid visitors carry an [AD-xxxxxx] tag in the prefilled text so a manual
  // SMS lead can be attributed back to the ad click (set post-hydration to
  // keep SSR markup stable).
  const smsBodyWithAdRef = adRefCode ? `${smsBodyWithReferral}\n[${adRefCode}]` : smsBodyWithReferral
  const smsHref = `sms:${phoneRaw}?body=${encodeUrlComponent(smsBodyWithAdRef)}`
  const whatsappLink = whatsappHref(smsBodyWithAdRef)
  const emailHref = `mailto:${emailTo}?subject=${encodeUrlComponent(emailPayload.subject)}&body=${encodeUrlComponent(emailPayload.body)}`
  const contactDisabled = !result.hasCoreInputs
  const missingRequiredBookingFields =
    !result.hasCoreInputs
    || !customerName.trim()
    || !customerEmail.trim()
    || !customerPhone.trim()
    || !eventTime
    || !hearAboutUs
  // Name what is actually still empty so the validation toast points at the
  // exact box the user missed instead of listing every required field.
  const missingFieldLabels = [
    !customerName.trim() && "your name",
    !customerEmail.trim() && "email",
    !customerPhone.trim() && "phone",
    !input.eventDate && "event date",
    !eventTime && "event time",
    !input.location.trim() && "city or ZIP",
    result.guestCount <= 0 && "guest count",
    !hearAboutUs && "how you heard about us",
  ].filter((label): label is string => Boolean(label))

  const missingFieldsSentence =
    missingFieldLabels.length > 1
      ? `${missingFieldLabels.slice(0, -1).join(", ")} and ${missingFieldLabels[missingFieldLabels.length - 1]}`
      : missingFieldLabels[0]
  const bookingConfirmationDepositHref = useMemo(() => {
    if (!bookingConfirmation) return "/deposit/pay"

    const params = new URLSearchParams({
      source: QUOTE_SOURCE,
      event_date: bookingConfirmation.eventDate,
      event_time: bookingConfirmation.eventTime,
      location: bookingConfirmation.location,
      adults: String(bookingConfirmation.adults),
      kids: String(bookingConfirmation.kids),
      tent_10x10: bookingConfirmation.tent10x10 ? "yes" : "no",
      estimate_low: String(Math.round(bookingConfirmation.estimateLow)),
      estimate_high: String(Math.round(bookingConfirmation.estimateHigh)),
    })

    if (bookingConfirmation.bookingId) {
      params.set("id", bookingConfirmation.bookingId)
    }

    return `/deposit/pay?${params.toString()}`
  }, [bookingConfirmation])
  const selectedPremiumUpgrades = useMemo(() => {
    const labels: string[] = []
    if (input.addOns.steak) labels.push("Filet Mignon")
    if (input.addOns.shrimp) labels.push("Scallops")
    if (input.addOns.lobster) labels.push("Lobster Tail")
    return labels
  }, [input.addOns.lobster, input.addOns.shrimp, input.addOns.steak])
  const selectedPremiumUpgradesText = selectedPremiumUpgrades.length > 0 ? selectedPremiumUpgrades.join(", ") : "None"

  // A toast at the top of the page is invisible to a phone user whose thumb is
  // on a button at the bottom — session recordings showed people tapping CTAs
  // A native date input only opens its calendar on a precise tap; on phones a
  // near-miss reads as "the form is broken". Any focus or click pops the picker
  // outright — showPicker throws when already open or outside a user gesture,
  // and in both cases plain focus is the right leftover behavior.
  const openNativeDatePicker = (event: React.SyntheticEvent<HTMLInputElement>) => {
    try {
      event.currentTarget.showPicker?.()
    } catch {}
  }

  // repeatedly with no visible response. Walk them to the box they missed.
  const focusFirstMissingField = () => {
    const selector = !input.eventDate
      ? '[data-quote-field="date"]'
      : !eventTime
        ? '[data-quote-field="time"]'
        : !input.location.trim()
          ? '[data-quote-field="location"]'
          : result.guestCount <= 0
            ? '[data-quote-field="adults"]'
            : !customerName.trim()
              ? '[data-quote-field="name"]'
              : !customerEmail.trim()
                ? '[data-quote-field="email"]'
                : !customerPhone.trim()
                  ? '[data-quote-field="phone"]'
                  : '[data-quote-field="hear-about-us"]'
    const el = document.querySelector<HTMLElement>(selector)
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    window.setTimeout(() => el.focus(), 400)
  }

  // The moment someone taps SMS/WhatsApp we already know the whole quote, so
  // ping the workbench immediately instead of waiting for the text to arrive
  // (which pre-port lands only on the owner's phone). sendBeacon survives the
  // page being replaced by the sms: navigation.
  const reportContactIntent = (channel: string) => {
    try {
      const payload = JSON.stringify({
        channel,
        summary: quoteSummary,
        guests: result.guestCount,
        eventDate: input.eventDate || "",
        location: input.location || "",
        referralCode: trimmedReferralCode || undefined,
        hearAboutUs: hearAboutUs || undefined,
      })
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/quote/contact-intent", new Blob([payload], { type: "application/json" }))
      } else {
        fetch("/api/quote/contact-intent", { method: "POST", body: payload, keepalive: true })
      }
    } catch {}
  }

  const onSmsClick = () => {
    if (contactDisabled) {
      pushToast("error", "Almost there", "Add your event date, city or ZIP, and guest count first.")
      focusFirstMissingField()
      return
    }
    reportContactIntent("sms")
    trackEvent("contact_sms_click", {
      ref_code: adRefCode ?? "none",
      gclid: getStoredGclid() ?? "none",
      contact_surface: quoteSurface,
      quote_summary: quoteSummary,
      city_or_zip: input.location || "unspecified",
      tableware_rental: input.tablewareRental,
      tent_10x10: input.tent10x10,
      quote_tier: input.pricingTier,
      weekday_saver_proteins: weekdaySaverProteinsValue,
      add_on_steak: input.addOns.steak,
      add_on_shrimp: input.addOns.shrimp,
      add_on_lobster: input.addOns.lobster,
      event_time: eventTime || "unspecified",
    })
    if ((window as Window & { __REALHIBACHI_DISABLE_NAVIGATION__?: boolean }).__REALHIBACHI_DISABLE_NAVIGATION__) {
      return
    }
    window.location.href = smsHref
  }

  const onWhatsAppClick = () => {
    if (contactDisabled) {
      pushToast("error", "Almost there", "Add your event date, city or ZIP, and guest count first.")
      focusFirstMissingField()
      return
    }
    reportContactIntent("whatsapp")
    trackEvent("contact_whatsapp_click", {
      ref_code: adRefCode ?? "none",
      gclid: getStoredGclid() ?? "none",
      contact_surface: quoteSurface,
      quote_summary: quoteSummary,
      city_or_zip: input.location || "unspecified",
      tableware_rental: input.tablewareRental,
      tent_10x10: input.tent10x10,
      quote_tier: input.pricingTier,
      weekday_saver_proteins: weekdaySaverProteinsValue,
      add_on_steak: input.addOns.steak,
      add_on_shrimp: input.addOns.shrimp,
      add_on_lobster: input.addOns.lobster,
      event_time: eventTime || "unspecified",
    })
    if ((window as Window & { __REALHIBACHI_DISABLE_NAVIGATION__?: boolean }).__REALHIBACHI_DISABLE_NAVIGATION__) {
      return
    }
    window.open(whatsappLink, "_blank", "noopener,noreferrer")
  }

  const onCallClick = () => {
    if (contactDisabled) {
      pushToast("error", "Almost there", "Add your event date, city or ZIP, and guest count first.")
      focusFirstMissingField()
      return
    }
    trackEvent("contact_call_click", {
      contact_surface: quoteSurface,
      quote_summary: quoteSummary,
      city_or_zip: input.location || "unspecified",
      tableware_rental: input.tablewareRental,
      tent_10x10: input.tent10x10,
      quote_tier: input.pricingTier,
      weekday_saver_proteins: weekdaySaverProteinsValue,
      add_on_steak: input.addOns.steak,
      add_on_shrimp: input.addOns.shrimp,
      add_on_lobster: input.addOns.lobster,
      event_time: eventTime || "unspecified",
    })
    if ((window as Window & { __REALHIBACHI_DISABLE_NAVIGATION__?: boolean }).__REALHIBACHI_DISABLE_NAVIGATION__) {
      return
    }
    window.location.href = phone.voice.tel
  }

  const onEmailClick = () => {
    if (contactDisabled) {
      pushToast("error", "Almost there", "Add your event date, city or ZIP, and guest count first.")
      focusFirstMissingField()
      return
    }
    trackEvent("contact_email_click", {
      contact_surface: quoteSurface,
      quote_summary: quoteSummary,
      city_or_zip: input.location || "unspecified",
      tableware_rental: input.tablewareRental,
      tent_10x10: input.tent10x10,
      quote_tier: input.pricingTier,
      weekday_saver_proteins: weekdaySaverProteinsValue,
      add_on_steak: input.addOns.steak,
      add_on_shrimp: input.addOns.shrimp,
      add_on_lobster: input.addOns.lobster,
      event_time: eventTime || "unspecified",
    })
    if ((window as Window & { __REALHIBACHI_DISABLE_NAVIGATION__?: boolean }).__REALHIBACHI_DISABLE_NAVIGATION__) {
      return
    }
    window.location.href = emailHref
  }

  const submitBookingRequest = async (conversionType: "book_online_click" | "deposit_lock_click") => {
    if (bookingRequestSubmitting) return
    if (missingRequiredBookingFields) {
      pushToast("error", "A few details missing", `Still need ${missingFieldsSentence}.`)
      focusFirstMissingField()
      return
    }

    setBookingRequestSubmitting(true)
    const bookingEventId = `booking_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

    trackEvent("booking_submit", {
      lead_source: quoteSurface,
      lead_channel: "website_booking_request",
      lead_type: "booking_request",
      booking_request: true,
      contact_surface: quoteSurface,
      quote_surface: quoteSurface,
      city_or_zip: input.location || "unspecified",
      guest_count: result.guestCount,
      adults: input.adults,
      kids: input.kids,
      event_date: input.eventDate || "unspecified",
      event_time: eventTime || "unspecified",
      quote_tier: input.pricingTier,
      weekday_saver_proteins: weekdaySaverProteinsValue,
      loyalty_status: input.loyaltyStatus ?? "none",
      estimate_low: result.totalRange.low,
      estimate_high: result.totalRange.high,
      value: result.totalRange.low,
      currency: "USD",
      event_id: bookingEventId,
      referral_code: trimmedReferralCode || "none",
      hear_about_us: hearAboutUs || "unspecified",
    })

    const pricingTierLabel = isWeekdaySaverTier ? weekdaySaverPolicy.title : "Standard Plan"
    const message = [
      "Website customer clicked Book Now. No deposit was collected.",
      "",
      `Quote Summary: ${quoteSummary}`,
      `Pricing Tier: ${pricingTierLabel}`,
      `Estimated Total: $${result.totalRange.low.toFixed(0)} - $${result.totalRange.high.toFixed(0)}`,
      `Tableware Rental: ${input.tablewareRental ? "Yes" : "No"}`,
      `Premium Upgrades: ${selectedPremiumUpgradesText}`,
      "",
      "Please contact this customer to finalize booking details.",
    ].join("\n")

    try {
      const response = await fetch("/api/booking-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          customerPhone: customerPhone.trim(),
          smsConsent,
          eventDate: input.eventDate,
          eventTime,
          location: input.location.trim(),
          adults: input.adults,
          kids: input.kids,
          pricingTierLabel,
          estimateLow: result.totalRange.low,
          estimateHigh: result.totalRange.high,
          tablewareRental: input.tablewareRental,
          tent10x10: input.tent10x10,
          premiumUpgrades: selectedPremiumUpgrades,
          quoteSummary,
          leadSource: quoteSurface,
          eventId: bookingEventId,
          pageReferrer: document.referrer || undefined,
          referralCode: trimmedReferralCode || undefined,
          hearAboutUs: hearAboutUs || undefined,
          note: message,
        }),
      })

      const payload = (await response.json().catch(() => null)) as { success?: boolean; error?: string; message?: string } | null
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || payload?.message || `Booking request failed with status ${response.status}`)
      }
      const bookingPayload = payload as {
        success?: boolean
        bookingFallback?: {
          bookingId?: string
        } | null
        customerConfirmation?: {
          delivered?: boolean
          skippedReason?: string
        }
      }

      setBookingConfirmation({
        bookingId: bookingPayload.bookingFallback?.bookingId,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim(),
        eventDate: input.eventDate,
        eventTime,
        location: input.location.trim(),
        adults: input.adults,
        kids: input.kids,
        pricingTierLabel,
        estimateLow: result.totalRange.low,
        estimateHigh: result.totalRange.high,
        tablewareRental: input.tablewareRental,
        tent10x10: input.tent10x10,
        premiumUpgrades: selectedPremiumUpgrades,
        customerEmailDelivered: bookingPayload.customerConfirmation?.delivered === true,
      })
    } catch (error) {
      pushToast(
        "error",
        "Booking request didn't go through",
        error instanceof Error ? error.message : "Please try again, or text us your quote instead.",
      )
    } finally {
      setBookingRequestSubmitting(false)
    }
  }

  const onBookOnlineClick = () => {
    void submitBookingRequest("book_online_click")
  }

  // ── Wizard plumbing ──
  const goToStep = (next: 1 | 2 | 3) => {
    setStep(next)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  // The missing-field walker only finds inputs on the current step; send the
  // visitor back to step 1 first when date / time / city are still empty.
  const coreMissing = !input.eventDate || !eventTime || !input.location.trim()
  const backToCoreFields = () => {
    if (step !== 1) goToStep(1)
    window.setTimeout(focusFirstMissingField, step === 1 ? 0 : 450)
  }
  const onPrimary = () => {
    if (step === 1) {
      setHeroTouched(true)
      if (!input.eventDate || !input.location.trim()) {
        pushToast("error", "Almost there", "Add your event date and city or ZIP to see the price.")
        window.setTimeout(focusFirstMissingField, 0)
        return
      }
      goToStep(2)
      return
    }
    if (step === 2) {
      goToStep(3)
      return
    }
    if (coreMissing) {
      pushToast("error", "One more thing", "Add your event date, start time and city first.")
      backToCoreFields()
      return
    }
    onBookOnlineClick()
  }
  const smsFromWizard = () => {
    if (contactDisabled) {
      pushToast("error", "Almost there", "Add your event date, city or ZIP, and guest count first.")
      backToCoreFields()
      return
    }
    onSmsClick()
  }
  const whatsappFromWizard = () => {
    if (contactDisabled) {
      pushToast("error", "Almost there", "Add your event date, city or ZIP, and guest count first.")
      backToCoreFields()
      return
    }
    onWhatsAppClick()
  }
  const emailFromWizard = () => {
    if (contactDisabled) {
      pushToast("error", "Almost there", "Add your event date, city or ZIP, and guest count first.")
      backToCoreFields()
      return
    }
    onEmailClick()
  }
  const primaryLabel =
    step === 1 ? "See my price" : step === 2 ? "Continue to book" : bookingRequestSubmitting ? "Submitting…" : "Book now"
  const primaryHint =
    step === 1
      ? "No phone number needed"
      : step === 2
        ? "Nothing charged yet"
        : `We confirm within hours · full refund up to 72h before`
  const planName = isWeekdaySaverTier ? weekdaySaverPolicy.title : "Standard Plan"
  const totalLabel =
    result.totalRange.low === result.totalRange.high
      ? `$${fmtMoney(result.totalRange.low)}`
      : `$${fmtMoney(result.totalRange.low)}–$${fmtMoney(result.totalRange.high)}`
  const priceCard = (
    <div className="flex flex-col gap-1.5 rounded-[28px] bg-flame p-[22px] text-cream lg:p-7">
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-flame-100">
        {planName} · {result.guestCount} guests
      </span>
      <div className="flex items-baseline gap-1.5">
        <span className="font-serif text-[52px] font-extrabold leading-none lg:text-[56px]">{totalLabel}</span>
        <span className="text-sm opacity-85">all-in</span>
      </div>
      <p className="text-[13px] leading-relaxed opacity-90">
        Food, chef, live show, setup &amp; cleanup, travel within 50 mi. Gratuity not included.
      </p>
      {isWeekdaySaverTier ? (
        <p className="text-[12px] opacity-90">{WEEKDAY_SAVER_MENU_DETAIL}</p>
      ) : weekdayEligible && weekdaySavings > 0 ? (
        <button type="button" onClick={() => { setHeroTouched(true); handleWeekdaySaverToggle() }} className="mt-1 self-start rounded-full bg-cream/20 px-3 py-1 text-[12px] font-semibold underline underline-offset-2">
          Apply Weekday Special — save ${weekdaySavings}
        </button>
      ) : null}
    </div>
  )

  return (
    <div className="bg-cream text-ink">
      <div className="mx-auto max-w-7xl px-5 pb-36 pt-[calc(var(--header-height,60px)+12px)] lg:px-8 lg:pb-20 lg:pt-[calc(var(--header-height,72px)+36px)]">
      <div className="mx-auto max-w-5xl">
        {bookingConfirmation ? (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-confirmation-title"
          >
            <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-[#f1c7b1] bg-[linear-gradient(135deg,#fff7f2_0%,#fff1ec_52%,#fff8f1_100%)] p-5 shadow-[0_30px_90px_rgba(64,22,10,0.35)] sm:p-7">
              <button
                type="button"
                onClick={() => setBookingConfirmation(null)}
                className="absolute right-4 top-4 rounded-full bg-white/80 p-2 text-slate-500 shadow-sm transition hover:bg-white hover:text-slate-900"
                aria-label="Close booking confirmation"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 ring-8 ring-white/70">
                  <CheckCircle2 className="h-9 w-9" />
                </div>
                <Badge className="mb-3 w-fit bg-[linear-gradient(135deg,#d3542b,#b91c1c)] text-white hover:brightness-105">
                  Booking Request Sent
                </Badge>
                <h2 id="booking-confirmation-title" className="text-3xl font-bold tracking-tight text-[#7f2d16] sm:text-4xl">
                  Great, you're on our booking list!
                </h2>
                <p className="mt-3 max-w-xl text-base leading-7 text-[#9a3412]">
                  {bookingConfirmation.customerEmailDelivered
                    ? "We received your event details and sent a confirmation email. Our team will contact you soon to confirm chef availability, menu options, and the final details."
                    : "We received your event details. Our team will contact you soon to confirm chef availability, menu options, and the final details."}
                </p>
              </div>

              <div className="mt-6 grid gap-3 rounded-2xl border border-[#f1d4c7] bg-white/90 p-4 text-sm text-slate-700 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b45309]">Event</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {bookingConfirmation.eventDate} at {bookingConfirmation.eventTime}
                  </p>
                  <p>{bookingConfirmation.location}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b45309]">Estimate</p>
                  <p className="mt-1 font-medium text-slate-900">
                    ${bookingConfirmation.estimateLow.toFixed(0)} - ${bookingConfirmation.estimateHigh.toFixed(0)}
                  </p>
                  <p>{bookingConfirmation.adults} adults, {bookingConfirmation.kids} kids</p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-[#efcfbf] bg-[#fff3ea] p-4 text-center">
                <p className="text-lg font-semibold text-[#9a3412]">Your booking request is complete.</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  You can pay the deposit now to lock the date, or simply wait for our team to contact you and pay after we confirm the details.
                </p>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Button asChild className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700">
                  <Link href={bookingConfirmationDepositHref}>Pay Deposit Now</Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setBookingConfirmation(null)}
                  className="rounded-full border-[#efcfbf] bg-white text-[#9a3412] hover:bg-[#fff7f2]"
                >
                  Wait for Our Contact
                </Button>
              </div>

              <p className="mt-4 text-center text-xs leading-5 text-slate-600">
                Questions? Call {voicePhoneDisplay}, text {smsPhoneDisplay}, or email {displayEmail}.
              </p>
            </div>
          </div>
        ) : null}

        <div
          aria-live="polite"
          className="pointer-events-none fixed left-1/2 top-[calc(var(--header-height,60px)+8px)] z-[95] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto animate-in fade-in slide-in-from-top-4 duration-300 rounded-xl border bg-white/95 p-3 shadow-lg backdrop-blur ${
                toast.kind === "urgency"
                  ? "border-red-200"
                  : toast.kind === "promo"
                    ? "border-emerald-300"
                    : "border-amber-300"
              }`}
            >
              <div className="flex items-start gap-2.5">
                {toast.kind === "urgency" ? (
                  <span className="relative mt-1 flex h-2.5 w-2.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                  </span>
                ) : toast.kind === "promo" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug text-gray-900">{toast.title}</p>
                  {toast.detail && <p className="mt-0.5 text-xs leading-snug text-gray-600">{toast.detail}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  aria-label="Dismiss notification"
                  className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* ── 3-step wizard (2026-09-08 redesign): who's coming → your price → lock your date ── */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={step === 1 ? "Back to previous page" : "Previous step"}
            onClick={() => (step === 1 ? window.history.back() : goToStep((step - 1) as 1 | 2))}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ink/15 bg-surface text-ink"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <div className="flex flex-1 gap-1.5" aria-hidden="true">
            {[1, 2, 3].map((n) => (
              <div key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-flame" : "bg-ink/10"}`} />
            ))}
          </div>
          <span className="text-xs font-semibold text-clay-600">Step {step} of 3</span>
        </div>

        <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-14">
          <div className="flex flex-col gap-5 lg:gap-7">
            {step === 1 ? (
              <>
                <h1 className="font-serif text-[32px] font-extrabold leading-[1.05] lg:text-[44px]">Who&apos;s coming?</h1>
                <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4">
                  {(
                    [
                      { key: "adults", label: "Adults", sub: `$${(isWeekdaySaverTier ? GUEST_TIERS.adult.weekdayPrice : GUEST_TIERS.adult.price).toFixed(2)} each`, min: 1 },
                      { key: "kids", label: "Kids 5–12", sub: `$${(isWeekdaySaverTier ? GUEST_TIERS.child.weekdayPrice : GUEST_TIERS.child.price).toFixed(2)} each · under 5 free`, min: 0 },
                    ] as const
                  ).map((row) => {
                    const value = row.key === "adults" ? input.adults : input.kids
                    return (
                      <div key={row.key} className="flex items-center gap-2.5 rounded-[28px] border border-ink/10 bg-surface px-[18px] py-3.5 shadow-organic">
                        <div className="flex-1">
                          <p className="text-[15px] font-semibold">{row.label}</p>
                          <p className="text-xs text-clay-600">{row.sub}</p>
                        </div>
                        <button
                          type="button"
                          aria-label={`Fewer ${row.label.toLowerCase()}`}
                          disabled={value <= row.min}
                          onClick={() => handleFieldChange(row.key, Math.max(row.min, (value || 0) - 1))}
                          className="flex h-11 w-11 items-center justify-center rounded-full border border-ink/15 text-xl text-ink disabled:opacity-35"
                        >
                          −
                        </button>
                        <span
                          id={row.key === "adults" ? "quote-adults" : "quote-kids"}
                          data-quote-field={row.key}
                          tabIndex={-1}
                          className="w-9 text-center font-serif text-2xl font-extrabold tabular-nums"
                        >
                          {value}
                        </span>
                        <button
                          type="button"
                          aria-label={`More ${row.label.toLowerCase()}`}
                          onClick={() => handleFieldChange(row.key, Math.min(200, (value || 0) + 1))}
                          className="flex h-11 w-11 items-center justify-center rounded-full bg-flame text-xl text-white"
                        >
                          +
                        </button>
                      </div>
                    )
                  })}
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="quote-event-date" className="text-[13px] font-semibold">
                    Event date
                  </label>
                  <div className="relative">
                    <Input
                      id="quote-event-date"
                      type="date"
                      data-quote-field="date"
                      value={input.eventDate}
                      onChange={(e) => handleFieldChange("eventDate", e.target.value)}
                      onClick={openNativeDatePicker}
                      onFocus={openNativeDatePicker}
                      className="h-12 rounded-full border-ink/15 bg-surface px-4 text-[15px] shadow-none"
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 max-w-[45%] -translate-y-1/2 truncate text-[11px] font-semibold text-gold-700">
                      {slotsLeft !== null && input.eventDate ? `${slotsLeft} slot${slotsLeft === 1 ? "" : "s"} left` : ""}
                    </span>
                  </div>
                  {weekdayDateOk || isWeekdaySaverTier ? (
                    <div className="flex items-center gap-2.5 rounded-2xl bg-gold-100 px-3.5 py-3 text-[13px] leading-snug text-gold-800">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-300 text-xs font-bold">
                        {weekdayEligible ? "✓" : "🥟"}
                      </span>
                      <span className="flex-1">
                        {isWeekdaySaverTier
                          ? `Weekday Special on — ${weekdayRatesLabel}, free appetizer platter included.`
                          : `Mon–Thu date — take the Weekday Special and save $${weekdaySavings}, plus a free appetizer platter.`}
                      </span>
                      {weekdayEligible ? (
                        <button
                          type="button"
                          aria-pressed={isWeekdaySaverTier}
                          onClick={() => {
                            setHeroTouched(true)
                            handleWeekdaySaverToggle()
                          }}
                          className={`h-9 shrink-0 rounded-full px-3.5 text-xs font-bold ${
                            isWeekdaySaverTier ? "bg-gold-800 text-gold-100" : "bg-gold-700 text-white"
                          }`}
                        >
                          {isWeekdaySaverTier ? "Selected" : "Apply"}
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-xs text-clay-600">
                      Mon–Thu: ${GUEST_TIERS.adult.weekdayPrice.toFixed(2)}/adult + a free appetizer platter.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowAvailabilityCalendar((v) => !v)}
                    className="inline-flex items-center gap-1 self-start text-xs font-semibold text-flame-700"
                  >
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                    {showAvailabilityCalendar ? "Hide availability calendar" : "See availability calendar"}
                  </button>
                  {showAvailabilityCalendar ? (
                    <AvailabilityCalendar
                      value={input.eventDate}
                      onSelect={(date) => {
                        handleFieldChange("eventDate", date)
                        setShowAvailabilityCalendar(false)
                      }}
                    />
                  ) : null}
                </div>

                <div className="flex flex-col gap-2">
                  <span id="quote-event-time-label" className="text-[13px] font-semibold">
                    Start time
                  </span>
                  <div
                    id="quote-event-time"
                    role="radiogroup"
                    aria-labelledby="quote-event-time-label"
                    data-quote-field="time"
                    tabIndex={-1}
                    className="grid grid-cols-4 gap-1.5"
                  >
                    {EVENT_TIME_OPTIONS.map((timeValue) => {
                      const selected = eventTime === timeValue
                      const [h, m] = timeValue.split(":")
                      const hour = Number(h)
                      const label = `${hour > 12 ? hour - 12 : hour}:${m} ${hour >= 12 ? "pm" : "am"}`
                      return (
                        <button
                          key={timeValue}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setEventTime(timeValue)}
                          className={`h-12 rounded-full text-sm font-semibold transition ${
                            selected ? "bg-flame text-cream" : "border border-ink/15 bg-surface text-ink"
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="quote-location" className="text-[13px] font-semibold">
                    City or ZIP
                  </label>
                  <Input
                    id="quote-location"
                    type="text"
                    data-quote-field="location"
                    value={input.location}
                    placeholder="e.g. Irvine or 92618"
                    onChange={(e) => handleFieldChange("location", e.target.value)}
                    className="h-12 rounded-full border-ink/15 bg-surface px-4 text-[15px] shadow-none"
                  />
                  <span className="text-xs text-clay-600">Street address only after your date is confirmed.</span>
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <h1 className="font-serif text-[32px] font-extrabold leading-[1.05] lg:text-[44px]">Your price</h1>
                <div className="lg:hidden">{priceCard}</div>

                <div className="flex flex-col text-sm">
                  <div className="flex justify-between border-b border-ink/15 py-2.5">
                    <span>
                      {heroAdults} adults × ${(isWeekdaySaverTier ? GUEST_TIERS.adult.weekdayPrice : GUEST_TIERS.adult.price).toFixed(2)}
                    </span>
                    <span className="font-semibold">${fmtMoney(heroAdults * (isWeekdaySaverTier ? GUEST_TIERS.adult.weekdayPrice : GUEST_TIERS.adult.price))}</span>
                  </div>
                  {heroKids > 0 ? (
                    <div className="flex justify-between border-b border-ink/15 py-2.5">
                      <span>
                        {heroKids} kids × ${(isWeekdaySaverTier ? GUEST_TIERS.child.weekdayPrice : GUEST_TIERS.child.price).toFixed(2)}
                      </span>
                      <span className="font-semibold">${fmtMoney(heroKids * (isWeekdaySaverTier ? GUEST_TIERS.child.weekdayPrice : GUEST_TIERS.child.price))}</span>
                    </div>
                  ) : null}
                  {result.effectiveBase > result.baseSubtotal ? (
                    <div className="flex justify-between border-b border-ink/15 py-2.5 text-flame-700">
                      <span>${MINIMUM_SPEND} event minimum applied</span>
                      <span className="font-semibold">+${fmtMoney(result.effectiveBase - result.baseSubtotal)}</span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between border-b border-ink/15 py-2.5">
                    <span>Travel · {input.location.trim() || "Southern California"}</span>
                    {result.travelFeeRange.high <= 0 ? (
                      <span className="rounded-full bg-gold-100 px-2.5 py-0.5 text-[11px] font-semibold text-gold-800">Included</span>
                    ) : (
                      <span className="font-semibold">
                        {result.travelFeeRange.low === result.travelFeeRange.high
                          ? `$${result.travelFeeRange.high.toFixed(0)}`
                          : `$${result.travelFeeRange.low.toFixed(0)}–$${result.travelFeeRange.high.toFixed(0)}`}
                      </span>
                    )}
                  </div>
                  {input.tablewareRental ? (
                    <div className="flex justify-between border-b border-ink/15 py-2.5">
                      <span>Tables, chairs &amp; utensils</span>
                      <span className="font-semibold">+${result.tablewareFee.toFixed(0)}</span>
                    </div>
                  ) : null}
                  {!isWeekdaySaverTier && selectedPremiumUpgrades.length > 0 ? (
                    <div className="flex justify-between border-b border-ink/15 py-2.5">
                      <span>Premium upgrades ({selectedPremiumUpgradesText})</span>
                      <span className="font-semibold">up to +${result.addOnTotalRange.high.toFixed(0)}</span>
                    </div>
                  ) : null}
                  {result.loyaltyDiscount > 0 ? (
                    <div className="flex justify-between border-b border-ink/15 py-2.5 text-gold-800">
                      <span>{input.loyaltyStatus === "party_guest" ? "Party guest card" : "Returning customer"}</span>
                      <span className="font-semibold">−${result.loyaltyDiscount.toFixed(0)}</span>
                    </div>
                  ) : null}
                  {result.includesAppetizerPlatter || result.guestCount >= 20 ? (
                    <div className="flex items-start gap-1.5 py-2.5 text-[13px] font-semibold text-gold-800">
                      <Gift className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      {result.includesAppetizerPlatter
                        ? "Free appetizer platter — gyoza, edamame & spring rolls ($40 value, included with the Weekday Special)"
                        : "Free appetizer platter — gyoza, edamame & spring rolls ($40 value, parties of 20+, through Oct 31)"}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2.5">
                  <p className="text-[13px] font-semibold">Optional add-ons</p>
                  <button
                    type="button"
                    aria-pressed={input.tablewareRental}
                    onClick={() => handleFieldChange("tablewareRental", !input.tablewareRental)}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left ${input.tablewareRental ? "bg-flame-100" : "bg-surface"}`}
                  >
                    <span className={`h-[22px] w-[22px] shrink-0 rounded-full border-2 border-flame ${input.tablewareRental ? "bg-flame" : ""}`} />
                    <span className="flex-1">
                      <span className="block text-sm font-semibold">Tables, chairs &amp; utensils</span>
                      <span className="block text-xs text-clay-600">+$15 per guest · skip if you have your own</span>
                    </span>
                    <span className="text-sm font-semibold">{input.tablewareRental ? `+$${result.tablewareFee.toFixed(0)}` : "+$15/guest"}</span>
                  </button>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { key: "steak", label: "Filet mignon", price: "+$8" },
                        { key: "shrimp", label: "Scallops", price: "+$6" },
                        { key: "lobster", label: "Lobster tail", price: "+$12" },
                      ] as const
                    ).map((up) => {
                      const on = input.addOns[up.key]
                      return (
                        <button
                          key={up.key}
                          type="button"
                          aria-pressed={on}
                          onClick={() => handleAddOnToggle(up.key, !on)}
                          className={`flex h-14 flex-col items-center justify-center rounded-2xl text-xs font-semibold leading-tight ${
                            on ? "bg-flame-100 ring-2 ring-flame" : "bg-surface"
                          }`}
                        >
                          {up.label}
                          <span className="text-[11px] font-bold text-flame-800">{up.price}</span>
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-xs leading-snug text-clay-600">
                    {isWeekdaySaverTier
                      ? "Premium upgrades are Standard Plan only — picking one switches this quote to Standard pricing."
                      : "Per guest who chooses it, on top of the 2 regular proteins."}
                  </p>
                </div>

                {shouldShowWeatherCard && weatherPreview ? (
                  <div className="rounded-2xl bg-surface">
                    <button
                      type="button"
                      onClick={() => setWeatherExpanded((previous) => !previous)}
                      aria-expanded={weatherExpanded}
                      className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm"
                    >
                      <span>
                        <span className="font-semibold">Weather</span> · {weatherPreview.temperatureF}°F,{" "}
                        {weatherPreview.willRain ? "rain possible" : "clear skies"} at {weatherPreview.eventTimeLabel}
                      </span>
                      <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${weatherExpanded ? "rotate-180" : ""}`} aria-hidden="true" />
                    </button>
                    {weatherExpanded ? (
                      <div className="grid grid-cols-3 gap-2 px-4 pb-4 text-xs">
                        <div>
                          <Sunset className="h-4 w-4 text-flame" />
                          <p className="mt-1 text-clay-600">Sunset</p>
                          <p className="font-semibold">{weatherPreview.sunsetTime}</p>
                        </div>
                        <div>
                          {weatherPreview.willRain ? <CloudRain className="h-4 w-4 text-sky-600" /> : <CloudSun className="h-4 w-4 text-gold" />}
                          <p className="mt-1 text-clay-600">Rain</p>
                          <p className="font-semibold">{weatherPreview.rainChance}% chance</p>
                        </div>
                        <div>
                          <ThermometerSun className="h-4 w-4 text-flame-700" />
                          <p className="mt-1 text-clay-600">Temp</p>
                          <p className="font-semibold">{weatherPreview.temperatureF}°F</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <AppreciationBanner source="quote" showCta={false} />

                <button
                  type="button"
                  onClick={smsFromWizard}
                  className="inline-flex items-center gap-2 self-start text-sm font-semibold text-flame-700"
                >
                  <MessageSquare className="h-4 w-4" aria-hidden="true" />
                  Text us this quote instead
                </button>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <h1 className="font-serif text-[32px] font-extrabold leading-[1.05] lg:text-[44px]">Lock your date</h1>
                <div className="flex items-center gap-2.5 rounded-2xl bg-surface px-4 py-3.5 text-[13px] leading-snug">
                  <span className="font-serif text-[22px] font-extrabold">{totalLabel}</span>
                  <span className="text-clay-700">
                    {planName} · {result.guestCount} guests · a ${DEPOSIT_AMOUNT.toFixed(2)} deposit holds your chef
                  </span>
                </div>

                <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-semibold">Name</span>
                    <Input
                      type="text"
                      data-quote-field="name"
                      value={customerName}
                      placeholder="Maria Lopez"
                      autoComplete="name"
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="h-12 rounded-full border-ink/15 bg-surface px-4 text-[15px] shadow-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-semibold">Mobile</span>
                    <Input
                      type="tel"
                      data-quote-field="phone"
                      value={customerPhone}
                      placeholder="(213) 555-0100"
                      autoComplete="tel"
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="h-12 rounded-full border-ink/15 bg-surface px-4 text-[15px] shadow-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 lg:col-span-2">
                    <span className="text-[13px] font-semibold">Email</span>
                    <Input
                      type="email"
                      data-quote-field="email"
                      value={customerEmail}
                      placeholder="you@email.com"
                      autoComplete="email"
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="h-12 rounded-full border-ink/15 bg-surface px-4 text-[15px] shadow-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-semibold">How did you hear about us?</span>
                    <select
                      value={hearAboutUs}
                      data-quote-field="hear-about-us"
                      onChange={(e) => setHearAboutUs(e.target.value)}
                      className="h-12 w-full rounded-full border border-ink/15 bg-surface px-4 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flame"
                    >
                      <option value="">Choose one</option>
                      {HEAR_ABOUT_US_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-semibold">Referral or partner code (optional)</span>
                    <Input
                      type="text"
                      data-quote-field="referral-code"
                      value={referralCode}
                      placeholder="e.g. RH-MARIA50"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      className="h-12 rounded-full border-ink/15 bg-surface px-4 text-[15px] shadow-none"
                    />
                    {trimmedReferralCode ? (
                      <span className="text-xs font-medium text-gold-800">Code {trimmedReferralCode} noted — applied on the final invoice.</span>
                    ) : null}
                  </label>
                </div>
                <label className="flex items-start gap-2.5 text-xs leading-relaxed text-clay-700">
                  <input
                    type="checkbox"
                    checked={smsConsent}
                    onChange={(e) => setSmsConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-flame"
                  />
                  <span>
                    I agree to receive texts from Real Hibachi about my quote and booking. Consent is not a condition of purchase; message
                    and data rates may apply. Reply STOP to opt out, HELP for help.{" "}
                    <a href="/privacy-policy" className="underline">Privacy</a> · <a href="/terms" className="underline">Terms</a>.
                  </span>
                </label>

                <div className="flex flex-col gap-2 text-[13px] leading-snug text-clay-700">
                  {[
                    "Chef confirmed by name 48h before — if we cancel, double your deposit back",
                    "Full deposit refund up to 72h before",
                    "Tarp under the grill, full cleanup before we leave",
                  ].map((line) => (
                    <div key={line} className="flex gap-2.5">
                      <span className="font-bold text-gold-700">✓</span>
                      {line}
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-xs text-clay-600">Prefer to skip the form? Send us this quote instead:</span>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Button type="button" variant="outline" onClick={smsFromWizard} className="h-11 rounded-full border-ink/15 bg-surface text-[13px] font-semibold text-ink">
                      <MessageSquare className="mr-1.5 h-4 w-4" /> Text
                    </Button>
                    <Button type="button" variant="outline" onClick={whatsappFromWizard} className="h-11 rounded-full border-ink/15 bg-surface text-[13px] font-semibold text-ink">
                      <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
                    </Button>
                    <Button type="button" variant="outline" onClick={onCallClick} className="h-11 rounded-full border-ink/15 bg-surface text-[13px] font-semibold text-ink">
                      <Phone className="mr-1.5 h-4 w-4" /> Call
                    </Button>
                    <Button type="button" variant="outline" onClick={emailFromWizard} className="h-11 rounded-full border-ink/15 bg-surface text-[13px] font-semibold text-ink">
                      <Mail className="mr-1.5 h-4 w-4" /> Email
                    </Button>
                  </div>
                </div>
              </>
            ) : null}

            {/* Desktop: the step button sits inline; phones get the sticky bar below. */}
            <div className="hidden lg:flex lg:items-center lg:gap-4">
              <Button
                type="button"
                onClick={onPrimary}
                disabled={step === 3 && bookingRequestSubmitting}
                className="h-14 rounded-full bg-flame px-8 text-base font-semibold text-white hover:bg-flame-600"
              >
                {primaryLabel}
              </Button>
              <span className="text-[13px] text-clay-600">{primaryHint}</span>
            </div>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-[calc(var(--header-height,72px)+24px)] flex flex-col gap-4">
              {priceCard}
              <div className="flex flex-col gap-3 rounded-[28px] border border-ink/10 bg-surface p-6 text-sm leading-relaxed text-clay-700 shadow-organic">
                {[
                  "Chef confirmed by name 48h before — if we cancel, double your deposit back",
                  "Full deposit refund up to 72h before",
                  "Tarp under the grill, full cleanup before we leave",
                ].map((line) => (
                  <div key={line} className="flex gap-2.5">
                    <span className="font-bold text-gold-700">✓</span>
                    {line}
                  </div>
                ))}
              </div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-[28px]">
                <Image src="/images/hero/quote-hero-night.jpg" alt="Night hibachi fire show at a backyard party" fill sizes="400px" className="object-cover saturate-[1.15]" />
              </div>
            </div>
          </aside>
        </div>

        {/* Proof, after the work: real party clips and two verbatim Google reviews. */}
        <div ref={mediaStripRef} className="mt-10 lg:mt-16">
          <ProofStrip media={QUOTE_PROOF_MEDIA.slice(0, 6)} size="sm" />
        </div>
        <div id="quote-reviews" className="mt-4 flex flex-col gap-3 lg:grid lg:grid-cols-3 lg:gap-5">
          {QUOTE_TESTIMONIALS.slice(0, 3).map((testimonial, i) => (
            <blockquote
              key={testimonial.name}
              className={`flex flex-col gap-2 rounded-[28px] border border-ink/10 bg-surface p-[18px] shadow-organic ${i === 2 ? "hidden lg:flex" : ""}`}
            >
              <div className="flex items-center gap-2.5">
                <span className={`flex h-9 w-9 items-center justify-center rounded-full font-serif text-[15px] font-extrabold ${i % 2 ? "bg-flame-300" : "bg-gold-300"}`}>
                  {testimonial.name.charAt(0)}
                </span>
                <span className="text-sm font-semibold">{testimonial.name}</span>
                <span className="ml-auto inline-flex items-center gap-0.5 rounded-full bg-white px-2.5 py-0.5 text-[11px] text-ink/80">
                  <Star className="h-3 w-3 fill-gold text-gold" aria-hidden="true" /> Google
                </span>
              </div>
              <p className="text-sm leading-6 text-ink/90 line-clamp-4 lg:line-clamp-none">{testimonial.text}</p>
            </blockquote>
          ))}
        </div>
      </div>
      </div>

      {/* Phones: the one button that moves the visitor forward, always in reach. */}
      {!bookingConfirmation ? (
        <div className="fixed inset-x-0 bottom-0 z-40 flex flex-col gap-1.5 bg-[linear-gradient(to_top,#f7efe2_70%,transparent)] px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-4 lg:hidden">
          <Button
            type="button"
            onClick={onPrimary}
            disabled={step === 3 && bookingRequestSubmitting}
            className="h-[52px] w-full rounded-full bg-flame text-base font-semibold text-white shadow-organic-lg hover:bg-flame-600"
          >
            {primaryLabel}
          </Button>
          <span className="text-center text-xs text-clay-600">{primaryHint}</span>
        </div>
      ) : null}
    </div>
  )
}
