import type { Metadata } from "next"
import UplandServiceClient from "./UplandServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Upland | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Upland. Professional Japanese teppanyaki chefs for home dining experiences. Historic Route 66 and foothill community service.",
  keywords: "hibachi at home Upland, teppanyaki chef foothills, Japanese chef Route 66, hibachi catering lemon heritage, private chef downtown Upland",
  openGraph: {
    title: "Hibachi at Home Upland | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Upland. Professional Japanese teppanyaki chefs for foothill and historic communities.",
    url: "https://realhibachi.com/service-area/san-bernardino/upland",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Upland - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Upland | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Upland. Historic Route 66 and foothill community service.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function UplandServicePage() {
  return <UplandServiceClient />
}

