import type { Metadata } from "next"
import SanPedroServiceClient from "./SanPedroServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home San Pedro | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in San Pedro. Professional Japanese teppanyaki chefs for home dining experiences. Historic port community and maritime heritage service.",
  keywords: "hibachi at home San Pedro, teppanyaki chef port community, Hibachi Chef harbor district, hibachi catering Cabrillo Beach, private chef maritime heritage",
  openGraph: {
    title: "Hibachi at Home San Pedro | Professional Teppanyaki Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/san-pedro",
  },
    description: "Experience authentic hibachi at home in San Pedro. Professional Japanese teppanyaki chefs for historic port community and maritime heritage.",
    url: "https://www.realhibachi.com/service-area/san-pedro",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home San Pedro - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home San Pedro | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in San Pedro. Historic port community and maritime heritage service.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function SanPedroServicePage() {
  return <SanPedroServiceClient />
}








