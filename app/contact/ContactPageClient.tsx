"use client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Mail, Phone } from "lucide-react"
import { siteConfig } from "@/config/site"

const contactReasons = [
  "General Inquiry",
  "Booking Question",
  "Menu Options",
  "Equipment Rental",
  "Corporate Event",
  "Feedback",
  "Other",
]

export default function ContactPageClient() {
  return (
    <section className="container grid items-center justify-center gap-6 pt-40 pb-10">
      <div className="grid gap-2">
        <h1 className="text-center text-3xl font-bold tracking-tighter sm:text-5xl">Contact Us</h1>
        <p className="mx-auto max-w-[700px] text-center text-gray-500 md:text-xl/relaxed dark:text-gray-400">
          We'd love to hear from you! Get in touch using the form below, or reach out through our social media channels.
        </p>
      </div>
      <div className="mx-auto w-full max-w-screen-md">
        <Card>
          <CardHeader>
            <CardTitle>Send us a message</CardTitle>
            <CardDescription>We'll get back to you as soon as possible.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" placeholder="John Doe" type="text" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" placeholder="johndoe@example.com" type="email" />
              </div>
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
              <Textarea id="message" placeholder="Write your message here." />
            </div>
            <Button>Send Message</Button>
          </CardContent>
        </Card>
      </div>
      <div className="mx-auto w-full max-w-screen-md grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="overflow-hidden">
          <CardHeader className="bg-gray-50 dark:bg-gray-800">
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              Call Us
            </CardTitle>
            <CardDescription>Our Phone Number</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-2">
              <a
                href={`tel:${siteConfig.contact.phone}`}
                className="text-lg font-medium hover:text-primary transition-colors"
              >
                {siteConfig.contact.phone}
              </a>
              <div className="text-sm text-gray-500">Available Monday-Friday, 9am-5pm</div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="bg-gray-50 dark:bg-gray-800">
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Email Us
            </CardTitle>
            <CardDescription>Our Email Address</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-2">
              <a
                href={`mailto:${siteConfig.contact.email}`}
                className="text-lg font-medium hover:text-primary transition-colors break-all"
              >
                {siteConfig.contact.email}
              </a>
              <div className="text-sm text-gray-500">We typically respond within 24 hours</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
