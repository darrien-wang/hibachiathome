import type { Metadata } from "next"
import CarsonServiceClient from "./CarsonServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Carson | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Family-oriented hibachi service in suburban Carson, perfect for community celebrations and family gatherings. Professional Japanese teppanyaki experience at your Carson location.",
  keywords: "hibachi at home Carson, teppanyaki chef Carson, Hibachi Chef Carson, hibachi catering Carson, private chef Carson, hibachi party Carson",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/carson",
  },
  openGraph: {
    title: "Hibachi at Home Carson | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Carson. Professional Japanese teppanyaki chefs bringing the restaurant experience to your Carson location.",
    url: "https://www.realhibachi.com/service-area/carson",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Carson - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Carson | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Carson and surrounding areas.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function CarsonServicePage() {
  return <CarsonServiceClient />
}