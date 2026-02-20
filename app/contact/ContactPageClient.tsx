"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Phone, Mail, MapPin } from "lucide-react"
import { trackEvent } from "@/lib/tracking"
import { siteConfig } from "@/config/site"

export default function ContactPageClient() {
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    eventDate: "",
    guestCount: "",
    cityOrZip: "",
    message: "",
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle")

  const reason = searchParams.get("reason") ?? ""

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
          name: `${formData.firstName} ${formData.lastName}`.trim(),
          email: formData.email,
          phone: formData.phone,
          reason: reason || "Post-Event Feedback / Support",
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
          lead_type: "customer_feedback",
          inquiry_reason: reason || "post_event_feedback_support",
          guest_count: formData.guestCount || "unspecified",
          location_hint: formData.cityOrZip || "unspecified",
        })
        setSubmitStatus("success")
        setFormData({
          firstName: "",
          lastName: "",
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
              <h2 className="text-4xl font-serif font-bold text-[hsl(24_79%_42%)] mb-6">Text Or Call Us</h2>
              <div className="space-y-5 text-2xl text-gray-800">
                <a href="tel:2137707788" className="flex items-center gap-3 hover:text-[hsl(24_79%_42%)]">
                  <Phone className="h-6 w-6 text-[hsl(24_79%_42%)]" />
                  <span>West Coast - 213-770-7788</span>
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
            <h3 className="text-4xl font-serif font-bold mb-6 text-gray-900">Name</h3>
            <div className="space-y-6">
              {submitStatus === "success" && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800">Thanks. Your feedback request is in and we will contact you shortly.</p>
                </div>
              )}

              {submitStatus === "error" && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800">Submission failed. Please try again later or contact us directly.</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">First Name (required)</label>
                    <Input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                      className="h-12 bg-white border-gray-300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Last Name (required)</label>
                    <Input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                      className="h-12 bg-white border-gray-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email (required)</label>
                  <Input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="h-12 bg-white border-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                  <Input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="h-12 bg-white border-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Message (required)</label>
                  <Textarea
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    required
                    rows={6}
                    className="bg-white border-gray-300"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-full px-10 h-14 bg-[#B3261E] hover:bg-[#9f2019] text-white text-lg font-semibold"
                >
                  {isSubmitting ? "Submitting..." : "Submit"}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
