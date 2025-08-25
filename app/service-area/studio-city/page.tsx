import type { Metadata } from "next"
import StudioCityServiceClient from "./StudioCityServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Studio City | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Creative hibachi experiences in entertainment-focused Studio City, perfect for industry professionals. Professional Japanese teppanyaki experience at your Studio City location.",
  keywords: "hibachi at home Studio City, teppanyaki chef Studio City, Hibachi Chef Studio City, hibachi catering Studio City, private chef Studio City, hibachi party Studio City",
  openGraph: {
    title: "Hibachi at Home Studio City | Professional Teppanyaki Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/studio-city",
  },
    description: "Experience authentic hibachi at home in Studio City. Professional Japanese teppanyaki chefs bringing the restaurant experience to your Studio City location.",
    url: "https://www.realhibachi.com/service-area/studio-city",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Studio City - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Studio City | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Studio City and surrounding areas.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function StudioCityServicePage() {
  return <StudioCityServiceClient />
}