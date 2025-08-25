import type { Metadata } from "next"
import GlendaleServiceClient from "./GlendaleServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Glendale | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Diverse cultural hibachi experience in Glendale, celebrating the area's rich multicultural community. Professional Japanese teppanyaki experience at your Glendale location.",
  keywords: "hibachi at home Glendale, teppanyaki chef Glendale, Hibachi Chef Glendale, hibachi catering Glendale, private chef Glendale, hibachi party Glendale",
  openGraph: {
    title: "Hibachi at Home Glendale | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Glendale. Professional Japanese teppanyaki chefs bringing the restaurant experience to your Glendale location.",
    url: "https://realhibachi.com/service-area/glendale",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Glendale - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Glendale | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Glendale and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function GlendaleServicePage() {
  return <GlendaleServiceClient />
}