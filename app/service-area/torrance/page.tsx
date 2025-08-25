import type { Metadata } from "next"
import TorranceServiceClient from "./TorranceServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Torrance | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Suburban hibachi at home service in diverse Torrance, bringing authentic Japanese flavors to your neighborhood. Professional Japanese teppanyaki experience at your Torrance location.",
  keywords: "hibachi at home Torrance, teppanyaki chef Torrance, Hibachi Chef Torrance, hibachi catering Torrance, private chef Torrance, hibachi party Torrance",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/torrance",
  },
  openGraph: {
    title: "Hibachi at Home Torrance | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Torrance. Professional Japanese teppanyaki chefs bringing the restaurant experience to your Torrance location.",
    url: "https://www.realhibachi.com/service-area/torrance",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Torrance - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Torrance | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Torrance and surrounding areas.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function TorranceServicePage() {
  return <TorranceServiceClient />
}