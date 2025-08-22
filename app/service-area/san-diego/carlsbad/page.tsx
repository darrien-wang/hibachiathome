import type { Metadata } from "next"
import CarlsbadServiceClient from "./CarlsbadServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Carlsbad | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Carlsbad including Village Carlsbad, La Costa, Aviara, and surrounding areas. Professional Japanese teppanyaki experience at your home.",
  keywords: "hibachi at home Carlsbad, teppanyaki chef Carlsbad, Japanese chef La Costa, hibachi catering Aviara, private chef Village Carlsbad, hibachi party Carlsbad",
  openGraph: {
    title: "Hibachi at Home Carlsbad | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Carlsbad. Professional Japanese teppanyaki chefs bringing the restaurant experience to your location.",
    url: "https://realhibachi.com/service-area/san-diego/carlsbad",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Carlsbad - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Carlsbad | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service covering Carlsbad, La Costa, Aviara, and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function CarlsbadServicePage() {
  return <CarlsbadServiceClient />
}

