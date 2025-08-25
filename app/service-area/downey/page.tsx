import type { Metadata } from "next"
import DowneyServiceClient from "./DowneyServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Downey | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Traditional community hibachi service in historic Downey, combining small-town charm with authentic cuisine. Professional Japanese teppanyaki experience at your Downey location.",
  keywords: "hibachi at home Downey, teppanyaki chef Downey, Hibachi Chef Downey, hibachi catering Downey, private chef Downey, hibachi party Downey",
  openGraph: {
    title: "Hibachi at Home Downey | Professional Teppanyaki Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/downey",
  },
    description: "Experience authentic hibachi at home in Downey. Professional Japanese teppanyaki chefs bringing the restaurant experience to your Downey location.",
    url: "https://www.realhibachi.com/service-area/downey",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Downey - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Downey | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Downey and surrounding areas.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function DowneyServicePage() {
  return <DowneyServiceClient />
}