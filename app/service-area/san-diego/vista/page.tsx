import type { Metadata } from "next"
import VistaServiceClient from "./VistaServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Vista | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Vista including Downtown Vista, Shadowridge, Rancho Minerva, and surrounding areas. Professional Japanese teppanyaki experience at your home.",
  keywords: "hibachi at home Vista, teppanyaki chef Vista, Japanese chef Vista, hibachi catering Shadowridge, private chef Vista, hibachi party Vista",
  openGraph: {
    title: "Hibachi at Home Vista | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Vista. Professional Japanese teppanyaki chefs bringing the restaurant experience to your location.",
    url: "https://realhibachi.com/service-area/san-diego/vista",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Vista - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Vista | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service covering Vista, Shadowridge, and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function VistaServicePage() {
  return <VistaServiceClient />
}

