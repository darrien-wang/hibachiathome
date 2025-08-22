import type { Metadata } from "next"
import HermosaBeachServiceClient from "./HermosaBeachServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Hermosa Beach | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Fun and energetic hibachi service in party-loving Hermosa Beach, perfect for celebrations. Professional Japanese teppanyaki experience at your Hermosa Beach location.",
  keywords: "hibachi at home Hermosa Beach, teppanyaki chef Hermosa Beach, Japanese chef Hermosa Beach, hibachi catering Hermosa Beach, private chef Hermosa Beach, hibachi party Hermosa Beach",
  openGraph: {
    title: "Hibachi at Home Hermosa Beach | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Hermosa Beach. Professional Japanese teppanyaki chefs bringing the restaurant experience to your Hermosa Beach location.",
    url: "https://realhibachi.com/service-area/hermosa-beach",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Hermosa Beach - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Hermosa Beach | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Hermosa Beach and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function HermosaBeachServicePage() {
  return <HermosaBeachServiceClient />
}