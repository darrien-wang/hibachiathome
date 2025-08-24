import type { Metadata } from "next"
import SanBernardinoCityServiceClient from "./SanBernardinoCityServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home San Bernardino City | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in San Bernardino City. Professional Japanese teppanyaki chefs for home dining experiences. Historic Route 66 and university community service.",
  keywords: "hibachi at home San Bernardino City, teppanyaki chef San Bernardino, Japanese chef Route 66, hibachi catering university district, private chef downtown San Bernardino",
  openGraph: {
    title: "Hibachi at Home San Bernardino City | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in San Bernardino City. Professional Japanese teppanyaki chefs for university communities and historic downtown.",
    url: "https://realhibachi.com/service-area/san-bernardino/san-bernardino-city",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home San Bernardino City - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home San Bernardino City | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in San Bernardino City. University communities and historic downtown service.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function SanBernardinoCityServicePage() {
  return <SanBernardinoCityServiceClient />
}

