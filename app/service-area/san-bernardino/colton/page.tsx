import type { Metadata } from "next"
import ColtonServiceClient from "./ColtonServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Colton | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Colton. Professional Japanese teppanyaki chefs for home dining experiences. Historic railroad heritage and logistics hub service.",
  keywords: "hibachi at home Colton, teppanyaki chef railroad heritage, Japanese chef logistics hub, hibachi catering La Loma Hills, private chef Reche Canyon",
  openGraph: {
    title: "Hibachi at Home Colton | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Colton. Professional Japanese teppanyaki chefs for historic railroad and logistics communities.",
    url: "https://realhibachi.com/service-area/san-bernardino/colton",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Colton - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Colton | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Colton. Historic railroad heritage and logistics hub service.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function ColtonServicePage() {
  return <ColtonServiceClient />
}

