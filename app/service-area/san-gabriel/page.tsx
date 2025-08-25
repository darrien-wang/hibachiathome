import type { Metadata } from "next"
import SanGabrielServiceClient from "./SanGabrielServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home San Gabriel | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Authentic Asian fusion hibachi in San Gabriel, honoring the area's rich Asian heritage and culture. Professional Japanese teppanyaki experience at your San Gabriel location.",
  keywords: "hibachi at home San Gabriel, teppanyaki chef San Gabriel, Hibachi Chef San Gabriel, hibachi catering San Gabriel, private chef San Gabriel, hibachi party San Gabriel",
  openGraph: {
    title: "Hibachi at Home San Gabriel | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in San Gabriel. Professional Japanese teppanyaki chefs bringing the restaurant experience to your San Gabriel location.",
    url: "https://realhibachi.com/service-area/san-gabriel",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home San Gabriel - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home San Gabriel | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in San Gabriel and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function SanGabrielServicePage() {
  return <SanGabrielServiceClient />
}