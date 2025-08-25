import type { Metadata } from "next"
import CulverCityServiceClient from "./CulverCityServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Culver City | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Professional hibachi service in the heart of Culver City, perfect for entertainment industry events. Professional Japanese teppanyaki experience at your Culver City location.",
  keywords: "hibachi at home Culver City, teppanyaki chef Culver City, Hibachi Chef Culver City, hibachi catering Culver City, private chef Culver City, hibachi party Culver City",
  openGraph: {
    title: "Hibachi at Home Culver City | Professional Teppanyaki Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/culver-city",
  },
    description: "Experience authentic hibachi at home in Culver City. Professional Japanese teppanyaki chefs bringing the restaurant experience to your Culver City location.",
    url: "https://www.realhibachi.com/service-area/culver-city",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Culver City - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Culver City | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Culver City and surrounding areas.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function CulverCityServicePage() {
  return <CulverCityServiceClient />
}