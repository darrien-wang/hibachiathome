import type { Metadata } from "next"
import AlhambraServiceClient from "./AlhambraServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Alhambra | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Culturally rich hibachi experience in Alhambra, celebrating diversity through authentic Japanese cuisine. Professional Japanese teppanyaki experience at your Alhambra location.",
  keywords: "hibachi at home Alhambra, teppanyaki chef Alhambra, Hibachi Chef Alhambra, hibachi catering Alhambra, private chef Alhambra, hibachi party Alhambra",
  openGraph: {
    title: "Hibachi at Home Alhambra | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Alhambra. Professional Japanese teppanyaki chefs bringing the restaurant experience to your Alhambra location.",
    url: "https://realhibachi.com/service-area/alhambra",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Alhambra - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Alhambra | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Alhambra and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function AlhambraServicePage() {
  return <AlhambraServiceClient />
}