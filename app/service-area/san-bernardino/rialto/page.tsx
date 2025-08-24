import type { Metadata } from "next"
import RialtoServiceClient from "./RialtoServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Rialto | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Rialto. Professional Japanese teppanyaki chefs for home dining experiences. Historic Route 66 and community spirit service.",
  keywords: "hibachi at home Rialto, teppanyaki chef Route 66, Japanese chef community spirit, hibachi catering Renaissance, private chef downtown Rialto",
  openGraph: {
    title: "Hibachi at Home Rialto | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Rialto. Professional Japanese teppanyaki chefs for historic Route 66 and family communities.",
    url: "https://realhibachi.com/service-area/san-bernardino/rialto",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Rialto - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Rialto | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Rialto. Historic Route 66 and community spirit service.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function RialtoServicePage() {
  return <RialtoServiceClient />
}

