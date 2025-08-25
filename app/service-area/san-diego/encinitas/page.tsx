import type { Metadata } from "next"
import EncinitasServiceClient from "./EncinitasServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Encinitas | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Encinitas including Downtown Encinitas, Leucadia, Cardiff, and surrounding areas. Professional Japanese teppanyaki experience at your home.",
  keywords: "hibachi at home Encinitas, teppanyaki chef Encinitas, Hibachi Chef Leucadia, hibachi catering Cardiff, private chef Encinitas, hibachi party Encinitas",
  openGraph: {
    title: "Hibachi at Home Encinitas | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Encinitas. Professional Japanese teppanyaki chefs bringing the restaurant experience to your location.",
    url: "https://realhibachi.com/service-area/san-diego/encinitas",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Encinitas - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Encinitas | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service covering Encinitas, Leucadia, Cardiff, and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function EncinitasServicePage() {
  return <EncinitasServiceClient />
}

