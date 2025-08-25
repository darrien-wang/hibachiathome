import type { Metadata } from "next"
import SouthPasadenaServiceClient from "./SouthPasadenaServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home South Pasadena | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Quaint community hibachi service in charming South Pasadena, perfect for intimate family gatherings. Professional Japanese teppanyaki experience at your South Pasadena location.",
  keywords: "hibachi at home South Pasadena, teppanyaki chef South Pasadena, Hibachi Chef South Pasadena, hibachi catering South Pasadena, private chef South Pasadena, hibachi party South Pasadena",
  openGraph: {
    title: "Hibachi at Home South Pasadena | Professional Teppanyaki Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/south-pasadena",
  },
    description: "Experience authentic hibachi at home in South Pasadena. Professional Japanese teppanyaki chefs bringing the restaurant experience to your South Pasadena location.",
    url: "https://www.realhibachi.com/service-area/south-pasadena",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home South Pasadena - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home South Pasadena | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in South Pasadena and surrounding areas.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function SouthPasadenaServicePage() {
  return <SouthPasadenaServiceClient />
}