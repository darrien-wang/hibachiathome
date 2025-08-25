import type { Metadata } from "next"
import RiversideCityServiceClient from "./RiversideCityServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Riverside City | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Riverside City. Professional Japanese teppanyaki chefs for home dining experiences. Historic citrus capital and university community service.",
  keywords: "hibachi at home Riverside City, teppanyaki chef Riverside, Hibachi Chef UC Riverside, hibachi catering downtown Riverside, private chef university area",
  openGraph: {
    title: "Hibachi at Home Riverside City | Professional Teppanyaki Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/riverside/riverside-city",
  },
    description: "Experience authentic hibachi at home in Riverside City. Professional Japanese teppanyaki chefs for university communities and historic downtown.",
    url: "https://www.realhibachi.com/service-area/riverside/riverside-city",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Riverside City - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Riverside City | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Riverside City. University communities and historic downtown service.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function RiversideCityServicePage() {
  return <RiversideCityServiceClient />
}




