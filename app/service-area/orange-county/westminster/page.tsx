import type { Metadata } from "next"
import WestminsterServiceClient from "./WestminsterServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Westminster | Orange County Private Chef Service | Real Hibachi",
  description: "Premium hibachi at home experience in Westminster, Orange County. Professional private chef bringing authentic Japanese teppanyaki and unforgettable memories to your celebration.",
  keywords: "hibachi at home Westminster, private chef Orange County, Japanese teppanyaki Westminster, hibachi catering OC, private birthday hibachi party Westminster",
  openGraph: {
    title: "Hibachi at Home Westminster | Orange County Private Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/orange-county/westminster",
  },
    description: "Create unforgettable memories with our hibachi at home experience in Westminster. Professional private chef, authentic teppanyaki, and emotional celebrations that matter.",
    url: "https://www.realhibachi.com/service-area/orange-county/westminster",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Westminster - Create Memories That Matter',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Westminster | Memories That Matter',
    description: 'Transform your special moments with our hibachi at home experience in Westminster, Orange County.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function WestminsterServicePage() {
  return <WestminsterServiceClient />
}