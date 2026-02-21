"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Phone, MessageSquare, Mail, Calculator, CircleHelp, Sunset, CloudRain, CloudSun, ThermometerSun, CalendarDays } from "lucide-react"
import { siteConfig } from "@/config/site"
import { paymentConfig } from "@/config/ui"
import { getQuoteContactTemplates } from "@/config/quote-contact-templates"
import { trackEvent } from "@/lib/tracking"
import {
  buildCallScript,
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
  tablewareRental: false,
  tent10x10: false,
  budget: undefined,
  addOns: {
    steak: false,
    shrimp: false,
    lobster: false,
  },
}

const EVENT_TIME_OPTIONS = ["12:00", "14:00", "16:00", "19:00"] as const

function encodeUrlComponent(value: string): string {
  return encodeURIComponent(value)
}

type QuoteBuilderVariant = "A" | "B"

type QuoteBuilderClientProps = {
  variant?: QuoteBuilderVariant
}

type WeatherPreview = {
  eventTimeLabel: string
  sunsetTime: string
  rainChance: number
  willRain: boolean
  temperatureF: number
  source?: string
}

function calculateSlotsLeft(eventDate: string, location: string): number | null {
  const normalizedLocation = location.trim().toLowerCase()
  if (!eventDate || !normalizedLocation) {
    return null
  }

  const seed = `${eventDate}-${normalizedLocation}`
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0
  }

  return (Math.abs(hash) % 4) + 1
}

export default function QuoteBuilderClient({ variant = "A" }: QuoteBuilderClientProps) {
  const [input, setInput] = useState<QuoteInput>(DEFAULT_INPUT)
  const [customerName, setCustomerName] = useState("")
  const [eventTime, setEventTime] = useState("")
  const [tablewareTooltipOpen, setTablewareTooltipOpen] = useState(false)
  const [weatherPreview, setWeatherPreview] = useState<WeatherPreview | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [travelFeeRange, setTravelFeeRange] = useState<QuoteRange>({ low: 0, high: 0 })
  const [distanceMiles, setDistanceMiles] = useState<number | null>(null)
  const [quoteStartedTracked, setQuoteStartedTracked] = useState(false)
  const [quoteCompletedTracked, setQuoteCompletedTracked] = useState(false)
  const quoteSurface = variant === "B" ? "quote_builder_b" : "quote_builder_a"
  const slotsLeft = useMemo(() => calculateSlotsLeft(input.eventDate, input.location), [input.eventDate, input.location])
  const slotsNoun = slotsLeft === 1 ? "slot" : "slots"
  const depositAmount = paymentConfig.depositAmount || 100
  const shouldShowWeatherCard = Boolean(input.eventDate && input.location.trim())

  const result = useMemo(() => calculateQuote(input, travelFeeRange), [input, travelFeeRange])
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
  const callScript = useMemo(
    () => buildCallScript(input, result, contactTemplates.callScript),
    [input, result, contactTemplates.callScript],
  )

  useEffect(() => {
    const destination = input.location.trim()
    if (!destination) {
      setTravelFeeRange({ low: 0, high: 0 })
      setDistanceMiles(null)
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
        const miles = Number(data?.distance_miles)

        if (Number.isFinite(low) && Number.isFinite(high)) {
          setTravelFeeRange({ low, high })
        }
        if (Number.isFinite(miles)) {
          setDistanceMiles(miles)
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
    const selectedEventTime = eventTime || "18:00"

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
    if (!quoteStartedTracked && hasAnyInput) {
      trackEvent("quote_started", {
        quote_surface: quoteSurface,
        adults: input.adults,
        kids: input.kids,
        tableware_rental: input.tablewareRental,
        tent_10x10: input.tent10x10,
      })
      setQuoteStartedTracked(true)
    }
  }, [input, quoteStartedTracked, quoteSurface])

  useEffect(() => {
    if (!quoteCompletedTracked && result.hasCoreInputs) {
      trackEvent("quote_completed", {
        quote_surface: quoteSurface,
        city_or_zip: input.location || "unspecified",
        tableware_rental: input.tablewareRental,
        tent_10x10: input.tent10x10,
        add_on_steak: input.addOns.steak,
        add_on_shrimp: input.addOns.shrimp,
        add_on_lobster: input.addOns.lobster,
        guest_count: result.guestCount,
        estimate_low: result.totalRange.low,
        estimate_high: result.totalRange.high,
        budget_fit: result.budgetFit,
      })
      setQuoteCompletedTracked(true)
    }
  }, [input, result, quoteCompletedTracked, quoteSurface])

  useEffect(() => {
    trackEvent("ab_test_exposure", {
      experiment_id: "quote_route_split_v1",
      quote_variant: variant,
      quote_surface: quoteSurface,
    })
  }, [quoteSurface, variant])

  const handleFieldChange = (field: keyof QuoteInput, value: string | number | boolean | undefined) => {
    setInput((prev) => ({ ...prev, [field]: value }))
  }

  const handleAddOnToggle = (key: keyof QuoteInput["addOns"], checked: boolean) => {
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
  const displayEmail = "realhibachiathome@gmail.com"
  const emailTo = "realhibachiathome@gmail.com"
  const smsHref = `sms:${phoneRaw}?body=${encodeUrlComponent(smsBody)}`
  const emailHref = `mailto:${emailTo}?subject=${encodeUrlComponent(emailPayload.subject)}&body=${encodeUrlComponent(emailPayload.body)}`
  const contactDisabled = !result.hasCoreInputs
  const depositLockDisabled = !result.hasCoreInputs || !customerName.trim() || !eventTime

  const onSmsClick = () => {
    if (contactDisabled) return
    trackEvent("contact_sms_click", {
      contact_surface: quoteSurface,
      quote_summary: quoteSummary,
      city_or_zip: input.location || "unspecified",
      tableware_rental: input.tablewareRental,
      tent_10x10: input.tent10x10,
      add_on_steak: input.addOns.steak,
      add_on_shrimp: input.addOns.shrimp,
      add_on_lobster: input.addOns.lobster,
      customer_name: customerName || "unspecified",
      event_time: eventTime || "unspecified",
    })
    window.location.href = smsHref
  }

  const onCallClick = () => {
    if (contactDisabled) return
    trackEvent("contact_call_click", {
      contact_surface: quoteSurface,
      quote_summary: quoteSummary,
      city_or_zip: input.location || "unspecified",
      tableware_rental: input.tablewareRental,
      tent_10x10: input.tent10x10,
      add_on_steak: input.addOns.steak,
      add_on_shrimp: input.addOns.shrimp,
      add_on_lobster: input.addOns.lobster,
      customer_name: customerName || "unspecified",
      event_time: eventTime || "unspecified",
    })
    window.location.href = `tel:${phoneRaw}`
  }

  const onEmailClick = () => {
    if (contactDisabled) return
    trackEvent("contact_email_click", {
      contact_surface: quoteSurface,
      quote_summary: quoteSummary,
      city_or_zip: input.location || "unspecified",
      tableware_rental: input.tablewareRental,
      tent_10x10: input.tent10x10,
      add_on_steak: input.addOns.steak,
      add_on_shrimp: input.addOns.shrimp,
      add_on_lobster: input.addOns.lobster,
      customer_name: customerName || "unspecified",
      event_time: eventTime || "unspecified",
    })
    trackEvent("lead_submit", {
      lead_channel: "email",
      lead_source: quoteSurface,
      lead_type: "quote_contact",
      quote_summary: quoteSummary,
      estimate_low: result.totalRange.low,
      estimate_high: result.totalRange.high,
      customer_name: customerName || "unspecified",
      event_time: eventTime || "unspecified",
    })
    window.location.href = emailHref
  }

  const onDepositLockClick = () => {
    if (depositLockDisabled) return

    const bookingId = `QUOTE-${variant}-${Date.now()}`

    trackEvent("ab_test_conversion", {
      experiment_id: "quote_route_split_v1",
      quote_variant: variant,
      conversion_type: "deposit_lock_click",
      lead_source: quoteSurface,
      city_or_zip: input.location || "unspecified",
      event_date: input.eventDate || "unspecified",
      event_time: eventTime || "unspecified",
      tent_10x10: input.tent10x10,
      estimate_low: result.totalRange.low,
      estimate_high: result.totalRange.high,
    })

    const depositQuery = new URLSearchParams({
      id: bookingId,
      source: `quote${variant}`,
      customer_name: customerName.trim(),
      event_date: input.eventDate || "",
      event_time: eventTime,
      location: input.location || "",
      adults: String(input.adults || 0),
      kids: String(input.kids || 0),
      tent_10x10: input.tent10x10 ? "yes" : "no",
      estimate_low: String(result.totalRange.low),
      estimate_high: String(result.totalRange.high),
    })

    window.location.href = `/deposit?${depositQuery.toString()}`
  }

  const onBookOnlineClick = () => {
    if (depositLockDisabled) return

    const bookingId = `QUOTE-${variant}-${Date.now()}`

    trackEvent("ab_test_conversion", {
      experiment_id: "quote_route_split_v1",
      quote_variant: variant,
      conversion_type: "book_online_click",
      lead_source: quoteSurface,
      city_or_zip: input.location || "unspecified",
      event_date: input.eventDate || "unspecified",
      event_time: eventTime || "unspecified",
      tent_10x10: input.tent10x10,
      estimate_low: result.totalRange.low,
      estimate_high: result.totalRange.high,
    })

    const depositQuery = new URLSearchParams({
      id: bookingId,
      source: `quote${variant}`,
      customer_name: customerName.trim(),
      event_date: input.eventDate || "",
      event_time: eventTime,
      location: input.location || "",
      adults: String(input.adults || 0),
      kids: String(input.kids || 0),
      tent_10x10: input.tent10x10 ? "yes" : "no",
      estimate_low: String(result.totalRange.low),
      estimate_high: String(result.totalRange.high),
    })

    window.location.href = `/deposit?${depositQuery.toString()}`
  }

  return (
    <div className="page-container container mx-auto px-4 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <Badge variant="secondary" className="mb-4">
            {variant === "B" ? "Quote Variant B" : "Quote Variant A"}
          </Badge>
          <h1 className="text-4xl font-bold mb-4">Get Your Instant Quote</h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Enter a few details to see an estimated range in seconds, then contact us with your quote prefilled.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Event Inputs
              </CardTitle>
              <CardDescription>4+1 quick inputs. Most users finish this in under 30 seconds.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2">Customer Name *</label>
                <Input
                  type="text"
                  value={customerName}
                  placeholder="Your full name"
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Event Date *</label>
                <Input
                  type="date"
                  value={input.eventDate}
                  onChange={(e) => handleFieldChange("eventDate", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Event Time *</label>
                <select
                  value={eventTime}
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
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">City or ZIP *</label>
                <Input
                  type="text"
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
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="tent-10x10"
                    checked={input.tent10x10}
                    onCheckedChange={(checked) => handleFieldChange("tent10x10", Boolean(checked))}
                  />
                  <label htmlFor="tent-10x10" className="text-sm text-gray-700">
                    10&apos;x10&apos; tent (rainy day option)
                  </label>
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
                <p className="text-xs text-gray-500">
                  Quick estimate assumes selected premium upgrades could be chosen by up to all guests.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Instant Estimate Range</CardTitle>
              <CardDescription>
                Includes $599 minimum-spend logic, full-setup selection, and premium-upgrade impact.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 p-4">
                <p className="text-sm font-medium text-amber-800">Estimated Total</p>
                <p className="text-3xl font-bold text-orange-800">
                  ${result.totalRange.low.toFixed(0)} - ${result.totalRange.high.toFixed(0)}
                </p>
              </div>

              {variant === "B" && slotsLeft !== null && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                  <p className="font-semibold">
                    Only {slotsLeft} prime {slotsNoun} left for this date and time. Pay deposit to lock.
                  </p>
                  <Button
                    onClick={onDepositLockClick}
                    disabled={depositLockDisabled}
                    className="mt-3 h-9 rounded-full bg-[hsl(24_79%_55%)] px-4 text-white hover:bg-[hsl(24_79%_48%)]"
                  >
                    Pay Deposit to Lock
                  </Button>
                  {depositLockDisabled && (
                    <p className="mt-2 text-xs text-red-700">Fill customer name, date, time, and core quote details first.</p>
                  )}
                </div>
              )}

              {shouldShowWeatherCard && (
                <div className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 via-blue-50/70 to-indigo-100/70 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-sky-900">Weather Snapshot</p>
                    <Badge variant="outline" className="border-sky-300 bg-white/80 text-sky-700">
                      {weatherPreview ? `At ${weatherPreview.eventTimeLabel}` : "Event-time preview"}
                    </Badge>
                  </div>
                  {weatherPreview ? (
                    <div className="grid gap-3 sm:grid-cols-3">
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
                  ) : (
                    <div className="rounded-lg border border-sky-100 bg-white/85 p-3 text-xs text-sky-700">
                      {weatherLoading ? "Loading weather..." : "Enter a valid date and location to load weather."}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2 text-sm text-gray-700">
                <p>Guest count: {result.guestCount}</p>
                <p>Base subtotal: ${result.baseSubtotal.toFixed(0)}</p>
                <p>Minimum spend applied: ${result.minimumSpend.toFixed(0)}</p>
                <p>Effective base: ${result.effectiveBase.toFixed(0)}</p>
                <p>
                  Travel fee range: ${result.travelFeeRange.low.toFixed(0)} - ${result.travelFeeRange.high.toFixed(0)}
                </p>
                <p>Distance from 91748: {distanceMiles !== null ? `${distanceMiles.toFixed(1)} miles` : "calculating..."}</p>
                <p>Full setup (tables/chairs/utensils): ${result.tablewareFee.toFixed(0)}</p>
                <p>
                  Premium upgrades impact: ${result.addOnTotalRange.low.toFixed(0)} - ${result.addOnTotalRange.high.toFixed(0)}
                </p>
              </div>

              <div className="rounded-md border p-3 text-sm text-gray-700">
                <p className="font-medium mb-1">Suggested call script:</p>
                <p>{callScript}</p>
              </div>

              {!result.hasCoreInputs && (
                <p className="text-xs text-[hsl(24_79%_42%)] bg-[hsl(24_79%_96%)] border border-[hsl(24_79%_84%)] rounded-md p-2">
                  Add date, location, and guest count to enable one-click contact actions.
                </p>
              )}

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Button
                  onClick={onSmsClick}
                  disabled={contactDisabled}
                  className="h-auto min-h-12 min-w-0 rounded-full bg-[hsl(24_79%_55%)] text-white hover:bg-[hsl(24_79%_48%)] disabled:bg-[hsl(24_79%_80%)] disabled:text-white/90 text-sm whitespace-normal text-center leading-tight py-3 px-4"
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  <span className="leading-tight">
                    <span className="block font-medium">SMS</span>
                    <span className="block">{displayPhone}</span>
                  </span>
                </Button>
                <Button
                  onClick={onCallClick}
                  disabled={contactDisabled}
                  className="h-auto min-h-12 min-w-0 rounded-full border-2 border-[hsl(24_79%_55%)] bg-white text-[hsl(24_79%_55%)] hover:bg-[hsl(24_79%_96%)] disabled:border-[hsl(24_79%_78%)] disabled:text-[hsl(24_79%_70%)] text-sm whitespace-normal text-center leading-tight py-3 px-4"
                >
                  <Phone className="mr-2 h-4 w-4" />
                  <span className="leading-tight">
                    <span className="block font-medium">Call</span>
                    <span className="block">{displayPhone}</span>
                  </span>
                </Button>
                <Button
                  onClick={onEmailClick}
                  disabled={contactDisabled}
                  className="h-auto min-h-12 min-w-0 rounded-full border-2 border-[hsl(24_79%_55%)] bg-white text-[hsl(24_79%_55%)] hover:bg-[hsl(24_79%_96%)] disabled:border-[hsl(24_79%_78%)] disabled:text-[hsl(24_79%_70%)] text-sm whitespace-normal text-center leading-tight py-3 px-4"
                >
                  <Mail className="mr-2 h-4 w-4" />
                  <span className="leading-tight">
                    <span className="block font-medium">Email</span>
                    <span className="block break-all">{displayEmail}</span>
                  </span>
                </Button>
                <Button
                  onClick={onBookOnlineClick}
                  disabled={depositLockDisabled}
                  className="h-auto min-h-12 min-w-0 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-200 disabled:text-emerald-700 text-sm text-center py-3 px-4"
                >
                  <CalendarDays className="mr-2 h-4 w-4" />
                  <span className="font-medium">Book Online</span>
                </Button>
              </div>
              {depositLockDisabled && (
                <p className="text-xs text-gray-500">
                  Fill customer name, date, time, and location to enable Book Online deposit flow.
                </p>
              )}

            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
