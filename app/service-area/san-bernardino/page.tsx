import type { Metadata } from "next"
import SanBernardinoServiceClient from "./SanBernardinoServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home San Bernardino | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in San Bernardino including Redlands, Fontana, Rialto, Highland, and mountain region communities. Professional Japanese teppanyaki experience.",
  keywords: "hibachi at home San Bernardino, teppanyaki chef mountain region, Japanese chef Redlands, hibachi catering Fontana, private chef Rialto, hibachi party San Bernardino County",
  openGraph: {
    title: "Hibachi at Home San Bernardino | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in San Bernardino and mountain region. Professional Japanese teppanyaki chefs for San Bernardino County communities.",
    url: "https://realhibachi.com/service-area/san-bernardino",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home San Bernardino - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home San Bernardino | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service covering San Bernardino, Redlands, Fontana, and mountain communities.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function SanBernardinoServicePage() {
  return <SanBernardinoServiceClient />
}
