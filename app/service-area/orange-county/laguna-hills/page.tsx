import type { Metadata } from "next"
import LagunaHillsServiceClient from "./LagunaHillsServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Laguna Hills | Orange County Private Chef Service | Real Hibachi",
  description: "Premium hibachi at home experience in Laguna Hills, Orange County. Professional private chef bringing authentic Japanese teppanyaki and unforgettable memories to your celebration.",
  keywords: "hibachi at home Laguna Hills, private chef Orange County, Japanese teppanyaki Laguna Hills, hibachi catering OC, private birthday hibachi party Laguna Hills",
  openGraph: {
    title: "Hibachi at Home Laguna Hills | Orange County Private Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/orange-county/laguna-hills",
  },
    description: "Create unforgettable memories with our hibachi at home experience in Laguna Hills. Professional private chef, authentic teppanyaki, and emotional celebrations that matter.",
    url: "https://www.realhibachi.com/service-area/orange-county/laguna-hills",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Laguna Hills - Create Memories That Matter',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Laguna Hills | Memories That Matter',
    description: 'Transform your special moments with our hibachi at home experience in Laguna Hills, Orange County.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function LagunaHillsServicePage() {
  return <LagunaHillsServiceClient />
}