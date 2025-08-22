import type { Metadata } from "next"
import PacificBeachServiceClient from "./PacificBeachServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Pacific Beach | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Pacific Beach including Pacific Beach Proper, North Pacific Beach, Crown Point, and surrounding areas. Professional Japanese teppanyaki experience at your home.",
  keywords: "hibachi at home Pacific Beach, teppanyaki chef Pacific Beach, Japanese chef Pacific Beach Proper, hibachi catering Crown Point, private chef Pacific Beach, hibachi party Pacific Beach",
  openGraph: {
    title: "Hibachi at Home Pacific Beach | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Pacific Beach. Professional Japanese teppanyaki chefs bringing the restaurant experience to your location.",
    url: "https://realhibachi.com/service-area/san-diego/pacific-beach",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Pacific Beach - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Pacific Beach | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service covering Pacific Beach Proper, Crown Point, and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function PacificBeachServicePage() {
  return <PacificBeachServiceClient />
}
