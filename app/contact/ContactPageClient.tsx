"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Phone, Mail, MapPin, MessageSquare } from "lucide-react"
import { trackEvent } from "@/lib/tracking"
import { siteConfig } from "@/config/site"

export default function ContactPageClient() {
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    reason: "",
    eventDate: "",
    guestCount: "",
    cityOrZip: "",
    message: "",
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle")

  useEffect(() => {
    const reason = searchParams.get("reason") ?? ""
    const eventDate = searchParams.get("eventDate") ?? ""
    const guestCount = searchParams.get("guestCount") ?? ""
    const cityOrZip = searchParams.get("cityOrZip") ?? ""
    const estimateLow = searchParams.get("estimateLow") ?? ""
    const estimateHigh = searchParams.get("estimateHigh") ?? ""

    if (!reason && !eventDate && !guestCount && !cityOrZip && !estimateLow && !estimateHigh) {
      return
    }

    const estimateLine =
      estimateLow && estimateHigh ? `Quoted estimate range: $${estimateLow} - $${estimateHigh}.` : ""

    setFormData((prev) => ({
      ...prev,
      reason: reason || prev.reason,
      eventDate: eventDate || prev.eventDate,
      guestCount: guestCount || prev.guestCount,
      cityOrZip: cityOrZip || prev.cityOrZip,
      message: prev.message || [estimateLine, "Please confirm availability and next steps."].filter(Boolean).join(" "),
    }))
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          reason: formData.reason || "Booking / Pricing Inquiry",
          message: [
            `Event Date: ${formData.eventDate || "Not provided"}`,
            `Guest Count: ${formData.guestCount || "Not provided"}`,
            `City/ZIP: ${formData.cityOrZip || "Not provided"}`,
            "",
            formData.message,
          ].join("\n"),
        }),
      })

      if (response.ok) {
        trackEvent("lead_submit", {
          lead_channel: "contact_form",
          lead_source: "contact_page",
          lead_type: "customer_inquiry",
          inquiry_reason: formData.reason || "booking_pricing",
          guest_count: formData.guestCount || "unspecified",
          location_hint: formData.cityOrZip || "unspecified",
        })
        setSubmitStatus("success")
        setFormData({
          name: "",
          email: "",
          phone: "",
          reason: "",
          eventDate: "",
          guestCount: "",
          cityOrZip: "",
          message: "",
        })
      } else {
        setSubmitStatus("error")
      }
    } catch (error) {
      setSubmitStatus("error")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleCallClick = () => {
    trackEvent("contact_call_click", { contact_surface: "contact_page" })
    window.location.href = `tel:${siteConfig.contact.phone}`
  }

  const handleSMSClick = () => {
    trackEvent("contact_sms_click", { contact_surface: "contact_page" })
    window.location.href = `sms:${siteConfig.contact.phone}?body=Hi%20Real%20Hibachi%2C%20I%20want%20a%20quick%20quote.`
  }

  const handleWhatsAppClick = () => {
    trackEvent("contact_whatsapp_click", { contact_surface: "contact_page" })
    const whatsappNumber = siteConfig.contact.phone.replace(/\D/g, "")
    window.location.href = `https://wa.me/${whatsappNumber}?text=Hi%20Real%20Hibachi%2C%20I%20want%20a%20quick%20quote.`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
      <div className="hero-section bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 text-white pb-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Contact Real Hibachi</h1>
          <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto">
            Need pricing fast? Call, text, WhatsApp, or send a short request and we will confirm availability quickly.
          </p>
          <Badge variant="secondary" className="text-lg px-6 py-2">
            Booking Questions · Instant Support
          </Badge>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">
        <div className="grid lg:grid-cols-2 gap-12">
          <div>
            <h2 className="text-3xl font-bold mb-8 text-gray-800">Talk To Us In One Tap</h2>
            <div className="grid gap-4">
              <Card className="border-l-4 border-l-orange-500 hover:shadow-lg transition-shadow">
                <CardContent className="p-6 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800">Call Now</h3>
                    <p className="text-gray-600">Best for immediate date and pricing checks.</p>
                  </div>
                  <Button onClick={handleCallClick} className="bg-orange-600 hover:bg-orange-700">
                    <Phone className="mr-2 h-4 w-4" />
                    {siteConfig.contact.phone}
                  </Button>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-green-500 hover:shadow-lg transition-shadow">
                <CardContent className="p-6 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800">WhatsApp</h3>
                    <p className="text-gray-600">Send your event details and get a quick reply.</p>
                  </div>
                  <Button onClick={handleWhatsAppClick} className="bg-green-600 hover:bg-green-700">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    WhatsApp
                  </Button>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-sky-500 hover:shadow-lg transition-shadow">
                <CardContent className="p-6 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800">SMS</h3>
                    <p className="text-gray-600">Prefer text? We can quote you by message.</p>
                  </div>
                  <Button onClick={handleSMSClick} className="bg-sky-600 hover:bg-sky-700">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Text Us
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="mt-8 grid gap-4">
              <div className="flex items-center gap-3 text-gray-700">
                <Phone className="h-5 w-5 text-orange-500" />
                <span>{siteConfig.contact.phone}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <Mail className="h-5 w-5 text-orange-500" />
                <span>{siteConfig.contact.email}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <MapPin className="h-5 w-5 text-orange-500" />
                <span>Service Areas: Southern California and NYC/Long Island</span>
              </div>
              <div className="text-sm text-gray-700">
                <a href="/locations/la-orange-county" className="text-orange-600 hover:underline">
                  LA & Orange County service details
                </a>{" "}
                ·{" "}
                <a href="/locations/nyc-long-island" className="text-orange-600 hover:underline">
                  NYC & Long Island service details
                </a>
              </div>
            </div>
          </div>

          <div>
            <Card className="shadow-xl border-0 bg-white">
              <CardHeader className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-t-lg">
                <CardTitle className="text-2xl">Quick Event Request</CardTitle>
                <CardDescription className="text-amber-100">
                  30-second form. We will follow up with options and pricing.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                {submitStatus === "success" && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-green-800">Thanks. Your request is in and we will contact you shortly.</p>
                  </div>
                )}

                {submitStatus === "error" && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800">Submission failed. Please try again later or contact us directly.</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                      <Input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        className="focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                      <Input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        required
                        className="focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                      <Input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        className="focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Event Date</label>
                      <Input
                        type="date"
                        name="eventDate"
                        value={formData.eventDate}
                        onChange={handleInputChange}
                        className="focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Guest Count</label>
                      <Input
                        type="number"
                        min={1}
                        name="guestCount"
                        value={formData.guestCount}
                        onChange={handleInputChange}
                        placeholder="e.g. 15"
                        className="focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">City or ZIP</label>
                      <Input
                        type="text"
                        name="cityOrZip"
                        value={formData.cityOrZip}
                        onChange={handleInputChange}
                        placeholder="e.g. Irvine / 92620"
                        className="focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">What do you need help with?</label>
                    <Input
                      type="text"
                      name="reason"
                      value={formData.reason}
                      onChange={handleInputChange}
                      placeholder="Booking, pricing, menu questions..."
                      className="focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Message *</label>
                    <Textarea
                      name="message"
                      value={formData.message}
                      onChange={handleInputChange}
                      rows={4}
                      required
                      placeholder="Tell us your event type and any menu preferences."
                      className="focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-3 text-lg"
                  >
                    {isSubmitting ? "Submitting..." : "Send Request"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
