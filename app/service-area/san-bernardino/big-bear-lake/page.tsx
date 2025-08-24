import type { Metadata } from "next"
import BigBearLakeServiceClient from "./BigBearLakeServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Big Bear Lake | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Big Bear Lake. Professional Japanese teppanyaki chefs for home dining experiences. World-class skiing and alpine recreation service.",
  keywords: "hibachi at home Big Bear Lake, teppanyaki chef skiing resort, Japanese chef Snow Summit, hibachi catering mountain cabin, private chef alpine recreation",
  openGraph: {
    title: "Hibachi at Home Big Bear Lake | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Big Bear Lake. Professional Japanese teppanyaki chefs for world-class skiing and alpine recreation communities.",
    url: "https://realhibachi.com/service-area/san-bernardino/big-bear-lake",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Big Bear Lake - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Big Bear Lake | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Big Bear Lake. World-class skiing and alpine recreation service.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function BigBearLakeServicePage() {
  return <BigBearLakeServiceClient />
}

