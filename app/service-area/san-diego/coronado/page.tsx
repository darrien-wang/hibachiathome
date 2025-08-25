import type { Metadata } from "next"
import CoronadoServiceClient from "./CoronadoServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Coronado | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Coronado including Coronado Village, Coronado Shores, and surrounding areas. Professional Japanese teppanyaki experience at your home.",
  keywords: "hibachi at home Coronado, teppanyaki chef Coronado, Hibachi Chef Coronado Village, hibachi catering Coronado Shores, private chef Coronado, hibachi party Coronado",
  openGraph: {
    title: "Hibachi at Home Coronado | Professional Teppanyaki Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/san-diego/coronado",
  },
    description: "Experience authentic hibachi at home in Coronado. Professional Japanese teppanyaki chefs bringing the restaurant experience to your location.",
    url: "https://www.realhibachi.com/service-area/san-diego/coronado",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Coronado - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Coronado | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service covering Coronado Village, Coronado Shores, and surrounding areas.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function CoronadoServicePage() {
  return <CoronadoServiceClient />
}

