import type { Metadata } from "next"
import SealBeachServiceClient from "./SealBeachServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Seal Beach | Orange County Private Chef Service | Real Hibachi",
  description: "Premium hibachi at home experience in Seal Beach, Orange County. Professional private chef bringing authentic Japanese teppanyaki and unforgettable memories to your celebration.",
  keywords: "hibachi at home Seal Beach, private chef Orange County, Japanese teppanyaki Seal Beach, hibachi catering OC, private birthday hibachi party Seal Beach",
  openGraph: {
    title: "Hibachi at Home Seal Beach | Orange County Private Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/orange-county/seal-beach",
  },
    description: "Create unforgettable memories with our hibachi at home experience in Seal Beach. Professional private chef, authentic teppanyaki, and emotional celebrations that matter.",
    url: "https://www.realhibachi.com/service-area/orange-county/seal-beach",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Seal Beach - Create Memories That Matter',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Seal Beach | Memories That Matter',
    description: 'Transform your special moments with our hibachi at home experience in Seal Beach, Orange County.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function SealBeachServicePage() {
  return <SealBeachServiceClient />
}