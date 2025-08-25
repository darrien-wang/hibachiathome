import type { Metadata } from "next"
import FontanaServiceClient from "./FontanaServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Fontana | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Fontana. Professional Japanese teppanyaki chefs for home dining experiences. Major logistics hub and family community service.",
  keywords: "hibachi at home Fontana, teppanyaki chef Fontana, Hibachi Chef Route 66, hibachi catering family communities, private chef logistics district",
  openGraph: {
    title: "Hibachi at Home Fontana | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Fontana. Professional Japanese teppanyaki chefs for family communities and logistics hub areas.",
    url: "https://realhibachi.com/service-area/san-bernardino/fontana",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Fontana - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Fontana | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Fontana. Family communities and logistics hub service.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function FontanaServicePage() {
  return <FontanaServiceClient />
}

