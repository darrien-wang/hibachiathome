import type { Metadata } from "next"
import MorenoValleyServiceClient from "./MorenoValleyServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Moreno Valley | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Moreno Valley. Professional Japanese teppanyaki chefs for home dining experiences. Fast-growing family community service.",
  keywords: "hibachi at home Moreno Valley, teppanyaki chef Moreno Valley, Japanese chef Sunnymead, hibachi catering family communities, private chef mountain views",
  openGraph: {
    title: "Hibachi at Home Moreno Valley | Professional Teppanyaki Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/riverside/moreno-valley",
  },
    description: "Experience authentic hibachi at home in Moreno Valley. Professional Japanese teppanyaki chefs for family communities and mountain view homes.",
    url: "https://www.realhibachi.com/service-area/riverside/moreno-valley",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Moreno Valley - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Moreno Valley | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Moreno Valley. Family communities and mountain view service.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function MorenoValleyServicePage() {
  return <MorenoValleyServiceClient />
}




