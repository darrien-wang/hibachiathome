import type { Metadata } from "next"
import SanDiegoCityServiceClient from "./SanDiegoCityServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home San Diego City | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in San Diego including Downtown, Gaslamp Quarter, Little Italy, Hillcrest, and surrounding areas. Professional Japanese teppanyaki experience at your home.",
  keywords: "hibachi at home San Diego, teppanyaki chef San Diego, Japanese chef downtown San Diego, hibachi catering Gaslamp Quarter, private chef Little Italy, hibachi party San Diego city",
  openGraph: {
    title: "Hibachi at Home San Diego City | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in San Diego. Professional Japanese teppanyaki chefs bringing the restaurant experience to your location.",
    url: "https://realhibachi.com/service-area/san-diego/san-diego-city",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home San Diego City - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home San Diego City | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service covering San Diego, Downtown, Gaslamp Quarter, and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function SanDiegoCityServicePage() {
  return <SanDiegoCityServiceClient />
}

