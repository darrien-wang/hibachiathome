import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Hibachi at Home Los Angeles & Orange County | Private Chef",
  description:
    "Book hibachi at home in Los Angeles and Orange County. A private hibachi chef brings the grill, food, setup, chef show, and cleanup to your backyard or event space.",
  keywords:
    "hibachi at home Los Angeles, hibachi at home Orange County, private hibachi chef LA, hibachi come to your house, backyard hibachi party prices",
  openGraph: {
    title: "Hibachi at Home in Los Angeles & Orange County",
    description:
      "Private hibachi chef service with grill, food, setup, chef show, and cleanup for backyard parties and at-home events.",
    url: "https://www.realhibachi.com/hibachi-at-home",
    images: [
      {
        url: "/images/menu/chicken-and-beef.jpg",
        width: 1200,
        height: 630,
        alt: "Hibachi at home private chef experience in Los Angeles",
      },
    ],
  },
  alternates: {
    canonical: "https://www.realhibachi.com/hibachi-at-home",
  },
}

export default function HibachiAtHomeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
