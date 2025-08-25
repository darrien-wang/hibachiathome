import type { Metadata } from "next"
import InglewoodServiceClient from "./InglewoodServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Inglewood | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Community-focused hibachi service in vibrant Inglewood, bringing authentic flavors to this diverse neighborhood. Professional Japanese teppanyaki experience at your Inglewood location.",
  keywords: "hibachi at home Inglewood, teppanyaki chef Inglewood, Hibachi Chef Inglewood, hibachi catering Inglewood, private chef Inglewood, hibachi party Inglewood",
  openGraph: {
    title: "Hibachi at Home Inglewood | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Inglewood. Professional Japanese teppanyaki chefs bringing the restaurant experience to your Inglewood location.",
    url: "https://realhibachi.com/service-area/inglewood",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Inglewood - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Inglewood | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Inglewood and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function InglewoodServicePage() {
  return <InglewoodServiceClient />
}