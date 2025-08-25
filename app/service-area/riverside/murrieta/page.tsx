import type { Metadata } from "next"
import MurrietaServiceClient from "./MurrietaServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Murrieta | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Murrieta. Professional Japanese teppanyaki chefs for home dining experiences. Master-planned community with excellent schools service.",
  keywords: "hibachi at home Murrieta, teppanyaki chef Murrieta, Japanese chef Greer Ranch, hibachi catering family celebrations, private chef graduation parties",
  openGraph: {
    title: "Hibachi at Home Murrieta | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Murrieta. Professional Japanese teppanyaki chefs for family celebrations and graduation parties.",
    url: "https://realhibachi.com/service-area/riverside/murrieta",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Murrieta - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Murrieta | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Murrieta. Family communities and academic celebrations.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function MurrietaServicePage() {
  return <MurrietaServiceClient />
}




