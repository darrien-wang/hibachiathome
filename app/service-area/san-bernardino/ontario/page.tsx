import type { Metadata } from "next"
import OntarioServiceClient from "./OntarioServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Ontario | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Ontario. Professional Japanese teppanyaki chefs for home dining experiences. International Airport and business district service.",
  keywords: "hibachi at home Ontario, teppanyaki chef Ontario, Hibachi Chef airport area, hibachi catering business district, private chef Model Colony",
  openGraph: {
    title: "Hibachi at Home Ontario | Professional Teppanyaki Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/san-bernardino/ontario",
  },
    description: "Experience authentic hibachi at home in Ontario. Professional Japanese teppanyaki chefs for airport area and business communities.",
    url: "https://www.realhibachi.com/service-area/san-bernardino/ontario",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Ontario - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Ontario | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Ontario. Airport gateway and business hub service.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function OntarioServicePage() {
  return <OntarioServiceClient />
}

