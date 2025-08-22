import type { Metadata } from "next"
import LaJollaServiceClient from "./LaJollaServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home La Jolla | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in La Jolla including La Jolla Village, La Jolla Shores, La Jolla Cove, and surrounding areas. Professional Japanese teppanyaki experience at your home.",
  keywords: "hibachi at home La Jolla, teppanyaki chef La Jolla, Japanese chef La Jolla Village, hibachi catering La Jolla Shores, private chef La Jolla Cove, hibachi party La Jolla",
  openGraph: {
    title: "Hibachi at Home La Jolla | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in La Jolla. Professional Japanese teppanyaki chefs bringing the restaurant experience to your location.",
    url: "https://realhibachi.com/service-area/san-diego/la-jolla",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home La Jolla - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home La Jolla | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service covering La Jolla Village, La Jolla Shores, and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function LaJollaServicePage() {
  return <LaJollaServiceClient />
}

