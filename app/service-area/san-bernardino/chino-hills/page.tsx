import type { Metadata } from "next"
import ChinoHillsServiceClient from "./ChinoHillsServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Chino Hills | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Chino Hills. Professional Japanese teppanyaki chefs for home dining experiences. Affluent communities and rolling hills service.",
  keywords: "hibachi at home Chino Hills, teppanyaki chef Butterfield Ranch, Hibachi Chef rolling hills, hibachi catering golf communities, private chef master planned",
  openGraph: {
    title: "Hibachi at Home Chino Hills | Professional Teppanyaki Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/san-bernardino/chino-hills",
  },
    description: "Experience authentic hibachi at home in Chino Hills. Professional Japanese teppanyaki chefs for affluent communities and rolling hills.",
    url: "https://www.realhibachi.com/service-area/san-bernardino/chino-hills",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Chino Hills - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Chino Hills | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Chino Hills. Affluent communities and rolling hills service.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function ChinoHillsServicePage() {
  return <ChinoHillsServiceClient />
}

