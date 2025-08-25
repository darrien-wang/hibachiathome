import type { Metadata } from "next"
import LaHabraServiceClient from "./LaHabraServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home La Habra | Orange County Private Chef Service | Real Hibachi",
  description: "Premium hibachi at home experience in La Habra, Orange County. Professional private chef bringing authentic Japanese teppanyaki and unforgettable memories to your celebration.",
  keywords: "hibachi at home La Habra, private chef Orange County, Japanese teppanyaki La Habra, hibachi catering OC, private birthday hibachi party La Habra",
  openGraph: {
    title: "Hibachi at Home La Habra | Orange County Private Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/orange-county/la-habra",
  },
    description: "Create unforgettable memories with our hibachi at home experience in La Habra. Professional private chef, authentic teppanyaki, and emotional celebrations that matter.",
    url: "https://www.realhibachi.com/service-area/orange-county/la-habra",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home La Habra - Create Memories That Matter',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home La Habra | Memories That Matter',
    description: 'Transform your special moments with our hibachi at home experience in La Habra, Orange County.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function LaHabraServicePage() {
  return <LaHabraServiceClient />
}