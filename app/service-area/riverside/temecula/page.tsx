import type { Metadata } from "next"
import TemeculaServiceClient from "./TemeculaServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Temecula | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Temecula. Professional Japanese teppanyaki chefs for home dining experiences. Famous wine country with beautiful vineyards service.",
  keywords: "hibachi at home Temecula, teppanyaki chef Temecula, Japanese chef wine country, hibachi catering vineyard celebrations, private chef Old Town Temecula",
  openGraph: {
    title: "Hibachi at Home Temecula | Professional Teppanyaki Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/riverside/temecula",
  },
    description: "Experience authentic hibachi at home in Temecula. Professional Japanese teppanyaki chefs for wine country celebrations and vineyard events.",
    url: "https://www.realhibachi.com/service-area/riverside/temecula",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Temecula - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Temecula | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Temecula. Wine country and vineyard celebrations.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function TemeculaServicePage() {
  return <TemeculaServiceClient />
}




