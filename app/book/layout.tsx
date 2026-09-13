import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Book a Hibachi Chef | Reserve Your Date",
  description:
    "Book your hibachi at home party in Los Angeles, Orange County & Southern California. See your price range in 30 seconds, then text or call and a real person confirms your date.",
  openGraph: {
    title: "Book a Hibachi Chef | Real Hibachi",
    description:
      "Reserve a private hibachi chef for your home party in Southern California. Instant quote, then a real person confirms your date.",
    url: "https://www.realhibachi.com/book",
    siteName: "Real Hibachi",
    type: "website",
  },
}

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return children
}
