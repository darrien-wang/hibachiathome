import type { Metadata } from "next"
import QuoteBuilderClient from "@/app/quote/QuoteBuilderClient"

export const metadata: Metadata = {
  title: "Get an Instant Hibachi Quote | Real Hibachi",
  description:
    "One-page quote builder for instant hibachi pricing, travel fee range, upgrades, and quick contact actions.",
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: "https://www.realhibachi.com/quote",
  },
  openGraph: {
    title: "Get an Instant Hibachi Quote | Real Hibachi",
    description: "Instant hibachi pricing with SMS, call, and email actions.",
    url: "https://www.realhibachi.com/quote",
    siteName: "Real Hibachi",
    type: "website",
  },
}

export default function QuoteBuilderPage() {
  return <QuoteBuilderClient />
}
