import type { Metadata } from "next"
import LosAngelesCityServiceClient from "./LosAngelesCityServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Los Angeles City | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Los Angeles City including Downtown, Hollywood, Koreatown, and surrounding neighborhoods. Professional Japanese teppanyaki experience at your location.",
  keywords: "hibachi at home Los Angeles City, teppanyaki chef downtown LA, Hibachi Chef Hollywood, hibachi catering Koreatown, private chef Los Angeles, hibachi party LA city",
  openGraph: {
    title: "Hibachi at Home Los Angeles City | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Los Angeles City. Professional Japanese teppanyaki chefs bringing the restaurant experience to downtown LA, Hollywood, and surrounding areas.",
    url: "https://realhibachi.com/service-area/los-angeles-city",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Los Angeles City - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Los Angeles City | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service covering Los Angeles City, Downtown, Hollywood, Koreatown, and surrounding neighborhoods.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function LosAngelesCityServicePage() {
  return <LosAngelesCityServiceClient />
}
