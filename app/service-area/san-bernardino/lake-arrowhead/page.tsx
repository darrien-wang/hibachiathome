import type { Metadata } from "next"
import LakeArrowheadServiceClient from "./LakeArrowheadServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Lake Arrowhead | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Lake Arrowhead. Professional Japanese teppanyaki chefs for home dining experiences. Premier mountain resort and alpine lake service.",
  keywords: "hibachi at home Lake Arrowhead, teppanyaki chef mountain resort, Japanese chef alpine lake, hibachi catering village shopping, private chef lakefront",
  openGraph: {
    title: "Hibachi at Home Lake Arrowhead | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Lake Arrowhead. Professional Japanese teppanyaki chefs for premier mountain resort and alpine lake communities.",
    url: "https://realhibachi.com/service-area/san-bernardino/lake-arrowhead",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Lake Arrowhead - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Lake Arrowhead | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Lake Arrowhead. Premier mountain resort and alpine lake service.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function LakeArrowheadServicePage() {
  return <LakeArrowheadServiceClient />
}

