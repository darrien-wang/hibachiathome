import type { Metadata } from "next"
import AnaheimServiceClient from "./AnaheimServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Anaheim | Orange County Private Chef Service | Real Hibachi",
  description: "Premium hibachi at home experience in Anaheim, Orange County. Professional private chef bringing authentic Japanese teppanyaki and unforgettable memories to your celebration.",
  keywords: "hibachi at home Anaheim, private chef Orange County, Japanese teppanyaki Anaheim, hibachi catering OC, private birthday hibachi party Anaheim",
  openGraph: {
    title: "Hibachi at Home Anaheim | Orange County Private Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/orange-county/anaheim",
  },
    description: "Create unforgettable memories with our hibachi at home experience in Anaheim. Professional private chef, authentic teppanyaki, and emotional celebrations that matter.",
    url: "https://www.realhibachi.com/service-area/orange-county/anaheim",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Anaheim - Create Memories That Matter',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Anaheim | Memories That Matter',
    description: 'Transform your special moments with our hibachi at home experience in Anaheim, Orange County.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function AnaheimServicePage() {
  return <AnaheimServiceClient />
}