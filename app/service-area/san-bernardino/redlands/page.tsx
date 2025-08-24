import type { Metadata } from "next"
import RedlandsServiceClient from "./RedlandsServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Redlands | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Redlands. Professional Japanese teppanyaki chefs for home dining experiences. Historic Victorian and university community service.",
  keywords: "hibachi at home Redlands, teppanyaki chef University of Redlands, Japanese chef Victorian homes, hibachi catering citrus heritage, private chef downtown Redlands",
  openGraph: {
    title: "Hibachi at Home Redlands | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Redlands. Professional Japanese teppanyaki chefs for historic Victorian and university communities.",
    url: "https://realhibachi.com/service-area/san-bernardino/redlands",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Redlands - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Redlands | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Redlands. Historic Victorian and university community service.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function RedlandsServicePage() {
  return <RedlandsServiceClient />
}

