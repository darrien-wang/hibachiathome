import type { Metadata } from "next"
import QuoteBuilderClient from "@/app/quote/QuoteBuilderClient"

export const metadata: Metadata = {
  // Bare title: the root layout template appends "| Real Hibachi".
  title: "Get an Instant Hibachi Quote",
  description:
    "One-page quote builder for instant hibachi pricing, travel fee range, upgrades, and quick contact actions.",
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: "https://www.realhibachi.com/quote",
  },
  // Link preview for iMessage / WhatsApp / Facebook. Most visitors are on
  // iPhone and parties get planned in group chats, so the card has to be a
  // real 1200x630 landscape image (the shared hibachi-flame-og.png is a
  // 336x521 portrait photo and crops badly). Setting openGraph here replaces
  // the root layout's block entirely, so the image must be listed again.
  openGraph: {
    title: "Get an Instant Hibachi Quote | Real Hibachi",
    description: "Tell us your guests and date. Your hibachi party price arrives by text.",
    url: "https://www.realhibachi.com/quote",
    siteName: "Real Hibachi",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "https://www.realhibachi.com/images/og/quote-fire-show-1200x630.jpg",
        width: 1200,
        height: 630,
        alt: "Real Hibachi chef's fire show at a backyard party",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Get an Instant Hibachi Quote | Real Hibachi",
    description: "Tell us your guests and date. Your hibachi party price arrives by text.",
    images: ["https://www.realhibachi.com/images/og/quote-fire-show-1200x630.jpg"],
  },
}

export default function QuoteBuilderPage() {
  return <QuoteBuilderClient />
}
