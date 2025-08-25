import type { Metadata } from "next"
import HuntingtonBeachServiceClient from "./HuntingtonBeachServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Huntington Beach | Orange County Private Chef Service | Real Hibachi",
  description: "Premium hibachi at home experience in Huntington Beach, Orange County. Professional private chef bringing authentic Japanese teppanyaki and unforgettable memories to your celebration.",
  keywords: "hibachi at home Huntington Beach, private chef Orange County, Japanese teppanyaki Huntington Beach, hibachi catering OC, private birthday hibachi party Huntington Beach",
  openGraph: {
    title: "Hibachi at Home Huntington Beach | Orange County Private Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/orange-county/huntington-beach",
  },
    description: "Create unforgettable memories with our hibachi at home experience in Huntington Beach. Professional private chef, authentic teppanyaki, and emotional celebrations that matter.",
    url: "https://www.realhibachi.com/service-area/orange-county/huntington-beach",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Huntington Beach - Create Memories That Matter',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Huntington Beach | Memories That Matter',
    description: 'Transform your special moments with our hibachi at home experience in Huntington Beach, Orange County.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function HuntingtonBeachServicePage() {
  return <HuntingtonBeachServiceClient />
}