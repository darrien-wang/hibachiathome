import type { Metadata } from "next"
import ImperialBeachServiceClient from "./ImperialBeachServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Imperial Beach | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Imperial Beach including Imperial Beach Village, Seacoast Drive, and surrounding areas. Professional Japanese teppanyaki experience at your home.",
  keywords: "hibachi at home Imperial Beach, teppanyaki chef Imperial Beach, Japanese chef Imperial Beach Village, hibachi catering Seacoast Drive, private chef Imperial Beach, hibachi party Imperial Beach",
  openGraph: {
    title: "Hibachi at Home Imperial Beach | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Imperial Beach. Professional Japanese teppanyaki chefs bringing the restaurant experience to your location.",
    url: "https://realhibachi.com/service-area/san-diego/imperial-beach",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Imperial Beach - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Imperial Beach | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service covering Imperial Beach Village, Seacoast Drive, and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function ImperialBeachServicePage() {
  return <ImperialBeachServiceClient />
}
