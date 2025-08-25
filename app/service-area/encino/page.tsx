import type { Metadata } from "next"
import EncinoServiceClient from "./EncinoServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Encino | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Luxury hibachi service in affluent Encino, delivering premium dining experiences to elegant Valley homes. Professional Japanese teppanyaki experience at your Encino location.",
  keywords: "hibachi at home Encino, teppanyaki chef Encino, Hibachi Chef Encino, hibachi catering Encino, private chef Encino, hibachi party Encino",
  openGraph: {
    title: "Hibachi at Home Encino | Professional Teppanyaki Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/encino",
  },
    description: "Experience authentic hibachi at home in Encino. Professional Japanese teppanyaki chefs bringing the restaurant experience to your Encino location.",
    url: "https://www.realhibachi.com/service-area/encino",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Encino - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Encino | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Encino and surrounding areas.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function EncinoServicePage() {
  return <EncinoServiceClient />
}