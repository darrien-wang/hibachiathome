import type { Metadata } from "next"
import BigBearLakeServiceClient from "./BigBearLakeServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Big Bear Lake | Mountain Resort Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Big Bear Lake. Professional Japanese teppanyaki chefs for mountain resort celebrations, vacation rentals, and cabin gatherings in Southern California's premier mountain destination.",
  keywords: "hibachi at home Big Bear Lake, teppanyaki chef mountain resort, Japanese chef vacation rental, hibachi catering cabin party, private chef ski lodge",
  openGraph: {
    title: "Hibachi at Home Big Bear Lake | Mountain Resort Teppanyaki Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/san-bernardino/big-bear-lake",
  },
    description: "Experience authentic hibachi at home in Big Bear Lake. Professional Japanese teppanyaki chefs for mountain resort celebrations and vacation rental gatherings.",
    url: "https://www.realhibachi.com/service-area/san-bernardino/big-bear-lake",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Big Bear Lake - Mountain Resort Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Big Bear Lake | Mountain Resort Teppanyaki Chef',
    description: 'Premium hibachi chef service in Big Bear Lake. Mountain resort and vacation rental celebrations.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function BigBearLakeServicePage() {
  return <BigBearLakeServiceClient />
}











