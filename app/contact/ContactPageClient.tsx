"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Phone, Mail, MapPin } from "lucide-react"
import { trackEvent } from "@/lib/tracking"
import { phone, siteConfig } from "@/config/site"

const SUPPORT_REASON_PATTERN = /support|feedback|refund|cancel|cancellation|reschedule|post[- ]?event|complaint|issue|help/i

export default function ContactPageClient() {
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    eventDate: "",
    guestCount: "",
    cityOrZip: "",
    message: "",
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle")

  const reason = (searchParams.get("reason") ?? "").trim()
  const reasonLooksLikeSupport = reason.length > 0 && SUPPORT_REASON_PATTERN.test(reason)
  const submissionIntent: "booking_inquiry" | "customer_support" = reasonLooksLikeSupport
    ? "customer_support"
    : "booking_inquiry"
  const submissionEventName: "contact_booking_inquiry_submit" | "support_submit" =
    submissionIntent === "booking_inquiry" ? "contact_booking_inquiry_submit" : "support_submit"
  const isBookingInquiry = submissionIntent === "booking_inquiry"
  const submissionReason = reason || (submissionIntent === "booking_inquiry" ? "Booking Inquiry" : "Customer Support")

  useEffect(() => {
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
      eventDate: eventDate || prev.eventDate,
      guestCount: guestCount || prev.guestCount,
      cityOrZip: cityOrZip || prev.cityOrZip,
      message: prev.message || [estimateLine, "Please confirm availability and next steps."].filter(Boolean).join(" "),
    }))
  }, [reason, searchParams])

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
          name: formData.name.trim(),
          email: formData.email,
          phone: formData.phone,
          // The API has always accepted these three (route.ts:95-104); the form just
          // never sent them, so every inquiry arrived missing the date, headcount and
          // location needed to actually quote it.
          eventDate: formData.eventDate,
          guestCount: formData.guestCount,
          cityOrZip: formData.cityOrZip,
          reason: submissionReason,
          leadSource: "contact_page",
          leadChannel: "contact_form",
          leadType: submissionIntent,
          message: formData.message,
        }),
      })

      if (response.ok) {
        trackEvent(submissionEventName, {
          lead_channel: "contact_form",
          lead_source: "contact_page",
          lead_type: submissionIntent,
          inquiry_reason: submissionReason.toLowerCase().replace(/\s+/g, "_"),
          guest_count: formData.guestCount || "unspecified",
          location_hint: formData.cityOrZip || "unspecified",
        })
        setSubmitStatus("success")
        setFormData({
          name: "",
          email: "",
          phone: "",
          eventDate: "",
          guestCount: "",
          cityOrZip: "",
          message: "",
        })
      } else {
        setSubmitStatus("error")
      }
    } catch {
      setSubmitStatus("error")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  return (
    <div className="page-container bg-[#f7f4ec]">
      <div className="container mx-auto px-4 py-14">
        <div className="grid lg:grid-cols-2 gap-12">
          <div className="space-y-8">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900">Contact Us</h1>
            <div>
              <h2 className="text-4xl font-serif font-bold text-[hsl(24_79%_42%)] mb-6">Book or Ask About Your Event</h2>
              <div className="space-y-5 text-2xl text-gray-800">
                <a href={phone.voice.tel} className="flex items-center gap-3 hover:text-[hsl(24_79%_42%)]">
                  <Phone className="h-6 w-6 text-[hsl(24_79%_42%)]" />
                  <span>West Coast - {phone.voice.dashed}</span>
                </a>
                <a
                  href={`mailto:${siteConfig.contact.email}`}
                  className="flex items-center gap-3 hover:text-[hsl(24_79%_42%)]"
                >
                  <Mail className="h-6 w-6 text-[hsl(24_79%_42%)]" />
                  <span>{siteConfig.contact.email}</span>
                </a>
                <div className="flex items-center gap-3">
                  <MapPin className="h-6 w-6 text-[hsl(24_79%_42%)]" />
                  <span>Southern California Service Area</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-4xl font-serif font-bold mb-6 text-gray-900">
              {isBookingInquiry ? "Tell Us Your Event Details" : "How Can We Help?"}
            </h3>
            <div className="space-y-6">
              {submitStatus === "success" && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800">Thanks. Your request is in and our booking team will contact you shortly.</p>
                </div>
              )}

              {submitStatus === "error" && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800">Submission failed. Please try again later or contact us directly.</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="contact-name" className="block text-sm font-medium text-gray-700 mb-2">Name (required)</label>
                  <Input
                    id="contact-name"
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    autoComplete="name"
                    className="h-12 bg-white border-gray-300"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="contact-phone" className="block text-sm font-medium text-gray-700 mb-2">
                      Phone {isBookingInquiry ? "(required)" : "(optional)"}
                    </label>
                    <Input
                      id="contact-phone"
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      required={isBookingInquiry}
                      autoComplete="tel"
                      inputMode="tel"
                      className="h-12 bg-white border-gray-300"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-email" className="block text-sm font-medium text-gray-700 mb-2">Email (required)</label>
                    <Input
                      id="contact-email"
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      autoComplete="email"
                      inputMode="email"
                      className="h-12 bg-white border-gray-300"
                    />
                  </div>
                </div>

                {/* Without these three we cannot price anything, so we ask up front
                    instead of spending an email round-trip on it. They stay optional:
                    a half-filled inquiry still beats a bounced one. */}
                {isBookingInquiry && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="contact-event-date" className="block text-sm font-medium text-gray-700 mb-2">Event Date</label>
                      <Input
                        id="contact-event-date"
                        type="date"
                        name="eventDate"
                        value={formData.eventDate}
                        onChange={handleInputChange}
                        className="h-12 bg-white border-gray-300"
                      />
                    </div>
                    <div>
                      <label htmlFor="contact-guest-count" className="block text-sm font-medium text-gray-700 mb-2">Guests</label>
                      <Input
                        id="contact-guest-count"
                        type="number"
                        min="1"
                        name="guestCount"
                        value={formData.guestCount}
                        onChange={handleInputChange}
                        inputMode="numeric"
                        placeholder="10"
                        className="h-12 bg-white border-gray-300"
                      />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <label htmlFor="contact-city-or-zip" className="block text-sm font-medium text-gray-700 mb-2">City or ZIP</label>
                      <Input
                        id="contact-city-or-zip"
                        type="text"
                        name="cityOrZip"
                        value={formData.cityOrZip}
                        onChange={handleInputChange}
                        autoComplete="postal-code"
                        placeholder="Irvine or 92602"
                        className="h-12 bg-white border-gray-300"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="contact-message" className="block text-sm font-medium text-gray-700 mb-2">
                    Message{" "}
                    {isBookingInquiry ? (
                      <span className="font-normal text-gray-500">(optional)</span>
                    ) : (
                      "(required)"
                    )}
                  </label>
                  <Textarea
                    id="contact-message"
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    required={!isBookingInquiry}
                    rows={4}
                    placeholder={
                      isBookingInquiry
                        ? "Allergies, parking, indoor or outdoor — anything else we should know."
                        : "Tell us what happened and we’ll make it right."
                    }
                    className="bg-white border-gray-300"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-full px-10 h-14 bg-[#B3261E] hover:bg-[#9f2019] text-white text-lg font-semibold"
                >
                  {isSubmitting ? "Submitting..." : "Send Request"}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
