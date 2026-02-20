import type { Metadata } from "next"
import QuoteBuilderClient from "./QuoteBuilderClient"

export const metadata: Metadata = {
  title: "Get Instant Quote | Real Hibachi",
  description:
    "Use our one-page quote builder to get instant hibachi pricing context with travel fee range, upgrades, and quick contact actions.",
  openGraph: {
    title: "Get Instant Quote | Real Hibachi",
    description: "Instant one-page quote builder with SMS, call, and email actions.",
    url: "https://realhibachi.com/quote",
    siteName: "Real Hibachi",
    type: "website",
  },
}

export default function QuoteBuilderPage() {
  return <QuoteBuilderClient />
}
