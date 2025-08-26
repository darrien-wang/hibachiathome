import type { Metadata } from "next"
import LakeArrowheadServiceClient from "./LakeArrowheadServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Lake Arrowhead | Luxury Mountain Resort Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Lake Arrowhead. Professional Japanese teppanyaki chefs for luxury mountain homes, lakefront properties, and exclusive resort celebrations in this prestigious alpine community.",
  keywords: "hibachi at home Lake Arrowhead, teppanyaki chef luxury mountain resort, Japanese chef lakefront property, hibachi catering exclusive community, private chef alpine retreat",
  openGraph: {
    title: "Hibachi at Home Lake Arrowhead | Luxury Mountain Resort Teppanyaki Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/san-bernardino/lake-arrowhead",
  },
    description: "Experience authentic hibachi at home in Lake Arrowhead. Professional Japanese teppanyaki chefs for luxury mountain celebrations and lakefront gatherings.",
    url: "https://www.realhibachi.com/service-area/san-bernardino/lake-arrowhead",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Lake Arrowhead - Luxury Mountain Resort Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Lake Arrowhead | Luxury Mountain Resort Teppanyaki Chef',
    description: 'Premium hibachi chef service in Lake Arrowhead. Luxury mountain homes and lakefront celebrations.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function LakeArrowheadServicePage() {
  return <LakeArrowheadServiceClient />
}










