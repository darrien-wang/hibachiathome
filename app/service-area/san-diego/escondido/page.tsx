import type { Metadata } from "next"
import EscondidoServiceClient from "./EscondidoServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Escondido | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Escondido including Downtown Escondido, Hidden Meadows, San Pasqual Valley, and surrounding areas. Professional Japanese teppanyaki experience at your home.",
  keywords: "hibachi at home Escondido, teppanyaki chef Escondido, Japanese chef Hidden Meadows, hibachi catering San Pasqual Valley, private chef Escondido, hibachi party Escondido",
  openGraph: {
    title: "Hibachi at Home Escondido | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Escondido. Professional Japanese teppanyaki chefs bringing the restaurant experience to your location.",
    url: "https://realhibachi.com/service-area/san-diego/escondido",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Escondido - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Escondido | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service covering Escondido, Hidden Meadows, and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function EscondidoServicePage() {
  return <EscondidoServiceClient />
}

