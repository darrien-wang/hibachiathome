import type { Metadata } from "next"
import RanchoMirageServiceClient from "./RanchoMirageServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Rancho Mirage | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Rancho Mirage. Professional Japanese teppanyaki chefs for home dining experiences. Exclusive desert resort community with luxury amenities service.",
  keywords: "hibachi at home Rancho Mirage, teppanyaki chef Rancho Mirage, Japanese chef luxury resort, hibachi catering golf course estates, private chef celebrity homes",
  openGraph: {
    title: "Hibachi at Home Rancho Mirage | Professional Teppanyaki Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/palm-springs/rancho-mirage",
  },
    description: "Experience authentic hibachi at home in Rancho Mirage. Professional Japanese teppanyaki chefs for luxury celebrations and exclusive resort gatherings.",
    url: "https://www.realhibachi.com/service-area/palm-springs/rancho-mirage",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Rancho Mirage - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Rancho Mirage | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Rancho Mirage. Luxury resort communities and exclusive celebrations.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function RanchoMirageServicePage() {
  return <RanchoMirageServiceClient />
}



