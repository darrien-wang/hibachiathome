import type { Metadata } from "next"
import FullertonServiceClient from "./FullertonServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Fullerton | Orange County Private Chef Service | Real Hibachi",
  description: "Premium hibachi at home experience in Fullerton, Orange County. Professional private chef bringing authentic Japanese teppanyaki and unforgettable memories to your celebration.",
  keywords: "hibachi at home Fullerton, private chef Orange County, Japanese teppanyaki Fullerton, hibachi catering OC, private birthday hibachi party Fullerton",
  openGraph: {
    title: "Hibachi at Home Fullerton | Orange County Private Chef Service",
    description: "Create unforgettable memories with our hibachi at home experience in Fullerton. Professional private chef, authentic teppanyaki, and emotional celebrations that matter.",
    url: "https://realhibachi.com/service-area/orange-county/fullerton",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Fullerton - Create Memories That Matter',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Fullerton | Memories That Matter',
    description: 'Transform your special moments with our hibachi at home experience in Fullerton, Orange County.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function FullertonServicePage() {
  return <FullertonServiceClient />
}