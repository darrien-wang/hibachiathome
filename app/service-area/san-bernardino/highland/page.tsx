import type { Metadata } from "next"
import HighlandServiceClient from "./HighlandServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Highland | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Highland. Professional Japanese teppanyaki chefs for home dining experiences. Mountain views and family community service.",
  keywords: "hibachi at home Highland, teppanyaki chef mountain views, Japanese chef San Bernardino Valley, hibachi catering family communities, private chef Pacific Heights",
  openGraph: {
    title: "Hibachi at Home Highland | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Highland. Professional Japanese teppanyaki chefs for mountain views and family communities.",
    url: "https://realhibachi.com/service-area/san-bernardino/highland",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Highland - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Highland | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Highland. Mountain views and family community service.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function HighlandServicePage() {
  return <HighlandServiceClient />
}

