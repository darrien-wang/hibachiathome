import type { Metadata } from "next"
import PartnerOpportunitiesPageClient from "./PartnerOpportunitiesPageClient"

export const metadata: Metadata = {
  title: "Partner Opportunities | Real Hibachi",
  description:
    "Apply to partner with Real Hibachi. We are hiring trusted local service providers for events, logistics, staffing, and event support.",
  openGraph: {
    title: "Partner Opportunities | Real Hibachi",
    description: "Join the Real Hibachi partner network and grow with local event opportunities.",
    url: "https://realhibachi.com/partner-opportunities",
    siteName: "Real Hibachi",
    type: "website",
  },
}

export default function PartnerOpportunitiesPage() {
  return <PartnerOpportunitiesPageClient />
}
