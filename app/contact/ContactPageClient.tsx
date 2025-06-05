"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Phone, Mail, MapPin, Users, Utensils, Calendar, Truck, Music, Camera, Flower } from "lucide-react"

export default function ContactPageClient() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    serviceType: "",
    message: "",
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle")

  const serviceTypes = [
    {
      icon: Users,
      name: "Table & Chair Rentals",
      description: "Provide various event table and chair rental services",
    },
    { icon: Calendar, name: "Wedding Events", description: "Wedding planning and execution services" },
    { icon: Utensils, name: "Chef Recruitment", description: "Professional Japanese cuisine chefs" },
    { icon: Truck, name: "Logistics & Delivery", description: "Ingredient and equipment delivery services" },
    { icon: Music, name: "Audio Equipment", description: "Event sound systems and entertainment equipment" },
    { icon: Camera, name: "Photography & Videography", description: "Event documentation and promotional filming" },
    { icon: Flower, name: "Event Decoration", description: "Event venue decoration and setup services" },
  ]

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
          ...formData,
          subject: `Partnership Application - ${formData.serviceType || "Service Provider"}`,
        }),
      })

      if (response.ok) {
        setSubmitStatus("success")
        setFormData({
          name: "",
          email: "",
          phone: "",
          company: "",
          serviceType: "",
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 text-white pt-32 pb-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Seeking Local Partners</h1>
          <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto">
            We are looking for various quality local service providers to work together in delivering the perfect
            Japanese hibachi experience
          </p>
          <Badge variant="secondary" className="text-lg px-6 py-2">
            Partnership Opportunities · Build Together
          </Badge>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Services We're Looking For */}
          <div>
            <h2 className="text-3xl font-bold mb-8 text-gray-800">Services We Need</h2>
            <div className="grid gap-6">
              {serviceTypes.map((service, index) => {
                const IconComponent = service.icon
                return (
                  <Card key={index} className="border-l-4 border-l-orange-500 hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-3 rounded-lg">
                          <IconComponent className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold mb-2 text-gray-800">{service.name}</h3>
                          <p className="text-gray-600">{service.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Contact Form */}
          <div>
            <Card className="shadow-xl border-0 bg-white">
              <CardHeader className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-t-lg">
                <CardTitle className="text-2xl">Apply to Become a Partner</CardTitle>
                <CardDescription className="text-amber-100">
                  Fill out the information below and we'll contact you soon
                </CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                {submitStatus === "success" && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-green-800">
                      Thank you for your application! We will contact you within 24 hours.
                    </p>
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                      <Input
                        type="text"
                        name="company"
                        value={formData.company}
                        onChange={handleInputChange}
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Service Type</label>
                    <Input
                      type="text"
                      name="serviceType"
                      value={formData.serviceType}
                      onChange={handleInputChange}
                      placeholder="Please enter the type of service you provide"
                      className="focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Detailed Information *</label>
                    <Textarea
                      name="message"
                      value={formData.message}
                      onChange={handleInputChange}
                      rows={5}
                      required
                      placeholder="Please describe in detail your service offerings, experience, pricing range, and other relevant information..."
                      className="focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-3 text-lg"
                  >
                    {isSubmitting ? "Submitting..." : "Submit Application"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Contact Info */}
            <div className="mt-8 grid gap-4">
              <div className="flex items-center gap-3 text-gray-700">
                <Phone className="h-5 w-5 text-orange-500" />
                <span>(213) 770-7788</span>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <Mail className="h-5 w-5 text-orange-500" />
                <span>realhibachiathome@gmail.com</span>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <MapPin className="h-5 w-5 text-orange-500" />
                <span>Service Area: NYC and surrounding areas</span>
              </div>
              <div className="text-sm text-gray-600 italic mt-2">
                We will gradually open other areas in the future, you can contact us in advance.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
