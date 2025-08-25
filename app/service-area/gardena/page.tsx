import type { Metadata } from "next"
import GardenaServiceClient from "./GardenaServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Gardena | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Multicultural hibachi experience in diverse Gardena, celebrating the area's Japanese heritage and modern diversity. Professional Japanese teppanyaki experience at your Gardena location.",
  keywords: "hibachi at home Gardena, teppanyaki chef Gardena, Hibachi Chef Gardena, hibachi catering Gardena, private chef Gardena, hibachi party Gardena",
  openGraph: {
    title: "Hibachi at Home Gardena | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Gardena. Professional Japanese teppanyaki chefs bringing the restaurant experience to your Gardena location.",
    url: "https://realhibachi.com/service-area/gardena",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Gardena - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Gardena | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Gardena and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function GardenaServicePage() {
  return <GardenaServiceClient />
}