import type { Metadata } from "next"
import { Suspense } from "react"
import ContactPageClient from "./ContactPageClient"

export const metadata: Metadata = {
  title: "Contact & Booking Help",
  description:
    "Request booking help, availability confirmation, and next steps for your hibachi event. Real Hibachi responds quickly by phone, SMS, or email.",
  keywords:
    "real hibachi contact, hibachi booking inquiry, hibachi availability request, hibachi event consultation",
  openGraph: {
    title: "Contact & Booking Help | Real Hibachi",
    description: "Get booking help and event planning support by phone, SMS, WhatsApp, or form.",
    url: "https://www.realhibachi.com/contact",
    siteName: "Real Hibachi",
    type: "website",
  },
}

export default function ContactPage() {
  return (
    <Suspense fallback={null}>
      <ContactPageClient />
    </Suspense>
  )
}
