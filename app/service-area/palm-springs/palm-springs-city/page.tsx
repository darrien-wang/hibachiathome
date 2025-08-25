import type { Metadata } from "next"
import PalmSpringsCityServiceClient from "./PalmSpringsCityServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Palm Springs City | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Palm Springs City. Professional Japanese teppanyaki chefs for home dining experiences. World-famous desert resort destination service.",
  keywords: "hibachi at home Palm Springs City, teppanyaki chef Palm Springs, Japanese chef desert resort, hibachi catering celebrity retreats, private chef luxury amenities",
  openGraph: {
    title: "Hibachi at Home Palm Springs City | Professional Teppanyaki Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/palm-springs/palm-springs-city",
  },
    description: "Experience authentic hibachi at home in Palm Springs City. Professional Japanese teppanyaki chefs for desert resort celebrations and luxury gatherings.",
    url: "https://www.realhibachi.com/service-area/palm-springs/palm-springs-city",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Palm Springs City - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Palm Springs City | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Palm Springs City. Desert resort and luxury celebrations.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function PalmSpringsCityServicePage() {
  return <PalmSpringsCityServiceClient />
}



