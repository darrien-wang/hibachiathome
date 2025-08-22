import type { Metadata } from "next"
import PointLomaServiceClient from "./PointLomaServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Point Loma | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Point Loma including Point Loma Heights, Loma Portal, Liberty Station, and surrounding areas. Professional Japanese teppanyaki experience at your home.",
  keywords: "hibachi at home Point Loma, teppanyaki chef Point Loma, Japanese chef Liberty Station, hibachi catering Loma Portal, private chef Point Loma, hibachi party Point Loma",
  openGraph: {
    title: "Hibachi at Home Point Loma | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Point Loma. Professional Japanese teppanyaki chefs bringing the restaurant experience to your location.",
    url: "https://realhibachi.com/service-area/san-diego/point-loma",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Point Loma - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Point Loma | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service covering Point Loma, Liberty Station, and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function PointLomaServicePage() {
  return <PointLomaServiceClient />
}
