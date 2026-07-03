import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Book a Hibachi Chef | Reserve Your Date",
  description:
    "Book your hibachi at home party in Los Angeles, Orange County & Southern California. Pick a date, choose your package, and lock it in with a small deposit.",
  openGraph: {
    title: "Book a Hibachi Chef | Real Hibachi",
    description:
      "Reserve a private hibachi chef for your home party in Southern California. Fast online booking.",
    url: "https://www.realhibachi.com/book",
    siteName: "Real Hibachi",
    type: "website",
  },
}

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return children
}
