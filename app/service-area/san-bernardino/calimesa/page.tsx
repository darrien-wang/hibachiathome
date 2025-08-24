import type { Metadata } from "next"
import CalimesaServiceClient from "./CalimesaServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Calimesa | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Calimesa. Professional Japanese teppanyaki chefs for home dining experiences. Golf course community and peaceful foothill service.",
  keywords: "hibachi at home Calimesa, teppanyaki chef golf community, Japanese chef country club, hibachi catering foothill living, private chef peaceful suburban",
  openGraph: {
    title: "Hibachi at Home Calimesa | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Calimesa. Professional Japanese teppanyaki chefs for golf course community and peaceful foothill living.",
    url: "https://realhibachi.com/service-area/san-bernardino/calimesa",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Calimesa - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Calimesa | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Calimesa. Golf course community and peaceful foothill service.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function CalimesaServicePage() {
  return <CalimesaServiceClient />
}

