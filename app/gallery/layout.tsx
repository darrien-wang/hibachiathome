import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Photo & Video Gallery | Hibachi Parties at Home",
  description:
    "See real hibachi at home parties across Los Angeles, Orange County, and Southern California — live chef shows, flaming grills, birthdays, and backyard events.",
  openGraph: {
    title: "Real Hibachi Gallery | Hibachi Parties at Home",
    description:
      "Photos and videos from real at-home hibachi events across Southern California.",
    url: "https://www.realhibachi.com/gallery",
    siteName: "Real Hibachi",
    type: "website",
  },
}

export default function GalleryLayout({ children }: { children: React.ReactNode }) {
  return children
}
