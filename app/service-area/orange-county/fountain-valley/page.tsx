import type { Metadata } from "next"
import FountainValleyServiceClient from "./FountainValleyServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Fountain Valley | Orange County Private Chef Service | Real Hibachi",
  description: "Premium hibachi at home experience in Fountain Valley, Orange County. Professional private chef bringing authentic Japanese teppanyaki and unforgettable memories to your celebration.",
  keywords: "hibachi at home Fountain Valley, private chef Orange County, Japanese teppanyaki Fountain Valley, hibachi catering OC, private birthday hibachi party Fountain Valley",
  openGraph: {
    title: "Hibachi at Home Fountain Valley | Orange County Private Chef Service",
    description: "Create unforgettable memories with our hibachi at home experience in Fountain Valley. Professional private chef, authentic teppanyaki, and emotional celebrations that matter.",
    url: "https://realhibachi.com/service-area/orange-county/fountain-valley",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Fountain Valley - Create Memories That Matter',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Fountain Valley | Memories That Matter',
    description: 'Transform your special moments with our hibachi at home experience in Fountain Valley, Orange County.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function FountainValleyServicePage() {
  return <FountainValleyServiceClient />
}