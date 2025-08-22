import type { Metadata } from "next"
import GardenGroveServiceClient from "./GardenGroveServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Garden Grove | Orange County Private Chef Service | Real Hibachi",
  description: "Premium hibachi at home experience in Garden Grove, Orange County. Professional private chef bringing authentic Japanese teppanyaki and unforgettable memories to your celebration.",
  keywords: "hibachi at home Garden Grove, private chef Orange County, Japanese teppanyaki Garden Grove, hibachi catering OC, private birthday hibachi party Garden Grove",
  openGraph: {
    title: "Hibachi at Home Garden Grove | Orange County Private Chef Service",
    description: "Create unforgettable memories with our hibachi at home experience in Garden Grove. Professional private chef, authentic teppanyaki, and emotional celebrations that matter.",
    url: "https://realhibachi.com/service-area/orange-county/garden-grove",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Garden Grove - Create Memories That Matter',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Garden Grove | Memories That Matter',
    description: 'Transform your special moments with our hibachi at home experience in Garden Grove, Orange County.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function GardenGroveServicePage() {
  return <GardenGroveServiceClient />
}