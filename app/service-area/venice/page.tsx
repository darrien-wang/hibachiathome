import type { Metadata } from "next"
import VeniceServiceClient from "./VeniceServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Venice | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Bohemian hibachi experience in artistic Venice, bringing Japanese flair to this creative coastal community. Professional Japanese teppanyaki experience at your Venice location.",
  keywords: "hibachi at home Venice, teppanyaki chef Venice, Hibachi Chef Venice, hibachi catering Venice, private chef Venice, hibachi party Venice",
  openGraph: {
    title: "Hibachi at Home Venice | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Venice. Professional Japanese teppanyaki chefs bringing the restaurant experience to your Venice location.",
    url: "https://realhibachi.com/service-area/venice",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Venice - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Venice | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Venice and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function VeniceServicePage() {
  return <VeniceServiceClient />
}