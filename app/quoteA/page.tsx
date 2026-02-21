import type { Metadata } from "next"
import QuoteBuilderClient from "@/app/quote/QuoteBuilderClient"

export const metadata: Metadata = {
  title: "Get Instant Quote A | Real Hibachi",
  description:
    "Variant A of our one-page quote builder for instant hibachi pricing context, travel fee range, upgrades, and quick contact actions.",
  openGraph: {
    title: "Get Instant Quote A | Real Hibachi",
    description: "Quote variant A with SMS, call, and email actions.",
    url: "https://realhibachi.com/quoteA",
    siteName: "Real Hibachi",
    type: "website",
  },
}

export default function QuoteBuilderVariantAPage() {
  return <QuoteBuilderClient variant="A" />
}
