import type { Metadata } from "next"
import LaPalmaServiceClient from "./LaPalmaServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home La Palma | Orange County Private Chef Service | Real Hibachi",
  description: "Premium hibachi at home experience in La Palma, Orange County. Professional private chef bringing authentic Japanese teppanyaki and unforgettable memories to your celebration.",
  keywords: "hibachi at home La Palma, private chef Orange County, Japanese teppanyaki La Palma, hibachi catering OC, private birthday hibachi party La Palma",
  openGraph: {
    title: "Hibachi at Home La Palma | Orange County Private Chef Service",
    description: "Create unforgettable memories with our hibachi at home experience in La Palma. Professional private chef, authentic teppanyaki, and emotional celebrations that matter.",
    url: "https://realhibachi.com/service-area/orange-county/la-palma",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home La Palma - Create Memories That Matter',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home La Palma | Memories That Matter',
    description: 'Transform your special moments with our hibachi at home experience in La Palma, Orange County.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function LaPalmaServicePage() {
  return <LaPalmaServiceClient />
}