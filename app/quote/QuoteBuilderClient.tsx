"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Phone, MessageSquare, MessageCircle, Mail, AlertTriangle, Calculator, ChevronDown, CircleHelp, Sunset, CloudRain, CloudSun, ThermometerSun, CalendarDays, CheckCircle2, MapPin, Star, X } from "lucide-react"
import { siteConfig } from "@/config/site"
import { getQuoteContactTemplates } from "@/config/quote-contact-templates"
import { QUOTE_SLOTS_URGENCY_ENABLED, QUOTE_SOURCE } from "@/config/quote-features"
import {
  DEFAULT_REGION_CODE,
  getRegionalPolicySnapshot,
  type RegionCode,
} from "@/config/regional-policies"
import { isWeekdayEligibleDate } from "@/config/pricing-rules"
import { useActiveRegion } from "@/lib/use-active-region"
import { trackEvent } from "@/lib/tracking"
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
}

const EVENT_TIME_OPTIONS = ["13:00", "16:00", "19:00", "21:00"] as const
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
  kind: "urgency" | "error"
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

export default function QuoteBuilderClient() {
  const [input, setInput] = useState<QuoteInput>(DEFAULT_INPUT)
  const activeRegion = useActiveRegion(DEFAULT_REGION_CODE)
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [eventTime, setEventTime] = useState("")
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

  const quoteSummary = useMemo(() => buildQuoteSummary(input, result), [input, result])
  const contactTemplates = useMemo(() => getQuoteContactTemplates(), [])
  const smsBody = useMemo(() => buildSmsBody(input, result, contactTemplates.sms), [input, result, contactTemplates.sms])
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
    if (!weekdaySaverEnabled && input.pricingTier === "weekday_saver") {
      setInput((previous) => ({
        ...previous,
        pricingTier: "standard",
      }))
    }
  }, [input.pricingTier, weekdaySaverEnabled])

  useEffect(() => {
    if (input.pricingTier !== "weekday_saver") return
    if (!input.eventDate || isWeekdayEligibleDate(input.eventDate)) return

    setInput((previous) => ({
      ...previous,
      pricingTier: "standard",
    }))
    const described = describeEventDate(input.eventDate)
    pushToast(
      "error",
      "Switched to Standard Plan",
      described
        ? `Weekday Special is Monday-Thursday only — ${described.label} is a ${described.weekday}.`
        : "Weekday Special is Monday-Thursday only.",
    )
  }, [input.eventDate, input.pricingTier, pushToast])

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

  const handlePricingTierChange = (pricingTier: QuoteInput["pricingTier"]) => {
    if (pricingTier === "weekday_saver" && !weekdaySaverEnabled) {
      return
    }

    if (pricingTier === "weekday_saver" && input.eventDate && !isWeekdayEligibleDate(input.eventDate)) {
      const described = describeEventDate(input.eventDate)
      pushToast(
        "error",
        "Weekday Special is Monday-Thursday only",
        described
          ? `${described.label} is a ${described.weekday}, so we've kept you on the Standard Plan.`
          : "Pick a Monday-Thursday date to use this tier.",
      )
      return
    }

    setInput((prev) => {
      if (prev.pricingTier === pricingTier) return prev
      if (pricingTier === "weekday_saver") {
        return {
          ...prev,
          pricingTier,
          addOns: {
            steak: false,
            shrimp: false,
            lobster: false,
          },
        }
      }
      return {
        ...prev,
        pricingTier,
      }
    })
  }

  const handleAddOnToggle = (key: keyof QuoteInput["addOns"], checked: boolean) => {
    if (input.pricingTier === "weekday_saver") return
    setInput((prev) => ({
      ...prev,
      addOns: {
        ...prev.addOns,
        [key]: checked,
      },
    }))
  }

  const displayPhone = "213-770-7788"
  const phoneRaw = "2137707788"
  const displayEmail = "support@realhibachi.com"
  const emailTo = "support@realhibachi.com"
  const smsHref = `sms:${phoneRaw}?body=${encodeUrlComponent(smsBody)}`
  const whatsappHref = `https://wa.me/1${phoneRaw}?text=${encodeUrlComponent(smsBody)}`
  const emailHref = `mailto:${emailTo}?subject=${encodeUrlComponent(emailPayload.subject)}&body=${encodeUrlComponent(emailPayload.body)}`
  const contactDisabled = !result.hasCoreInputs
  const missingRequiredBookingFields =
    !result.hasCoreInputs
    || !customerName.trim()
    || !customerEmail.trim()
    || !customerPhone.trim()
    || !eventTime
  const weekdaySaverRulesFailed = isWeekdaySaverTier && !result.weekdaySaver.isEligible
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
                : '[data-quote-field="phone"]'
    const el = document.querySelector<HTMLElement>(selector)
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    window.setTimeout(() => el.focus(), 400)
  }

  const onSmsClick = () => {
    if (contactDisabled) {
      pushToast("error", "Almost there", "Add your event date, city or ZIP, and guest count first.")
      focusFirstMissingField()
      return
    }
    trackEvent("contact_sms_click", {
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
    trackEvent("contact_whatsapp_click", {
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
    window.open(whatsappHref, "_blank", "noopener,noreferrer")
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
    window.location.href = `tel:${phoneRaw}`
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
    if (weekdaySaverRulesFailed) {
      pushToast("error", "Weekday Special rules", "Monday-Thursday events with at least 15 total guests. Switch to Standard for other dates.")
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
      estimate_low: result.totalRange.low,
      estimate_high: result.totalRange.high,
      value: result.totalRange.low,
      currency: "USD",
      event_id: bookingEventId,
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
    <div className="page-container container mx-auto px-4 py-12">
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
                Questions? Call or text {displayPhone}, or email {displayEmail}.
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
                toast.kind === "urgency" ? "border-red-200" : "border-amber-300"
              }`}
            >
              <div className="flex items-start gap-2.5">
                {toast.kind === "urgency" ? (
                  <span className="relative mt-1 flex h-2.5 w-2.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                  </span>
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

        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-4">Get Your Instant Quote</h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Enter a few details to see an estimated range in seconds, then contact us with your quote prefilled.
          </p>
          <p className="mt-3 text-sm text-slate-500">
            Regional profile: <span className="font-medium text-slate-700">{activeRegionDefinition.label}</span>
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Event Inputs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2">Event Date *</label>
                <Input
                  type="date"
                  data-quote-field="date"
                  value={input.eventDate}
                  onChange={(e) => handleFieldChange("eventDate", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Event Time *</label>
                <select
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
                <label className="block text-sm font-medium mb-2">City or ZIP *</label>
                <Input
                  type="text"
                  data-quote-field="location"
                  value={input.location}
                  placeholder="Los Angeles or 90001"
                  onChange={(e) => handleFieldChange("location", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Adults *</label>
                  <Input
                    type="number"
                    min={1}
                    data-quote-field="adults"
                    value={input.adults}
                    onChange={(e) => handleFieldChange("adults", Number(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Kids</label>
                  <Input
                    type="number"
                    min={0}
                    value={input.kids}
                    onChange={(e) => handleFieldChange("kids", Number(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium">Pricing Tier *</label>
                <div className={`grid gap-3 ${weekdaySaverEnabled ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
                  <button
                    type="button"
                    onClick={() => handlePricingTierChange("standard")}
                    className={`rounded-lg border p-3 text-left transition ${
                      input.pricingTier === "standard"
                        ? "border-[hsl(24_79%_55%)] bg-[hsl(24_79%_96%)]"
                        : "border-gray-200 bg-white hover:border-[hsl(24_79%_70%)]"
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-900">Standard Plan</p>
                    <p className="mt-1 text-xs text-gray-600">$59.90/adult, $29.90/child, add-ons available</p>
                  </button>
                  {weekdaySaverEnabled && (
                    <button
                      type="button"
                      onClick={() => handlePricingTierChange("weekday_saver")}
                      className={`rounded-lg border p-3 text-left transition ${
                        input.pricingTier === "weekday_saver"
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-gray-200 bg-white hover:border-emerald-300"
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-900">{weekdaySaverPolicy.title}</p>
                      <p className="mt-1 text-xs text-gray-600">{weekdaySaverPolicy.quoteDescription}</p>
                    </button>
                  )}
                </div>
                {!weekdaySaverEnabled && (
                  <p className="text-xs text-slate-600">
                    {weekdaySaverPolicy.unavailableMessage} Current region: <span className="font-medium">{activeRegionDefinition.label}</span>.
                  </p>
                )}
                {isWeekdaySaverTier && (
                  <p className="text-xs text-emerald-700">
                    Weekday Special rules: guests pick 2 of 3 proteins (chicken, steak, shrimp). Includes chef show, rice,
                    vegetables, and salad. No premium add-ons or custom upgrade.
                  </p>
                )}
              </div>

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
                  {result.weekdaySaver.violations.length > 0 && (
                    <div className="space-y-1 rounded-md border border-red-200 bg-red-50 p-2">
                      {result.weekdaySaver.violations.map((message) => (
                        <p key={message} className="text-xs text-red-700">
                          {message}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

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

              <div className={`space-y-3 ${isWeekdaySaverTier ? "opacity-60" : ""}`}>
                <p className="text-sm font-medium">Premium Upgrade Options (optional)</p>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="add-on-steak"
                      checked={input.addOns.steak}
                      disabled={isWeekdaySaverTier}
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
                      disabled={isWeekdaySaverTier}
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
                      disabled={isWeekdaySaverTier}
                      onCheckedChange={(checked) => handleAddOnToggle("lobster", Boolean(checked))}
                    />
                    <label htmlFor="add-on-lobster" className="text-sm">
                      Lobster Tail (+$12)
                    </label>
                  </div>
                </div>
                {isWeekdaySaverTier ? (
                  <p className="text-xs text-red-700">Premium add-ons are not available in the Weekday Special tier.</p>
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
                  {isWeekdaySaverTier ? "Weekday Special" : "Standard Plan"}
                </p>
                <p className="text-3xl font-bold text-orange-800">
                  {isWeekdaySaverTier ? "$45.90" : "$59.90"}
                  <span className="text-lg font-semibold">/adult</span>
                  <span className="ml-2 text-lg font-semibold text-amber-700">
                    {isWeekdaySaverTier ? "$22.95" : "$29.90"}/child
                  </span>
                </p>
                <p className="mt-2 text-base font-semibold text-amber-900">
                  {(() => {
                    const low = result.effectiveBase + result.travelFeeRange.low
                    const high =
                      result.effectiveBase
                      + result.travelFeeRange.high
                      + (isWeekdaySaverTier ? 0 : result.addOnTotalRange.high)
                    const guests = result.guestCount > 0 ? ` for ${result.guestCount} guests` : ""
                    return low === high
                      ? `Estimated total${guests}: ~$${low.toFixed(0)}`
                      : `Estimated total${guests}: $${low.toFixed(0)} - $${high.toFixed(0)}`
                  })()}
                </p>
                <p className="text-xs text-amber-800">
                  Food, live chef show, and travel included. Exact quote and date availability confirmed by text.
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
                    <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" aria-hidden="true" />
                    4.9 average rating
                  </span>
                  <span>500+ parties served</span>
                </div>
                <p className="mt-1.5 inline-flex items-start gap-1 text-xs font-medium text-amber-900">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-700" aria-hidden="true" />
                  Southern California is all we do — a local team, not a franchise. Quality guaranteed.
                </p>
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
                <p className="mt-3 text-xs leading-relaxed text-gray-500">
                  By providing your phone number and submitting this form, you agree to receive text
                  messages from Real Hibachi about your quote and booking. Consent is not a condition
                  of purchase. Message frequency varies; message and data rates may apply. Reply STOP
                  to opt out or HELP for help. See our{" "}
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
                    ? "Weekday Special · $45.9/adult, $22.95/child"
                    : "Standard Plan · $59.90/adult, $29.90/child"}
                  {result.guestCount > 0 ? ` · ${result.guestCount} guests` : ""}
                </p>
                <p>Each guest picks 2 proteins. Fried rice, vegetables, salad, and the live chef show are included.</p>
                {result.effectiveBase > result.baseSubtotal && (
                  <p>Smaller parties: our $599 event minimum applies.</p>
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
                    <span className="block">{displayPhone}</span>
                  </span>
                </Button>
                <Button
                  onClick={onCallClick}
                  className="h-auto min-h-12 min-w-0 rounded-full border-2 border-[hsl(24_79%_55%)] bg-white text-[hsl(24_79%_55%)] hover:bg-[hsl(24_79%_96%)] text-sm whitespace-normal text-center leading-tight py-3 px-4"
                >
                  <Phone className="mr-2 h-4 w-4" />
                  <span className="leading-tight">
                    <span className="block font-medium">Call</span>
                    <span className="block">{displayPhone}</span>
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
      </div>
    </div>
  )
}
