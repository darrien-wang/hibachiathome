import type { Metadata } from "next"
import ChinoServiceClient from "./ChinoServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Chino | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Chino. Professional Japanese teppanyaki chefs for home dining experiences. Agricultural heritage and family community service.",
  keywords: "hibachi at home Chino, teppanyaki chef dairy farms, Hibachi Chef agricultural heritage, hibachi catering family communities, private chef Old Town Chino",
  openGraph: {
    title: "Hibachi at Home Chino | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Chino. Professional Japanese teppanyaki chefs for agricultural heritage and family communities.",
    url: "https://realhibachi.com/service-area/san-bernardino/chino",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Chino - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Chino | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Chino. Agricultural heritage and family community service.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function ChinoServicePage() {
  return <ChinoServiceClient />
}

