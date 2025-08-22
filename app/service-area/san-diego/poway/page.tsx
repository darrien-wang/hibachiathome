import type { Metadata } from "next"
import PowayServiceClient from "./PowayServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Poway | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Poway including Old Poway, Stoneridge, Torrey Highlands, 4S Ranch, and surrounding areas. Professional Japanese teppanyaki experience at your home.",
  keywords: "hibachi at home Poway, teppanyaki chef Poway, Japanese chef 4S Ranch, hibachi catering Torrey Highlands, private chef Poway, hibachi party Poway",
  openGraph: {
    title: "Hibachi at Home Poway | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Poway. Professional Japanese teppanyaki chefs bringing the restaurant experience to your location.",
    url: "https://realhibachi.com/service-area/san-diego/poway",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Poway - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Poway | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service covering Poway, 4S Ranch, Torrey Highlands, and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function PowayServicePage() {
  return <PowayServiceClient />
}

