import type { Metadata } from "next"
import NewportBeachServiceClient from "./NewportBeachServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Newport Beach | Orange County Private Chef Service | Real Hibachi",
  description: "Premium hibachi at home experience in Newport Beach, Orange County. Professional private chef bringing authentic Japanese teppanyaki and unforgettable memories to your celebration.",
  keywords: "hibachi at home Newport Beach, private chef Orange County, Japanese teppanyaki Newport Beach, hibachi catering OC, private birthday hibachi party Newport Beach",
  openGraph: {
    title: "Hibachi at Home Newport Beach | Orange County Private Chef Service",
    description: "Create unforgettable memories with our hibachi at home experience in Newport Beach. Professional private chef, authentic teppanyaki, and emotional celebrations that matter.",
    url: "https://realhibachi.com/service-area/orange-county/newport-beach",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Newport Beach - Create Memories That Matter',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Newport Beach | Memories That Matter',
    description: 'Transform your special moments with our hibachi at home experience in Newport Beach, Orange County.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function NewportBeachServicePage() {
  return <NewportBeachServiceClient />
}