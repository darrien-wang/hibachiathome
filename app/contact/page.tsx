import type { Metadata } from "next"
import ContactPageClient from "./ContactPageClient"

export const metadata: Metadata = {
  title: "Contact Real Hibachi | Book, Pricing, and Event Questions",
  description:
    "Contact Real Hibachi for booking, pricing, and event planning support. Call, text, or send a quick request to confirm date availability.",
  keywords:
    "contact real hibachi, hibachi booking help, hibachi pricing inquiry, hibachi catering contact los angeles, hibachi event questions",
  openGraph: {
    title: "Contact Real Hibachi | Booking and Pricing Support",
    description: "Reach Real Hibachi by phone, SMS, WhatsApp, or form to book your event faster.",
    url: "https://realhibachi.com/contact",
    siteName: "Real Hibachi",
    type: "website",
  },
}

export default function ContactPage() {
  return <ContactPageClient />
}
