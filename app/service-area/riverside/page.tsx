import type { Metadata } from "next"
import RiversideServiceClient from "./RiversideServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Riverside | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Riverside including Corona, Temecula, Murrieta, Redlands, and Inland Empire communities. Professional Japanese teppanyaki experience.",
  keywords: "hibachi at home Riverside, teppanyaki chef Inland Empire, Hibachi Chef Corona, hibachi catering Temecula, private chef Murrieta, hibachi party Riverside County",
  openGraph: {
    title: "Hibachi at Home Riverside | Professional Teppanyaki Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/riverside",
  },
    description: "Experience authentic hibachi at home in Riverside and Inland Empire. Professional Japanese teppanyaki chefs for Riverside County communities.",
    url: "https://www.realhibachi.com/service-area/riverside",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Riverside - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Riverside | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service covering Riverside, Corona, Temecula, and Inland Empire.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function RiversideServicePage() {
  return <RiversideServiceClient />
}

