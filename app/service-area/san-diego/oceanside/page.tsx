import type { Metadata } from "next"
import OceansideServiceClient from "./OceansideServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Oceanside | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Oceanside including Downtown Oceanside, Fire Mountain, and surrounding areas. Professional Japanese teppanyaki experience at your home.",
  keywords: "hibachi at home Oceanside, teppanyaki chef Oceanside, Hibachi Chef Oceanside, hibachi catering military family, private chef Oceanside, hibachi party Oceanside",
  openGraph: {
    title: "Hibachi at Home Oceanside | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Oceanside. Professional Japanese teppanyaki chefs bringing the restaurant experience to your location.",
    url: "https://realhibachi.com/service-area/san-diego/oceanside",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Oceanside - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Oceanside | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service covering Oceanside, Downtown Oceanside, and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function OceansideServicePage() {
  return <OceansideServiceClient />
}

