import type { Metadata } from "next"
import TustinServiceClient from "./TustinServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Tustin | Orange County Private Chef Service | Real Hibachi",
  description: "Premium hibachi at home experience in Tustin, Orange County. Professional private chef bringing authentic Japanese teppanyaki and unforgettable memories to your celebration.",
  keywords: "hibachi at home Tustin, private chef Orange County, Japanese teppanyaki Tustin, hibachi catering OC, private birthday hibachi party Tustin",
  openGraph: {
    title: "Hibachi at Home Tustin | Orange County Private Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/orange-county/tustin",
  },
    description: "Create unforgettable memories with our hibachi at home experience in Tustin. Professional private chef, authentic teppanyaki, and emotional celebrations that matter.",
    url: "https://www.realhibachi.com/service-area/orange-county/tustin",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Tustin - Create Memories That Matter',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Tustin | Memories That Matter',
    description: 'Transform your special moments with our hibachi at home experience in Tustin, Orange County.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function TustinServicePage() {
  return <TustinServiceClient />
}