import type { Metadata } from "next"
import SanDiegoServiceClient from "./SanDiegoServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home San Diego | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in San Diego including La Jolla, Del Mar, Encinitas, Carlsbad, and surrounding areas. Professional Japanese teppanyaki experience at your home.",
  keywords: "hibachi at home San Diego, teppanyaki chef SD, Hibachi Chef La Jolla, hibachi catering Del Mar, private chef Encinitas, hibachi party San Diego County",
  openGraph: {
    title: "Hibachi at Home San Diego | Professional Teppanyaki Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/san-diego",
  },
    description: "Experience authentic hibachi at home in San Diego. Professional Japanese teppanyaki chefs bringing the restaurant experience to your location.",
    url: "https://www.realhibachi.com/service-area/san-diego",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home San Diego - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home San Diego | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service covering San Diego, La Jolla, Del Mar, and surrounding areas.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function SanDiegoServicePage() {
  return <SanDiegoServiceClient />
}

