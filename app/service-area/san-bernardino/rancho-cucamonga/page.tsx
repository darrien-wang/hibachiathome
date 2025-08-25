import type { Metadata } from "next"
import RanchoCucamongaServiceClient from "./RanchoCucamongaServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Rancho Cucamonga | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Rancho Cucamonga. Professional Japanese teppanyaki chefs for home dining experiences. Wine country and planned communities service.",
  keywords: "hibachi at home Rancho Cucamonga, teppanyaki chef Alta Loma, Hibachi Chef wine country, hibachi catering Etiwanda, private chef Victoria Gardens",
  openGraph: {
    title: "Hibachi at Home Rancho Cucamonga | Professional Teppanyaki Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/san-bernardino/rancho-cucamonga",
  },
    description: "Experience authentic hibachi at home in Rancho Cucamonga. Professional Japanese teppanyaki chefs for wine country and planned communities.",
    url: "https://www.realhibachi.com/service-area/san-bernardino/rancho-cucamonga",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Rancho Cucamonga - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Rancho Cucamonga | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Rancho Cucamonga. Wine country and planned communities service.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function RanchoCucamongaServicePage() {
  return <RanchoCucamongaServiceClient />
}

