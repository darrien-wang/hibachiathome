import type { Metadata } from "next"
import BonitaServiceClient from "./BonitaServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Bonita | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Bonita including Bonita Village, Sunnyside, Sweetwater Heights, and surrounding areas. Professional Japanese teppanyaki experience at your home.",
  keywords: "hibachi at home Bonita, teppanyaki chef Bonita, Japanese chef Bonita Village, hibachi catering Sunnyside, private chef Bonita, hibachi party Bonita",
  openGraph: {
    title: "Hibachi at Home Bonita | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Bonita. Professional Japanese teppanyaki chefs bringing the restaurant experience to your location.",
    url: "https://realhibachi.com/service-area/san-diego/bonita",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Bonita - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Bonita | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service covering Bonita Village, Sunnyside, and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function BonitaServicePage() {
  return <BonitaServiceClient />
}
