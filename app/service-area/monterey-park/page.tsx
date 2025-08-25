import type { Metadata } from "next"
import MontereyParkServiceClient from "./MontereyParkServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Monterey Park | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Authentic Asian community hibachi service in Monterey Park, blending Japanese and Chinese culinary traditions. Professional Japanese teppanyaki experience at your Monterey Park location.",
  keywords: "hibachi at home Monterey Park, teppanyaki chef Monterey Park, Hibachi Chef Monterey Park, hibachi catering Monterey Park, private chef Monterey Park, hibachi party Monterey Park",
  openGraph: {
    title: "Hibachi at Home Monterey Park | Professional Teppanyaki Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/monterey-park",
  },
    description: "Experience authentic hibachi at home in Monterey Park. Professional Japanese teppanyaki chefs bringing the restaurant experience to your Monterey Park location.",
    url: "https://www.realhibachi.com/service-area/monterey-park",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Monterey Park - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Monterey Park | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Monterey Park and surrounding areas.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function MontereyParkServicePage() {
  return <MontereyParkServiceClient />
}