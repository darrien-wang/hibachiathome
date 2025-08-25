import type { Metadata } from "next"
import LosAngelesServiceClient from "./LosAngelesServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Los Angeles | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Los Angeles including Beverly Hills, Santa Monica, Pasadena, Burbank, and surrounding areas. Professional Japanese teppanyaki experience at your home.",
  keywords: "hibachi at home Los Angeles, teppanyaki chef LA, Hibachi Chef Beverly Hills, hibachi catering Santa Monica, private chef Pasadena, hibachi party Los Angeles County",
  openGraph: {
    title: "Hibachi at Home Los Angeles | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Los Angeles. Professional Japanese teppanyaki chefs bringing the restaurant experience to your location.",
    url: "https://realhibachi.com/service-area/los-angeles",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Los Angeles - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Los Angeles | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service covering Los Angeles, Beverly Hills, Santa Monica, and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function LosAngelesServicePage() {
  return <LosAngelesServiceClient />
}

