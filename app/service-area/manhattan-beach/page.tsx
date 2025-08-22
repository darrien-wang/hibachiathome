import type { Metadata } from "next"
import ManhattanBeachServiceClient from "./ManhattanBeachServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Manhattan Beach | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Upscale beachside hibachi service in Manhattan Beach, bringing premium dining to luxury coastal homes. Professional Japanese teppanyaki experience at your Manhattan Beach location.",
  keywords: "hibachi at home Manhattan Beach, teppanyaki chef Manhattan Beach, Japanese chef Manhattan Beach, hibachi catering Manhattan Beach, private chef Manhattan Beach, hibachi party Manhattan Beach",
  openGraph: {
    title: "Hibachi at Home Manhattan Beach | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Manhattan Beach. Professional Japanese teppanyaki chefs bringing the restaurant experience to your Manhattan Beach location.",
    url: "https://realhibachi.com/service-area/manhattan-beach",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Manhattan Beach - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Manhattan Beach | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Manhattan Beach and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function ManhattanBeachServicePage() {
  return <ManhattanBeachServiceClient />
}