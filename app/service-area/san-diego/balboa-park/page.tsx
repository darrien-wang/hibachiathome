import type { Metadata } from "next"
import BalboaParkServiceClient from "./BalboaParkServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Balboa Park | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Balboa Park including Park West, Golden Hill, Bankers Hill, and surrounding areas. Professional Japanese teppanyaki experience at your home.",
  keywords: "hibachi at home Balboa Park, teppanyaki chef Balboa Park, Japanese chef Park West, hibachi catering Golden Hill, private chef Balboa Park, hibachi party Balboa Park",
  openGraph: {
    title: "Hibachi at Home Balboa Park | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Balboa Park. Professional Japanese teppanyaki chefs bringing the restaurant experience to your location.",
    url: "https://realhibachi.com/service-area/san-diego/balboa-park",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Balboa Park - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Balboa Park | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service covering Balboa Park, Park West, Golden Hill, and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function BalboaParkServicePage() {
  return <BalboaParkServiceClient />
}
