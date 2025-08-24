import type { Metadata } from "next"
import HesperiaServiceClient from "./HesperiaServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Hesperia | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Hesperia. Professional Japanese teppanyaki chefs for home dining experiences. High desert mountain and lake recreation service.",
  keywords: "hibachi at home Hesperia, teppanyaki chef Hesperia Lake, Japanese chef high desert, hibachi catering mountain living, private chef Oak Hills",
  openGraph: {
    title: "Hibachi at Home Hesperia | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Hesperia. Professional Japanese teppanyaki chefs for high desert mountain and lake communities.",
    url: "https://realhibachi.com/service-area/san-bernardino/hesperia",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Hesperia - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Hesperia | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Hesperia. High desert mountain and lake recreation service.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function HesperiaServicePage() {
  return <HesperiaServiceClient />
}

