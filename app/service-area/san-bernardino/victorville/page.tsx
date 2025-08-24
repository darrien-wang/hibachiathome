import type { Metadata } from "next"
import VictorvilleServiceClient from "./VictorvilleServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Victorville | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Victorville. Professional Japanese teppanyaki chefs for home dining experiences. High desert lifestyle and transportation hub service.",
  keywords: "hibachi at home Victorville, teppanyaki chef high desert, Japanese chef Route 66, hibachi catering Spring Valley Lake, private chef Mojave Desert",
  openGraph: {
    title: "Hibachi at Home Victorville | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Victorville. Professional Japanese teppanyaki chefs for high desert and transportation communities.",
    url: "https://realhibachi.com/service-area/san-bernardino/victorville",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Victorville - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Victorville | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Victorville. High desert lifestyle and transportation hub service.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function VictorvilleServicePage() {
  return <VictorvilleServiceClient />
}

