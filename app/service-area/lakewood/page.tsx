import type { Metadata } from "next"
import LakewoodServiceClient from "./LakewoodServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Lakewood | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Suburban hibachi service in family-friendly Lakewood, bringing restaurant-quality dining to your neighborhood home. Professional Japanese teppanyaki experience at your Lakewood location.",
  keywords: "hibachi at home Lakewood, teppanyaki chef Lakewood, Hibachi Chef Lakewood, hibachi catering Lakewood, private chef Lakewood, hibachi party Lakewood",
  openGraph: {
    title: "Hibachi at Home Lakewood | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Lakewood. Professional Japanese teppanyaki chefs bringing the restaurant experience to your Lakewood location.",
    url: "https://realhibachi.com/service-area/lakewood",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Lakewood - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Lakewood | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Lakewood and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function LakewoodServicePage() {
  return <LakewoodServiceClient />
}