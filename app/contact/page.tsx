"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Facebook, Instagram, Mail, MapPin, Phone, Twitter } from "lucide-react"
import { contactInfo } from "@/config/contact"

const contactReasons = [
  "General Inquiry",
  "Booking Question",
  "Menu Options",
  "Equipment Rental",
  "Corporate Event",
  "Feedback",
  "Other",
]

export default function ContactPage() {
  const [formSubmitted, setFormSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle form submission
    setFormSubmitted(true)
  }

  return (
    <div className="container mx-auto px-4 py-12 pt-24 mt-16">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-4">Contact Us</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Have a question or ready to book your hibachi experience? Get in touch with our team.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {/* Contact Methods */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Phone className="h-5 w-5 mr-2 text-primary" />
                Phone
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-2">Quick question or ready to book?</p>
              <p className="font-medium">{contactInfo.phone}</p>
              <p className="text-sm text-gray-500 mt-2">Available 9am-7pm, 7 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Mail className="h-5 w-5 mr-2 text-primary" />
                Email
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-2">Detailed questions or inquiries?</p>
              <p className="font-medium">{contactInfo.email}</p>
              <p className="text-sm text-gray-500 mt-2">We'll respond within 24 hours</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MapPin className="h-5 w-5 mr-2 text-primary" />
                Locations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-2">Serving:</p>
              {contactInfo.locations.map((location, index) => (
                <p key={index} className="font-medium">
                  {location}
                </p>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Contact Form */}
          <Card>
            <CardHeader>
              <CardTitle>Send Us a Message</CardTitle>
              <CardDescription>Fill out the form below and we'll get back to you as soon as possible.</CardDescription>
            </CardHeader>
            <CardContent>
              {formSubmitted ? (
                <div className="text-center p-6">
                  <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold mb-2">Message Sent!</h3>
                  <p className="text-gray-600">
                    Thank you for reaching out. We'll respond to your inquiry within 24 hours.
                  </p>
                  <Button variant="outline" className="mt-6" onClick={() => setFormSubmitted(false)}>
                    Send Another Message
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first-name">First Name</Label>
                      <Input id="first-name" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last-name">Last Name</Label>
                      <Input id="last-name" required />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" type="email" required />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason for Contact</Label>
                    <Select>
                      <SelectTrigger id="reason">
                        <SelectValue placeholder="Select a reason" />
                      </SelectTrigger>
                      <SelectContent>
                        {contactReasons.map((reason) => (
                          <SelectItem key={reason} value={reason}>
                            {reason}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea id="message" rows={5} required />
                  </div>

                  <Button type="submit" className="w-full">
                    Send Message
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Map and Social */}
          <div className="space-y-8">
            {/* Google Maps Integration */}
            <Card>
              <div className="rounded-t-lg h-64 overflow-hidden">
                <iframe
                  src="https://www.google.com/maps/d/embed?mid=1Ck_5hM9wHRvw5-2vQFoSCEGKkxA9UXU&ehbc=2E312F"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen={true}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Our Service Locations"
                  className="w-full h-full"
                ></iframe>
              </div>
              <CardContent className="pt-6">
                <h3 className="font-bold mb-2">Our Service Areas</h3>
                <p className="text-gray-600 text-sm">
                  We currently serve Chicago (Illinois), Los Angeles, Palm Springs, San Diego (California), and Panama
                  City, Destin, 30A (Florida).
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {contactInfo.locations.map((location, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
                    >
                      <MapPin className="h-3 w-3 mr-1" />
                      {location}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Social Media */}
            <Card>
              <CardHeader>
                <CardTitle>Connect With Us</CardTitle>
                <CardDescription>
                  Follow us on social media for updates, special offers, and hibachi inspiration.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <a
                    href={contactInfo.social.facebook}
                    className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Facebook className="h-8 w-8 text-blue-600 mb-2" />
                    <span className="text-sm font-medium">Facebook</span>
                  </a>
                  <a
                    href={contactInfo.social.instagram}
                    className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Instagram className="h-8 w-8 text-pink-600 mb-2" />
                    <span className="text-sm font-medium">Instagram</span>
                  </a>
                  <a
                    href={contactInfo.social.twitter}
                    className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Twitter className="h-8 w-8 text-blue-400 mb-2" />
                    <span className="text-sm font-medium">Twitter</span>
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
