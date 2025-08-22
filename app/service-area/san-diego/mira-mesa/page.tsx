import type { Metadata } from "next"
import MiraMesaServiceClient from "./MiraMesaServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Mira Mesa | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Mira Mesa including Mira Mesa Boulevard, Camino Ruiz, Black Mountain Ranch, and surrounding areas. Professional Japanese teppanyaki experience at your home.",
  keywords: "hibachi at home Mira Mesa, teppanyaki chef Mira Mesa, Japanese chef Black Mountain Ranch, hibachi catering Camino Ruiz, private chef Mira Mesa, hibachi party Mira Mesa",
  openGraph: {
    title: "Hibachi at Home Mira Mesa | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Mira Mesa. Professional Japanese teppanyaki chefs bringing the restaurant experience to your location.",
    url: "https://realhibachi.com/service-area/san-diego/mira-mesa",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Mira Mesa - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Mira Mesa | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service covering Mira Mesa, Black Mountain Ranch, and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function MiraMesaServicePage() {
  return <MiraMesaServiceClient />
}
