"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import LazyVideo from "@/components/lazy-video"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
  calcAdultEquivalents,
  isWeekdayEligibleDate,
} from "@/config/pricing-rules"
import { useActiveRegion } from "@/lib/use-active-region"
import { getAdRefCode, getStoredGclid, trackEvent } from "@/lib/tracking"
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

// Real party photos from /gallery — ad visitors land straight on this page and
// need one glance of proof this is a real local operation before the form.
const QUOTE_PROOF_MEDIA = [
  {
    type: "video" as const,
    src: "/videos/hibachi-show.mp4",
    poster: "/videos/posters/hibachi-show.jpg",
    alt: "Live hibachi chef show",
  },
  {
    type: "image" as const,
    src: "/gallery/real-hibachi-party-orange-county-family-event-04.jpg",
    alt: "Real Hibachi chef cooking fresh eggs on the griddle at an Orange County family event",
  },
  {
    type: "video" as const,
    src: "/videos/fried-rice.mp4",
    poster: "/videos/posters/fried-rice.jpg",
    alt: "Fresh hibachi fried rice on the griddle",
  },
  {
    type: "image" as const,
    src: "/gallery/real-hibachi-party-southern-california-dinner-06.jpg",
    alt: "Happy guests with their Real Hibachi chef at a Southern California pool party",
  },
  {
    type: "video" as const,
    src: "/videos/real-fire.mp4",
    poster: "/videos/posters/real-fire.jpg",
    alt: "Real hibachi fire show",
  },
  {
    type: "video" as const,
    src: "/videos/birthday-moment.mp4",
    poster: "/videos/posters/birthday-moment.jpg",
    alt: "Birthday cake moment at a Real Hibachi party",
  },
  {
    type: "image" as const,
    src: "/gallery/real-hibachi-party-orange-county-night-fire-show-18.jpg",
    alt: "Huge hibachi flame lighting up a night party in Orange County",
  },
  {
    type: "image" as const,
    src: "/gallery/real-hibachi-party-santa-barbara-oceanfront-sunset-16.jpg",
    alt: "Oceanfront sunset hibachi party table with lanterns and roses in Santa Barbara",
  },
  {
    type: "video" as const,
    src: "/gallery/real-hibachi-party-malibu-beach-sunset-video-05.mp4",
    poster: "/gallery/real-hibachi-party-malibu-beach-sunset-video-05-poster.jpg",
    alt: "Oceanfront sunset hibachi dinner party with lanterns",
  },
  {
    type: "video" as const,
    src: "/videos/party-highlight.mp4",
    poster: "/videos/posters/party-highlight.jpg",
    alt: "Party highlights from a Real Hibachi event",
  },
  {
    type: "video" as const,
    src: "/videos/atmosphere.mp4",
    poster: "/videos/posters/atmosphere.jpg",
    alt: "The atmosphere at a Real Hibachi dinner party",
  },
] as const

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
const WEEKDAY_SAVER_PROTEIN_LABELS: Record<keyof QuoteInput["weekdaySaverProteins"], string> = {
  chicken: "Chicken",
  steak: "Steak",
  shrimp: "Shrimp",
}
const WEEKDAY_SAVER_MENU_PROTEINS = Object.values(WEEKDAY_SAVER_PROTEIN_LABELS)
const WEEKDAY_SAVER_MENU_TEXT = WEEKDAY_SAVER_MENU_PROTEINS.join(", ")
const WEEKDAY_SAVER_MENU_DETAIL = `Guests pick 2 of 3 proteins: ${WEEKDAY_SAVER_MENU_TEXT}`

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
    if (!Number.isFinite(adults) && !Number.isFinite(kids)) return
    setInput((previous) => ({
      ...previous,
      ...(Number.isFinite(adults) && adults > 0 && adults <= 200 ? { adults } : {}),
      ...(Number.isFinite(kids) && kids >= 0 && kids <= 200 ? { kids } : {}),
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
      setToasts((previous) => [...previous.slice(-2), { id, kind, title, detail }])
      window.setTimeout(() => dismissToast(id), kind === "urgency" ? 10000 : 6500)
    },
    [dismissToast],
  )
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
  const weekdayHeadcountOk = weekdayAdultEquivalents >= WEEKDAY_SPECIAL.minAdultEquivalents
  const weekdayDateOk = Boolean(input.eventDate) && isWeekdayEligibleDate(input.eventDate)
  const hasPremiumUpgrades = input.addOns.steak || input.addOns.shrimp || input.addOns.lobster
  const weekdayEligible = weekdaySaverEnabled && weekdayHeadcountOk && weekdayDateOk

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
    if (!weekdayHeadcountOk) {
      const need = Math.max(1, Math.ceil(WEEKDAY_SPECIAL.minAdultEquivalents - weekdayAdultEquivalents))
      return `Weekday Special — ${weekdayAdultRateLabel} on Mon–Thu — unlocks at ${WEEKDAY_SPECIAL.minAdultEquivalents}+ guests (kids 5–12 count as half). Add ${need} more to qualify.`
    }
    if (!input.eventDate) {
      return `Your party size qualifies for Weekday Special (${weekdayAdultRateLabel}) — pick a Mon–Thu date to see the option.`
    }
    const described = describeEventDate(input.eventDate)
    return described
      ? `${described.label} is a ${described.weekday} — Weekday Special (${weekdayAdultRateLabel}) is Mon–Thu only. Your party size already qualifies.`
      : `Weekday Special (${weekdayAdultRateLabel}) is Mon–Thu only.`
  }, [
    input.eventDate,
    input.pricingTier,
    weekdayAdultEquivalents,
    weekdayAdultRateLabel,
    weekdayEligible,
    weekdayHeadcountOk,
    weekdaySaverEnabled,
    weekdaySaverPolicy.unavailableMessage,
  ])

  // If an edit breaks eligibility while Weekday Special is selected, revert
  // to Standard and say why — losing the discount silently reads as a price
  // hike.
  useEffect(() => {
    if (input.pricingTier !== "weekday_saver" || weekdayEligible) return
    setInput((previous) => ({ ...previous, pricingTier: "standard" }))
    const described = input.eventDate ? describeEventDate(input.eventDate) : null
    const reason = !weekdaySaverEnabled
      ? weekdaySaverPolicy.unavailableMessage
      : !weekdayDateOk
        ? described
          ? `${described.label} is a ${described.weekday} — Weekday Special is Mon–Thu only.`
          : "Weekday Special needs a Mon–Thu event date."
        : `Weekday Special needs ${WEEKDAY_SPECIAL.minAdultEquivalents}+ guests (kids 5–12 count as half).`
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
      `Mon–Thu party with ${WEEKDAY_SPECIAL.minAdultEquivalents}+ guests — tap the green plan to get ${weekdayAdultRateLabel} instead of $${GUEST_TIERS.adult.price.toFixed(2)}.`,
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
    if (guests >= 20) {
      if (promoStageRef.current !== "unlocked") {
        promoStageRef.current = "unlocked"
        pushToast(
          "promo",
          "Free appetizer platter unlocked",
          "Parties of 20+ get gyoza, edamame & spring rolls included ($40 value).",
        )
      }
    } else if (guests >= 15 && promoStageRef.current === "none") {
      promoStageRef.current = "teased"
      const short = 20 - guests
      pushToast(
        "promo",
        `${short} more guest${short === 1 ? "" : "s"} = free appetizer platter`,
        "Parties of 20+ get gyoza, edamame & spring rolls free ($40 value).",
      )
    }
  }, [result.guestCount, pushToast])

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

  // Tap to take the discount, tap again to go back. Selecting it clears
  // premium upgrades — they're not part of the Weekday Special menu.
  const handleWeekdaySaverToggle = () => {
    setInput((prev) => {
      if (prev.pricingTier === "weekday_saver") {
        return { ...prev, pricingTier: "standard" }
      }
      return {
        ...prev,
        pricingTier: "weekday_saver",
        addOns: { steak: false, shrimp: false, lobster: false },
      }
    })
  }

  // Upgrades stay clickable on every tier: checking one while Weekday Special
  // is selected moves the quote back to the Standard Plan (with a toast).
  const handleAddOnToggle = (key: keyof QuoteInput["addOns"], checked: boolean) => {
    if (checked && input.pricingTier === "weekday_saver") {
      pushToast("error", "Switched to Standard Plan", "Premium upgrades aren't part of Weekday Special.")
    }
    setInput((prev) => ({
      ...prev,
      pricingTier: checked ? "standard" : prev.pricingTier,
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

  return (
    <div className="bg-gradient-to-b from-orange-50/70 via-amber-50/30 to-orange-50/50">
      <div className="page-container container mx-auto px-4 pb-12 !pt-[calc(var(--header-height,120px)+1rem)] sm:!pt-[calc(var(--header-height,120px)+2rem)]">
      <div className="max-w-6xl mx-auto">
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
          className="pointer-events-none fixed left-1/2 top-20 z-[95] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2"
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

        <section className="relative mb-8 overflow-hidden rounded-2xl">
          <Image
            src="/images/hero/quote-hero-night.jpg"
            alt=""
            aria-hidden
            fill
            priority
            sizes="100vw"
            className="object-cover object-[58%_40%]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/25 to-black/60" />
          <div className="relative mx-auto max-w-3xl px-5 py-12 text-center text-white sm:py-16">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-300 sm:text-xs">
              Private Hibachi Catering · LA, OC & SoCal
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-5xl">
              See Your Exact Hibachi Price in 30 Seconds
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/90 sm:text-lg">
              No phone number. No sign-up. Food, show, and travel — all in the price you see.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm">
              <span className="rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 backdrop-blur-sm">
                Weekdays from <span className="font-bold text-amber-300">${GUEST_TIERS.adult.weekdayPrice.toFixed(2)}</span>/person · 15+ guests
              </span>
              <span className="rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 backdrop-blur-sm">
                Kids from <span className="font-bold text-amber-300">${GUEST_TIERS.child.weekdayPrice.toFixed(2)}</span>
              </span>
              <span className="rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 backdrop-blur-sm">
                Weekends from <span className="font-bold text-amber-300">${GUEST_TIERS.adult.price.toFixed(2)}</span>
              </span>
            </div>
            {/* The 9/1 tapes showed a 10-guest visitor grinding against the locked
                weekday rate — say who qualifies before anyone starts hoping. */}
            <p className="mt-2 text-xs text-white/75">
              Weekday rates apply Mon–Thu for parties of 15+ guests — all other parties from $
              {GUEST_TIERS.adult.price.toFixed(2)}/person.
            </p>
            <div className="mt-6">
              <Button
                asChild
                className="h-12 rounded-full bg-[hsl(24_79%_55%)] px-8 text-base font-semibold text-white hover:bg-[hsl(24_79%_48%)]"
              >
                <a href="#quote-builder">Get My Exact Price</a>
              </Button>
            </div>
            <div className="mt-4">
              <a
                href="#quote-reviews"
                className="inline-flex flex-wrap items-center justify-center gap-1.5 text-sm text-white/90 underline-offset-4 hover:underline"
              >
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                <span>
                  <span className="font-semibold">500+</span> parties served — read reviews from real hosts
                </span>
              </a>
            </div>
            <p className="mt-3 text-xs italic text-white/70">Fire up your story.</p>
          </div>
        </section>

        {/* One-row film strip: drifts back and forth on its own, pauses the
            moment the visitor touches it, and stays hand-swipeable. Videos
            still lazy-load only once their card scrolls into view. */}
        <div
          ref={mediaStripRef}
          className="mb-10 flex gap-3 overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {QUOTE_PROOF_MEDIA.map((media) => (
            <div key={media.src} className="relative h-44 w-64 shrink-0 overflow-hidden rounded-xl sm:h-52 sm:w-80">
              {media.type === "video" ? (
                <LazyVideo
                  className="absolute inset-0 h-full w-full object-cover"
                  poster={media.poster}
                  src={media.src}
                />
              ) : (
                <Image
                  src={media.src}
                  alt={media.alt}
                  fill
                  sizes="320px"
                  className="object-cover"
                />
              )}
            </div>
          ))}
        </div>

        <div id="quote-builder" className="grid scroll-mt-24 gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Event Inputs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <label htmlFor="quote-event-date" className="block text-sm font-medium mb-2">Event Date *</label>
                {/* Both lost ad sessions in the 9/1 Clarity tapes died right here:
                    taps on the label or the padding around the native date box did
                    nothing (dead clicks), so the label is now bound to the input and
                    any focus/click pops the native picker — a rough thumb anywhere
                    on the row still opens the calendar. */}
                <Input
                  id="quote-event-date"
                  type="date"
                  data-quote-field="date"
                  value={input.eventDate}
                  onChange={(e) => handleFieldChange("eventDate", e.target.value)}
                  onClick={openNativeDatePicker}
                  onFocus={openNativeDatePicker}
                />
              </div>

              <div>
                <label htmlFor="quote-event-time" className="block text-sm font-medium mb-2">Event Time *</label>
                <select
                  id="quote-event-time"
                  value={eventTime}
                  data-quote-field="time"
                  onChange={(e) => setEventTime(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Select event time</option>
                  {EVENT_TIME_OPTIONS.map((timeValue) => (
                    <option key={timeValue} value={timeValue}>
                      {timeValue}
                    </option>
                  ))}
                </select>
                {slotsLeft !== null && input.eventDate && (
                  <p className="mt-1.5 text-xs font-medium text-red-700">
                    {slotsLeft} booking {slotsLeft === 1 ? "slot" : "slots"} left on this date
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="quote-location" className="block text-sm font-medium mb-2">City or ZIP *</label>
                <Input
                  id="quote-location"
                  type="text"
                  data-quote-field="location"
                  value={input.location}
                  placeholder="Los Angeles or 90001"
                  onChange={(e) => handleFieldChange("location", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="quote-adults" className="block text-sm font-medium mb-2">Adults *</label>
                  <Input
                    id="quote-adults"
                    type="number"
                    min={1}
                    data-quote-field="adults"
                    value={input.adults}
                    onChange={(e) => handleFieldChange("adults", Number(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label htmlFor="quote-kids" className="block text-sm font-medium mb-2">Kids</label>
                  <Input
                    id="quote-kids"
                    type="number"
                    min={0}
                    value={input.kids}
                    onChange={(e) => handleFieldChange("kids", Number(e.target.value) || 0)}
                  />
                </div>
              </div>

              {/* Default is Standard with no plan UI at all. The Weekday
                  Special card only renders once the party qualifies, and the
                  customer taps it themselves — never auto-selected. */}
              {weekdayEligible || isWeekdaySaverTier ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Pricing Plan</label>
                  <button
                    type="button"
                    onClick={handleWeekdaySaverToggle}
                    aria-pressed={isWeekdaySaverTier}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      isWeekdaySaverTier
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-emerald-400 bg-white hover:border-emerald-500 hover:bg-emerald-50/50"
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-900">
                      {weekdaySaverPolicy.title}
                      {isWeekdaySaverTier ? (
                        <span className="ml-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                          Selected
                        </span>
                      ) : (
                        <span className="ml-2 text-xs font-semibold text-emerald-700">
                          — you qualify{weekdaySavings > 0 ? `, save $${weekdaySavings}` : ""}
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-gray-600">{weekdaySaverPolicy.quoteDescription}</p>
                    <p className="mt-1 text-xs font-medium text-emerald-700">
                      {isWeekdaySaverTier
                        ? "Tap again to switch back to the Standard Plan."
                        : hasPremiumUpgrades
                          ? "Tap to apply — premium upgrades will be removed (not part of this menu)."
                          : "Tap to apply — no code needed."}
                    </p>
                  </button>
                </div>
              ) : (
                <>
                  {weekdayHint && <p className="text-xs text-amber-700">{weekdayHint}</p>}
                  {!weekdaySaverEnabled && (
                    <p className="text-xs text-slate-600">
                      Current region: <span className="font-medium">{activeRegionDefinition.label}</span>.
                    </p>
                  )}
                </>
              )}

              {isWeekdaySaverTier && (
                <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
                  <p className="text-sm font-medium text-emerald-900">Weekday Special protein menu</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {WEEKDAY_SAVER_MENU_PROTEINS.map((protein) => (
                      <div key={protein} className="flex items-center gap-2 rounded-md border border-emerald-100 bg-white/70 px-3 py-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                        <span className="text-sm text-gray-800">{protein}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-emerald-800">
                    Guests pick 2 of 3 proteins at the event. Fried rice, vegetables, salad, and the live chef show are
                    included.
                  </p>
                </div>
              )}

              {/* Loyalty discounts are intentionally NOT shown here: returning
                  customers mention it themselves and staff apply it on the
                  invoice. Advertising deals a first-timer can't have only
                  breeds "why is my price worse". */}

              <div className="space-y-3">
                <label className="text-sm font-medium">Tableware Rental</label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="tableware-rental"
                    checked={input.tablewareRental}
                    onCheckedChange={(checked) => handleFieldChange("tablewareRental", Boolean(checked))}
                  />
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="tableware-rental" className="text-sm text-gray-700">
                      Include tableware rental
                    </label>
                    <TooltipProvider>
                      <Tooltip open={tablewareTooltipOpen} onOpenChange={setTablewareTooltipOpen}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label="Tableware rental details"
                            aria-expanded={tablewareTooltipOpen}
                            onClick={() => setTablewareTooltipOpen((prev) => !prev)}
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-gray-500 ring-offset-background transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          >
                            <CircleHelp className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Includes: table, chairs, tableware, table cloth · $15 per person</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">Premium Upgrade Options (optional)</p>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="add-on-steak"
                      checked={input.addOns.steak}
                      onCheckedChange={(checked) => handleAddOnToggle("steak", Boolean(checked))}
                    />
                    <label htmlFor="add-on-steak" className="text-sm">
                      Filet Mignon (+$8)
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="add-on-shrimp"
                      checked={input.addOns.shrimp}
                      onCheckedChange={(checked) => handleAddOnToggle("shrimp", Boolean(checked))}
                    />
                    <label htmlFor="add-on-shrimp" className="text-sm">
                      Scallops (+$6)
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="add-on-lobster"
                      checked={input.addOns.lobster}
                      onCheckedChange={(checked) => handleAddOnToggle("lobster", Boolean(checked))}
                    />
                    <label htmlFor="add-on-lobster" className="text-sm">
                      Lobster Tail (+$12)
                    </label>
                  </div>
                </div>
                {isWeekdaySaverTier ? (
                  <p className="text-xs text-amber-700">
                    Premium upgrades are Standard Plan only — picking one switches this quote to Standard pricing (
                    {standardRatesLabel}).
                  </p>
                ) : (
                  <p className="text-xs text-gray-500">
                    Upgrades are priced per guest who chooses them and shown separately from the base estimate.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Instant Estimate</CardTitle>
              <CardDescription>
                Food, live chef show, and travel — all in one estimate.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 p-4">
                {/* Per-guest price leads; the big all-in total made people bolt
                    before reading what it includes (watched it happen on session
                    recordings). The total shows as an estimate range with the
                    exact quote positioned as the thing we text back. */}
                <p className="text-sm font-medium text-amber-800">
                  {isWeekdaySaverTier ? weekdaySaverPolicy.title : "Standard Plan"}
                </p>
                <p className="text-3xl font-bold text-orange-800">
                  ${(isWeekdaySaverTier ? GUEST_TIERS.adult.weekdayPrice : GUEST_TIERS.adult.price).toFixed(2)}
                  <span className="text-lg font-semibold">/adult</span>
                  <span className="ml-2 text-lg font-semibold text-amber-700">
                    ${(isWeekdaySaverTier ? GUEST_TIERS.child.weekdayPrice : GUEST_TIERS.child.price).toFixed(2)}/child
                  </span>
                </p>
                {isWeekdaySaverTier && weekdaySavings > 0 && (
                  <p className="mt-1 text-sm font-semibold text-emerald-700">
                    Weekday Special selected — you save ${weekdaySavings} vs the Standard Plan.
                  </p>
                )}
                {!isWeekdaySaverTier && weekdayEligible && weekdaySavings > 0 && (
                  <p className="mt-1 text-sm font-semibold text-emerald-700">
                    You qualify for {weekdaySaverPolicy.title} — save ${weekdaySavings}.{" "}
                    <button
                      type="button"
                      onClick={handleWeekdaySaverToggle}
                      className="underline underline-offset-2 hover:text-emerald-800"
                    >
                      Apply it
                    </button>
                  </p>
                )}
                <p className="mt-2 text-base font-semibold text-amber-900">
                  {(() => {
                    const low = result.effectiveBase + result.travelFeeRange.low - result.loyaltyDiscount
                    const high =
                      result.effectiveBase
                      + result.travelFeeRange.high
                      + (isWeekdaySaverTier ? 0 : result.addOnTotalRange.high)
                      - result.loyaltyDiscount
                    const guests = result.guestCount > 0 ? ` for ${result.guestCount} guests` : ""
                    return low === high
                      ? `Estimated total${guests}: ~$${low.toFixed(0)}`
                      : `Estimated total${guests}: $${low.toFixed(0)} - $${high.toFixed(0)}`
                  })()}
                </p>
                {result.guestCount >= 20 && (
                  <p className="mt-1 inline-flex items-start gap-1.5 text-sm font-semibold text-emerald-700">
                    <Gift className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    Free appetizer platter included — gyoza, edamame &amp; spring rolls ($40 value, parties of 20+)
                  </p>
                )}
                {weekdayHint && <p className="mt-1 text-xs text-amber-800">{weekdayHint}</p>}
                <p className="text-xs text-amber-800">
                  Food, live chef show, and travel included. Exact quote and date availability confirmed by text.
                </p>
                <p className="text-xs text-amber-700/90">
                  Gratuity isn&apos;t included — 20-25% for your chef is customary. No other fees.
                </p>
                <Button
                  onClick={onSmsClick}
                  className="mt-3 h-auto min-h-12 w-full rounded-full bg-[hsl(24_79%_55%)] text-white hover:bg-[hsl(24_79%_48%)] text-sm whitespace-normal py-3 px-4"
                >
                  <MessageSquare className="mr-2 h-4 w-4 shrink-0" />
                  <span className="leading-tight text-center">
                    <span className="block font-semibold">Text us this quote</span>
                    <span className="block text-xs font-normal opacity-90">Exact price + date check — no forms, details pre-filled</span>
                  </span>
                </Button>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-amber-800">
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                    Full deposit refund up to 72h
                  </span>
                  <span>500+ parties served</span>
                </div>
                <p className="mt-1.5 inline-flex items-start gap-1 text-xs font-medium text-amber-900">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-700" aria-hidden="true" />
                  Southern California is all we do — a local team, not a franchise. Quality guaranteed.
                </p>
                <div className="mt-2 space-y-1 rounded-md bg-white/50 px-3 py-2 text-xs text-amber-900">
                  <p className="font-semibold">Our three promises, in writing:</p>
                  <p className="flex items-start gap-1.5">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                    <span>Chef confirmed by name 48h before your event — if we ever cancel, double your deposit back.</span>
                  </p>
                  <p className="flex items-start gap-1.5">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                    <span>Tarp under the grill, full cleanup before we leave — your patio stays spotless.</span>
                  </p>
                  <p className="flex items-start gap-1.5">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                    <span>Free fried rice &amp; vegetable refills — nobody leaves hungry.</span>
                  </p>
                </div>
              </div>

              {/* Contact details live here, not at the top of the form. On mobile the
                  two cards stack, and having these 1,300px above the submit button was
                  why phone users could see a price but never send a request. */}
              <div className="rounded-lg border border-gray-200 p-4 space-y-4">
                <p className="text-sm font-medium text-gray-900">Ready to book? Add your details for Book Now.</p>
                <p className="text-xs text-gray-500">
                  In a hurry? Skip this — the SMS and WhatsApp buttons below send us your quote with no forms.
                </p>
                <div>
                  <label className="block text-sm font-medium mb-2">Customer Name *</label>
                  <Input
                    type="text"
                    data-quote-field="name"
                    value={customerName}
                    placeholder="Your full name"
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium mb-2">Email *</label>
                    <Input
                      type="email"
                      data-quote-field="email"
                      value={customerEmail}
                      placeholder="you@example.com"
                      onChange={(e) => setCustomerEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Phone *</label>
                    <Input
                      type="tel"
                      data-quote-field="phone"
                      value={customerPhone}
                      placeholder="(213) 555-1234"
                      onChange={(e) => setCustomerPhone(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium mb-2">How did you hear about us? *</label>
                    <select
                      value={hearAboutUs}
                      data-quote-field="hear-about-us"
                      onChange={(e) => setHearAboutUs(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="">Choose one</option>
                      {HEAR_ABOUT_US_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Referral or partner code</label>
                    <Input
                      type="text"
                      data-quote-field="referral-code"
                      value={referralCode}
                      placeholder="e.g. RH-MARIA50"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    />
                    {trimmedReferralCode ? (
                      <p className="mt-1 text-xs font-medium text-emerald-700">
                        Code {trimmedReferralCode} noted — your discount is applied on the final invoice.
                      </p>
                    ) : null}
                  </div>
                </div>
                <label className="mt-3 flex items-start gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={smsConsent}
                    onChange={(e) => setSmsConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <span>
                    I agree to receive text messages from Real Hibachi about my quote and booking.
                    Consent is not a condition of purchase.
                  </span>
                </label>
                <p className="mt-2 text-xs leading-relaxed text-gray-500">
                  Message frequency varies; message and data rates may apply. Reply STOP to opt out
                  or HELP for help. See our{" "}
                  <a href="/privacy-policy" className="underline">Privacy Policy</a> and{" "}
                  <a href="/terms" className="underline">Terms of Service</a>.
                </p>
              </div>

              {shouldShowWeatherCard && weatherPreview && (
                <div className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 via-blue-50/70 to-indigo-100/70">
                  <button
                    type="button"
                    onClick={() => setWeatherExpanded((previous) => !previous)}
                    aria-expanded={weatherExpanded}
                    className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                  >
                    <p className="text-sm text-sky-900">
                      <span className="font-semibold">Weather</span>
                      <span className="text-sky-700">
                        {" "}· {weatherPreview.temperatureF}°F, {weatherPreview.willRain ? "rain possible" : "clear skies"} at {weatherPreview.eventTimeLabel}
                      </span>
                    </p>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-sky-700 transition-transform ${weatherExpanded ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    />
                  </button>
                  {weatherExpanded && (
                    <div className="grid gap-3 px-4 pb-4 sm:grid-cols-3">
                      <div className="rounded-lg border border-sky-100 bg-white/85 p-3">
                        <Sunset className="h-4 w-4 text-orange-500" />
                        <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-sky-700">Sunset</p>
                        <p className="text-base font-semibold text-sky-950">{weatherPreview.sunsetTime}</p>
                      </div>
                      <div className="rounded-lg border border-sky-100 bg-white/85 p-3">
                        {weatherPreview.willRain ? (
                          <CloudRain className="h-4 w-4 text-blue-600" />
                        ) : (
                          <CloudSun className="h-4 w-4 text-amber-500" />
                        )}
                        <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-sky-700">Rain</p>
                        <p className="text-base font-semibold text-sky-950">
                          {weatherPreview.willRain ? "Possible" : "Low chance"}
                        </p>
                        <p className="text-xs text-sky-700">{weatherPreview.rainChance}% chance at event time</p>
                      </div>
                      <div className="rounded-lg border border-sky-100 bg-white/85 p-3">
                        <ThermometerSun className="h-4 w-4 text-rose-500" />
                        <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-sky-700">Temp (at time)</p>
                        <p className="text-base font-semibold text-sky-950">{weatherPreview.temperatureF}°F</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2 text-sm text-gray-700">
                <p>
                  {isWeekdaySaverTier
                    ? `${weekdaySaverPolicy.title} · ${weekdayRatesLabel}`
                    : `Standard Plan · ${standardRatesLabel}`}
                  {result.guestCount > 0 ? ` · ${result.guestCount} guests` : ""}
                </p>
                <p>Each guest picks 2 proteins. Fried rice, vegetables, salad, and the live chef show are included.</p>
                {result.effectiveBase > result.baseSubtotal && (
                  <p>Smaller parties: our ${MINIMUM_SPEND} event minimum applies.</p>
                )}
                <p>
                  Travel:{" "}
                  {result.travelFeeRange.high <= 0
                    ? "included for your area"
                    : result.travelFeeRange.low === result.travelFeeRange.high
                      ? `$${result.travelFeeRange.high.toFixed(0)} (confirmed before booking)`
                      : `$${result.travelFeeRange.low.toFixed(0)} - $${result.travelFeeRange.high.toFixed(0)} (confirmed before booking)`}
                </p>
                {input.tablewareRental && (
                  <p>Full setup (tables, chairs, tableware): ${result.tablewareFee.toFixed(0)}</p>
                )}
                {result.loyaltyDiscount > 0 && (
                  <p className="font-medium text-emerald-700">
                    {input.loyaltyStatus === "party_guest" ? "Party guest card" : "Returning customer discount"}: −$
                    {result.loyaltyDiscount.toFixed(0)}
                  </p>
                )}
                {isWeekdaySaverTier ? (
                  <p>Weekday Special menu: {WEEKDAY_SAVER_MENU_DETAIL}</p>
                ) : (
                  selectedPremiumUpgrades.length > 0 && (
                    <p>
                      Premium upgrades ({selectedPremiumUpgradesText}): up to ${result.addOnTotalRange.high.toFixed(0)} extra
                    </p>
                  )
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Button
                  onClick={onSmsClick}
                  className="h-auto min-h-12 min-w-0 rounded-full bg-[hsl(24_79%_55%)] text-white hover:bg-[hsl(24_79%_48%)] text-sm whitespace-normal text-center leading-tight py-3 px-4"
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  <span className="leading-tight">
                    <span className="block font-medium">SMS</span>
                    <span className="block">{smsPhoneDisplay}</span>
                  </span>
                </Button>
                <Button
                  onClick={onCallClick}
                  className="h-auto min-h-12 min-w-0 rounded-full border-2 border-[hsl(24_79%_55%)] bg-white text-[hsl(24_79%_55%)] hover:bg-[hsl(24_79%_96%)] text-sm whitespace-normal text-center leading-tight py-3 px-4"
                >
                  <Phone className="mr-2 h-4 w-4" />
                  <span className="leading-tight">
                    <span className="block font-medium">Call</span>
                    <span className="block">{voicePhoneDisplay}</span>
                  </span>
                </Button>
                <Button
                  onClick={onWhatsAppClick}
                  className="h-auto min-h-12 min-w-0 rounded-full border-2 border-[#25D366] bg-white text-[#128C4B] hover:bg-[#f0fdf4] text-sm whitespace-normal text-center leading-tight py-3 px-4"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  <span className="leading-tight">
                    <span className="block font-medium">WhatsApp</span>
                    <span className="block">Send this quote</span>
                  </span>
                </Button>
                <Button
                  onClick={onEmailClick}
                  className="h-auto min-h-12 min-w-0 rounded-full border-2 border-[hsl(24_79%_55%)] bg-white text-[hsl(24_79%_55%)] hover:bg-[hsl(24_79%_96%)] text-sm whitespace-normal text-center leading-tight py-3 px-4"
                >
                  <Mail className="mr-2 h-4 w-4" />
                  <span className="leading-tight">
                    <span className="block font-medium">Email</span>
                    <span className="block break-all">{displayEmail}</span>
                  </span>
                </Button>
              </div>
              <Button
                onClick={onBookOnlineClick}
                disabled={bookingRequestSubmitting}
                className="h-12 w-full rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-500 disabled:text-white text-sm text-center"
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                <span className="font-medium">{bookingRequestSubmitting ? "Submitting..." : "Book Now — We Confirm Within Hours"}</span>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div id="quote-reviews" className="mt-12 scroll-mt-24">
          <h2 className="text-center text-2xl font-bold">What Our Guests Say</h2>
          <div className="mt-1.5 flex items-center justify-center gap-1 text-sm text-gray-600">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star key={star} className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
            ))}
            <span className="ml-1">5-star Google reviews from SoCal parties</span>
          </div>
          <div className="mt-6 columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4">
            {QUOTE_TESTIMONIALS.map((testimonial) => (
              <div key={testimonial.name} className="break-inside-avoid rounded-xl border border-amber-100 bg-white/90 p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-r ${testimonial.color} text-base font-bold text-white`}>
                    {testimonial.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900">{testimonial.name}</p>
                    <p className="text-xs text-gray-500">Google review</p>
                  </div>
                </div>
                <div className="mt-2 flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                  ))}
                </div>
                <p className="mt-2 text-sm leading-6 text-gray-700">{testimonial.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
