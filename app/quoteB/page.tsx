import type { Metadata } from "next"
import QuoteBuilderClient from "@/app/quote/QuoteBuilderClient"

export const metadata: Metadata = {
  title: "Get Instant Quote B | Real Hibachi",
  description:
    "Variant B of our one-page quote builder with instant pricing context, travel fee range, upgrades, and urgency/deposit messaging.",
  openGraph: {
    title: "Get Instant Quote B | Real Hibachi",
    description: "Quote variant B with urgency messaging and contact actions.",
    url: "https://realhibachi.com/quoteB",
    siteName: "Real Hibachi",
    type: "website",
  },
}

export default function QuoteBuilderVariantBPage() {
  return <QuoteBuilderClient variant="B" />
}
