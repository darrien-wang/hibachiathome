import type { Metadata } from "next"
import LagunaNiguelServiceClient from "./LagunaNiguelServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Laguna Niguel | Orange County Private Chef Service | Real Hibachi",
  description: "Premium hibachi at home experience in Laguna Niguel, Orange County. Professional private chef bringing authentic Japanese teppanyaki and unforgettable memories to your celebration.",
  keywords: "hibachi at home Laguna Niguel, private chef Orange County, Japanese teppanyaki Laguna Niguel, hibachi catering OC, private birthday hibachi party Laguna Niguel",
  openGraph: {
    title: "Hibachi at Home Laguna Niguel | Orange County Private Chef Service",
    description: "Create unforgettable memories with our hibachi at home experience in Laguna Niguel. Professional private chef, authentic teppanyaki, and emotional celebrations that matter.",
    url: "https://realhibachi.com/service-area/orange-county/laguna-niguel",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Laguna Niguel - Create Memories That Matter',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Laguna Niguel | Memories That Matter',
    description: 'Transform your special moments with our hibachi at home experience in Laguna Niguel, Orange County.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function LagunaNiguelServicePage() {
  return <LagunaNiguelServiceClient />
}