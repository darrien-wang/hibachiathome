import type { Metadata } from "next"
import DelMarServiceClient from "./DelMarServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Del Mar | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Del Mar including Del Mar Heights, Del Mar Village, Carmel Valley, and surrounding areas. Professional Japanese teppanyaki experience at your home.",
  keywords: "hibachi at home Del Mar, teppanyaki chef Del Mar, Japanese chef Del Mar Village, hibachi catering Del Mar Heights, private chef Carmel Valley, hibachi party Del Mar",
  openGraph: {
    title: "Hibachi at Home Del Mar | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Del Mar. Professional Japanese teppanyaki chefs bringing the restaurant experience to your location.",
    url: "https://realhibachi.com/service-area/san-diego/del-mar",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Del Mar - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Del Mar | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service covering Del Mar Village, Del Mar Heights, and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function DelMarServicePage() {
  return <DelMarServiceClient />
}

