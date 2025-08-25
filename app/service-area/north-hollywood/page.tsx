import type { Metadata } from "next"
import NorthHollywoodServiceClient from "./NorthHollywoodServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home North Hollywood | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Arts-focused hibachi service in creative North Hollywood, bringing culinary artistry to the NoHo Arts District. Professional Japanese teppanyaki experience at your North Hollywood location.",
  keywords: "hibachi at home North Hollywood, teppanyaki chef North Hollywood, Hibachi Chef North Hollywood, hibachi catering North Hollywood, private chef North Hollywood, hibachi party North Hollywood",
  openGraph: {
    title: "Hibachi at Home North Hollywood | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in North Hollywood. Professional Japanese teppanyaki chefs bringing the restaurant experience to your North Hollywood location.",
    url: "https://realhibachi.com/service-area/north-hollywood",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home North Hollywood - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home North Hollywood | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in North Hollywood and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function NorthHollywoodServicePage() {
  return <NorthHollywoodServiceClient />
}