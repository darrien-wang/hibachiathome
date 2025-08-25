import type { Metadata } from "next"
import CoronaServiceClient from "./CoronaServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Corona | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Corona. Professional Japanese teppanyaki chefs for home dining experiences. Circle City with golf courses and business community service.",
  keywords: "hibachi at home Corona, teppanyaki chef Corona, Japanese chef Circle City, hibachi catering golf communities, private chef business celebrations",
  openGraph: {
    title: "Hibachi at Home Corona | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Corona. Professional Japanese teppanyaki chefs for golf communities and business celebrations.",
    url: "https://realhibachi.com/service-area/riverside/corona",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Corona - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Corona | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Corona. Golf communities and business district service.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function CoronaServicePage() {
  return <CoronaServiceClient />
}




