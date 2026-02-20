import type { Metadata } from "next"
import ContactPageClient from "./ContactPageClient"

export const metadata: Metadata = {
  title: "Feedback | Real Hibachi Post-Event Support",
  description:
    "Share your event feedback or request post-event support. Real Hibachi will review and follow up quickly.",
  keywords:
    "real hibachi feedback, hibachi post-event support, hibachi service feedback, customer support hibachi",
  openGraph: {
    title: "Feedback | Real Hibachi Post-Event Support",
    description: "Send event feedback or post-event support requests by phone, SMS, WhatsApp, or form.",
    url: "https://realhibachi.com/contact",
    siteName: "Real Hibachi",
    type: "website",
  },
}

export default function ContactPage() {
  return <ContactPageClient />
}
