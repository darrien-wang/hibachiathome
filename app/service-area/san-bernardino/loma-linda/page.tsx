import type { Metadata } from "next"
import LomaLindaServiceClient from "./LomaLindaServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Loma Linda | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Loma Linda. Professional Japanese teppanyaki chefs for home dining experiences. Medical university and health community service.",
  keywords: "hibachi at home Loma Linda, teppanyaki chef university medical, Japanese chef health community, hibachi catering medical center, private chef Loma Linda University",
  openGraph: {
    title: "Hibachi at Home Loma Linda | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Loma Linda. Professional Japanese teppanyaki chefs for medical university and health communities.",
    url: "https://realhibachi.com/service-area/san-bernardino/loma-linda",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Loma Linda - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Loma Linda | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Loma Linda. Medical university and health community service.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function LomaLindaServicePage() {
  return <LomaLindaServiceClient />
}

