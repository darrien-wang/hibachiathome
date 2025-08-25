import type { Metadata } from "next"
import BellflowerServiceClient from "./BellflowerServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Bellflower | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Neighborhood hibachi service in close-knit Bellflower, bringing people together through authentic Japanese cuisine. Professional Japanese teppanyaki experience at your Bellflower location.",
  keywords: "hibachi at home Bellflower, teppanyaki chef Bellflower, Hibachi Chef Bellflower, hibachi catering Bellflower, private chef Bellflower, hibachi party Bellflower",
  openGraph: {
    title: "Hibachi at Home Bellflower | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Bellflower. Professional Japanese teppanyaki chefs bringing the restaurant experience to your Bellflower location.",
    url: "https://realhibachi.com/service-area/bellflower",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Bellflower - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Bellflower | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Bellflower and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function BellflowerServicePage() {
  return <BellflowerServiceClient />
}