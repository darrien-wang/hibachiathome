import type { Metadata } from "next"
import OrangeCountyServiceClient from "./OrangeCountyServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Orange County | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Orange County including Irvine, Newport Beach, Anaheim, Huntington Beach, and surrounding areas. Professional Japanese teppanyaki experience at your home.",
  keywords: "hibachi at home Orange County, teppanyaki chef OC, Hibachi Chef Irvine, hibachi catering Newport Beach, private chef Anaheim, hibachi party Orange County",
  openGraph: {
    title: "Hibachi at Home Orange County | Professional Teppanyaki Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/orange-county",
  },
    description: "Experience authentic hibachi at home in Orange County. Professional Japanese teppanyaki chefs bringing the restaurant experience to your location.",
    url: "https://www.realhibachi.com/service-area/orange-county",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Orange County - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Orange County | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service covering Orange County, Irvine, Newport Beach, and surrounding areas.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function OrangeCountyServicePage() {
  return <OrangeCountyServiceClient />
}

