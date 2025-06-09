import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Private Hibachi at Your Home - Starting at $49.9/Guest | Real Hibachi",
  description:
    "Professional hibachi chef comes to your home. Chef show, full setup, fried rice, salad, and 2 proteins—all done at your place. Book now!",
  keywords: "hibachi at home, private hibachi chef, home hibachi service, backyard hibachi party, hibachi catering",
  openGraph: {
    title: "Private Hibachi at Your Home - Starting at $49.9/Guest",
    description: "Chef show, full setup, fried rice, salad, and 2 proteins—all done at your place.",
    images: [
      {
        url: "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/Chicken-and-Beef-Hibachi-Catering-LA-itQYZOc95RTr9yWdNJOr1NiXsBBIBu.jpg",
        width: 1200,
        height: 630,
        alt: "Hibachi at home experience",
      },
    ],
  },
}

export default function HibachiAtHomeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
