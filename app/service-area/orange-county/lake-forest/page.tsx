import type { Metadata } from "next"
import LakeForestServiceClient from "./LakeForestServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Lake Forest | Orange County Private Chef Service | Real Hibachi",
  description: "Premium hibachi at home experience in Lake Forest, Orange County. Professional private chef bringing authentic Japanese teppanyaki and unforgettable memories to your celebration.",
  keywords: "hibachi at home Lake Forest, private chef Orange County, Japanese teppanyaki Lake Forest, hibachi catering OC, private birthday hibachi party Lake Forest",
  openGraph: {
    title: "Hibachi at Home Lake Forest | Orange County Private Chef Service",
    description: "Create unforgettable memories with our hibachi at home experience in Lake Forest. Professional private chef, authentic teppanyaki, and emotional celebrations that matter.",
    url: "https://realhibachi.com/service-area/orange-county/lake-forest",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Lake Forest - Create Memories That Matter',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Lake Forest | Memories That Matter',
    description: 'Transform your special moments with our hibachi at home experience in Lake Forest, Orange County.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function LakeForestServicePage() {
  return <LakeForestServiceClient />
}