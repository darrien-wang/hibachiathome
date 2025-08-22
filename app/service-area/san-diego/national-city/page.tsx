import type { Metadata } from "next"
import NationalCityServiceClient from "./NationalCityServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home National City | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in National City including Downtown National City, Lincoln Acres, Paradise Hills, and surrounding areas. Professional Japanese teppanyaki experience at your home.",
  keywords: "hibachi at home National City, teppanyaki chef National City, Japanese chef Downtown National City, hibachi catering Lincoln Acres, private chef National City, hibachi party National City",
  openGraph: {
    title: "Hibachi at Home National City | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in National City. Professional Japanese teppanyaki chefs bringing the restaurant experience to your location.",
    url: "https://realhibachi.com/service-area/san-diego/national-city",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home National City - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home National City | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service covering National City, Downtown National City, and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function NationalCityServicePage() {
  return <NationalCityServiceClient />
}
