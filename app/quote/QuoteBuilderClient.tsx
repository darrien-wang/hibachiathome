"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Phone, MessageSquare, Mail, Calculator } from "lucide-react"
import { siteConfig } from "@/config/site"
import { trackEvent } from "@/lib/tracking"
import {
  buildCallScript,
  buildEmailPayload,
  buildSmsBody,
  buildQuoteSummary,
  calculateQuote,
  type QuoteInput,
} from "@/lib/quote-builder"

const DEFAULT_INPUT: QuoteInput = {
  eventDate: "",
  location: "",
  adults: 10,
  kids: 0,
  tablewareRental: true,
  budget: undefined,
  addOns: {
    steak: false,
    shrimp: false,
    lobster: false,
  },
}

function encodeUrlComponent(value: string): string {
  return encodeURIComponent(value)
}

export default function QuoteBuilderClient() {
  const [input, setInput] = useState<QuoteInput>(DEFAULT_INPUT)
  const [quoteStartedTracked, setQuoteStartedTracked] = useState(false)
  const [quoteCompletedTracked, setQuoteCompletedTracked] = useState(false)

  const result = useMemo(() => calculateQuote(input), [input])
  const quoteSummary = useMemo(() => buildQuoteSummary(input, result), [input, result])
  const smsBody = useMemo(() => buildSmsBody(input, result), [input, result])
  const emailPayload = useMemo(() => buildEmailPayload(input, result), [input, result])
  const callScript = useMemo(() => buildCallScript(input, result), [input, result])

  useEffect(() => {
    const hasAnyInput = Boolean(input.eventDate || input.location || input.adults > 0 || input.kids > 0)
    if (!quoteStartedTracked && hasAnyInput) {
      trackEvent("quote_started", {
        quote_surface: "quote_builder",
        adults: input.adults,
        kids: input.kids,
        tableware_rental: input.tablewareRental,
      })
      setQuoteStartedTracked(true)
    }
  }, [input, quoteStartedTracked])

  useEffect(() => {
    if (!quoteCompletedTracked && result.hasCoreInputs) {
      trackEvent("quote_completed", {
        quote_surface: "quote_builder",
        city_or_zip: input.location || "unspecified",
        tableware_rental: input.tablewareRental,
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
  }, [input, result, quoteCompletedTracked])

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

  const phoneRaw = siteConfig.contact.phone.replace(/\D/g, "")
  const smsHref = `sms:${phoneRaw}?body=${encodeUrlComponent(smsBody)}`
  const emailHref = `mailto:${siteConfig.contact.email}?subject=${encodeUrlComponent(emailPayload.subject)}&body=${encodeUrlComponent(emailPayload.body)}`
  const contactDisabled = !result.hasCoreInputs

  const onSmsClick = () => {
    if (contactDisabled) return
    trackEvent("contact_sms_click", {
      contact_surface: "quote_builder",
      quote_summary: quoteSummary,
    })
    window.location.href = smsHref
  }

  const onCallClick = () => {
    if (contactDisabled) return
    trackEvent("contact_call_click", {
      contact_surface: "quote_builder",
      quote_summary: quoteSummary,
    })
    window.location.href = `tel:${phoneRaw}`
  }

  const onEmailClick = () => {
    if (contactDisabled) return
    trackEvent("lead_submit", {
      lead_channel: "email",
      lead_source: "quote_builder",
      lead_type: "quote_contact",
      quote_summary: quoteSummary,
      estimate_low: result.totalRange.low,
      estimate_high: result.totalRange.high,
    })
    window.location.href = emailHref
  }

  return (
    <div className="page-container container mx-auto px-4 py-12">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <Badge variant="secondary" className="mb-4">
            One-Page Quote Builder
          </Badge>
          <h1 className="text-4xl font-bold mb-4">Get Your Instant Quote</h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Enter a few details to see an estimated range in seconds, then contact us with your quote prefilled.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
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
                <label className="block text-sm font-medium mb-2">Event Date *</label>
                <Input
                  type="date"
                  value={input.eventDate}
                  onChange={(e) => handleFieldChange("eventDate", e.target.value)}
                />
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

              <div>
                <label className="block text-sm font-medium mb-2">Budget (Optional)</label>
                <Input
                  type="number"
                  min={0}
                  placeholder="e.g. 1500"
                  value={input.budget ?? ""}
                  onChange={(e) =>
                    handleFieldChange("budget", e.target.value ? Number(e.target.value) : undefined)
                  }
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium">Tableware Rental</label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="tableware-rental"
                    checked={input.tablewareRental}
                    onCheckedChange={(checked) => handleFieldChange("tablewareRental", Boolean(checked))}
                  />
                  <label htmlFor="tableware-rental" className="text-sm text-gray-700">
                    Include tableware rental (recommended)
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">Upgrade Options</p>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="add-on-steak"
                      checked={input.addOns.steak}
                      onCheckedChange={(checked) => handleAddOnToggle("steak", Boolean(checked))}
                    />
                    <label htmlFor="add-on-steak" className="text-sm">
                      Steak
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="add-on-shrimp"
                      checked={input.addOns.shrimp}
                      onCheckedChange={(checked) => handleAddOnToggle("shrimp", Boolean(checked))}
                    />
                    <label htmlFor="add-on-shrimp" className="text-sm">
                      Shrimp
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="add-on-lobster"
                      checked={input.addOns.lobster}
                      onCheckedChange={(checked) => handleAddOnToggle("lobster", Boolean(checked))}
                    />
                    <label htmlFor="add-on-lobster" className="text-sm">
                      Lobster
                    </label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Instant Estimate Range</CardTitle>
              <CardDescription>
                Includes minimum-spend logic, travel fee range, and selected upgrade options.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                <p className="text-sm text-amber-800">Estimated Total</p>
                <p className="text-3xl font-bold text-amber-900">
                  ${result.totalRange.low.toFixed(0)} - ${result.totalRange.high.toFixed(0)}
                </p>
              </div>

              <div className="space-y-2 text-sm text-gray-700">
                <p>Guest count: {result.guestCount}</p>
                <p>Base subtotal: ${result.baseSubtotal.toFixed(0)}</p>
                <p>Minimum spend applied: ${result.minimumSpend.toFixed(0)}</p>
                <p>Effective base: ${result.effectiveBase.toFixed(0)}</p>
                <p>
                  Travel fee range: ${result.travelFeeRange.low.toFixed(0)} - ${result.travelFeeRange.high.toFixed(0)}
                </p>
                <p>Tableware rental: ${result.tablewareFee.toFixed(0)}</p>
                <p>
                  Add-ons impact: ${result.addOnTotalRange.low.toFixed(0)} - ${result.addOnTotalRange.high.toFixed(0)}
                </p>
              </div>

              <div className="rounded-md border p-3 text-sm text-gray-700">
                <p className="font-medium mb-1">Suggested call script:</p>
                <p>{callScript}</p>
              </div>

              {!result.hasCoreInputs && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
                  Add date, location, and guest count to enable one-click contact actions.
                </p>
              )}

              <div className="grid gap-3 sm:grid-cols-3">
                <Button onClick={onSmsClick} disabled={contactDisabled} className="bg-sky-600 hover:bg-sky-700">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  SMS
                </Button>
                <Button onClick={onCallClick} disabled={contactDisabled} className="bg-emerald-600 hover:bg-emerald-700">
                  <Phone className="mr-2 h-4 w-4" />
                  Call
                </Button>
                <Button onClick={onEmailClick} disabled={contactDisabled} className="bg-indigo-600 hover:bg-indigo-700">
                  <Mail className="mr-2 h-4 w-4" />
                  Email
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Button asChild variant="outline">
                  <Link href="/deposit">Place Deposit</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link
                    href={`/contact?reason=Manual confirmation request&eventDate=${encodeUrlComponent(input.eventDate)}&guestCount=${result.guestCount}&cityOrZip=${encodeUrlComponent(input.location)}&estimateLow=${result.totalRange.low}&estimateHigh=${result.totalRange.high}`}
                  >
                    Request Manual Confirmation
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
