import type { Metadata } from "next"
import ServiceAreaClient from "./ServiceAreaClient"

export const metadata: Metadata = {
  title: "Service Area Southern California | Hibachi Chef at Home | Real Hibachi",
  description: "Professional hibachi at home service covering Los Angeles, Orange County, San Diego, San Bernardino, Palm Springs, and Riverside areas. Premium Japanese teppanyaki experience throughout Southern California.",
  keywords: "hibachi service area Southern California, teppanyaki at home Los Angeles Orange County San Diego San Bernardino, Hibachi Chef service areas CA, hibachi catering locations California, hibachi at home Palm Springs Riverside",
  openGraph: {
    title: "Service Area Southern California | Hibachi Chef at Home | Real Hibachi",
    description: "Premium hibachi at home service covering Los Angeles, Orange County, San Diego, San Bernardino, Palm Springs, and Riverside. Professional Japanese teppanyaki chefs serving Southern California.",
    url: "https://realhibachi.com/service-area",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Real Hibachi Service Area - Southern California',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Service Area Southern California | Hibachi Chef at Home',
    description: 'Premium hibachi at home service covering Southern California areas including LA, Orange County, San Diego, San Bernardino, Palm Springs, and Riverside.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function ServiceAreaPage() {
  return <ServiceAreaClient />
}
