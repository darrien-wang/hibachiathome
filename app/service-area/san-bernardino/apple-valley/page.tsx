import type { Metadata } from "next"
import AppleValleyServiceClient from "./AppleValleyServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Apple Valley | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Apple Valley. Professional Japanese teppanyaki chefs for home dining experiences. High desert retirement and golf community service.",
  keywords: "hibachi at home Apple Valley, teppanyaki chef high desert, Japanese chef retirement haven, hibachi catering golf communities, private chef Jess Ranch",
  openGraph: {
    title: "Hibachi at Home Apple Valley | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Apple Valley. Professional Japanese teppanyaki chefs for high desert retirement and golf communities.",
    url: "https://realhibachi.com/service-area/san-bernardino/apple-valley",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Apple Valley - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Apple Valley | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Apple Valley. High desert retirement and golf community service.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function AppleValleyServicePage() {
  return <AppleValleyServiceClient />
}

