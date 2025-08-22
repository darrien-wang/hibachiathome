import type { Metadata } from "next"
import RedondoBeachServiceClient from "./RedondoBeachServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Redondo Beach | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Relaxed hibachi dining experience in family-friendly Redondo Beach with coastal charm. Professional Japanese teppanyaki experience at your Redondo Beach location.",
  keywords: "hibachi at home Redondo Beach, teppanyaki chef Redondo Beach, Japanese chef Redondo Beach, hibachi catering Redondo Beach, private chef Redondo Beach, hibachi party Redondo Beach",
  openGraph: {
    title: "Hibachi at Home Redondo Beach | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Redondo Beach. Professional Japanese teppanyaki chefs bringing the restaurant experience to your Redondo Beach location.",
    url: "https://realhibachi.com/service-area/redondo-beach",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Redondo Beach - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Redondo Beach | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Redondo Beach and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function RedondoBeachServicePage() {
  return <RedondoBeachServiceClient />
}