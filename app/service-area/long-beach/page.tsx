import type { Metadata } from "next"
import LongBeachServiceClient from "./LongBeachServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Long Beach | Coastal Teppanyaki Chef Service | Real Hibachi",
  description: "Coastal hibachi chef service in vibrant Long Beach including Belmont Shore and Downtown Long Beach. Oceanside dining experiences in this vibrant port city.",
  keywords: "hibachi at home Long Beach, coastal teppanyaki chef, Japanese chef Belmont Shore, hibachi catering Downtown Long Beach, private chef Long Beach CA, waterfront hibachi party",
  openGraph: {
    title: "Hibachi at Home Long Beach | Coastal Teppanyaki Chef Service",
    description: "Experience coastal hibachi at home in Long Beach. Professional Japanese teppanyaki chefs bringing oceanside dining to your Long Beach location.",
    url: "https://realhibachi.com/service-area/long-beach",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Long Beach - Coastal Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Long Beach | Coastal Teppanyaki Chef',
    description: 'Coastal hibachi chef service in Long Beach, Belmont Shore, and waterfront areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function LongBeachServicePage() {
  return <LongBeachServiceClient />
}
