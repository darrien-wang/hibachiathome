import type { Metadata } from "next"
import GrandTerraceServiceClient from "./GrandTerraceServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Grand Terrace | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Grand Terrace. Professional Japanese teppanyaki chefs for home dining experiences. Small-town charm and community spirit service.",
  keywords: "hibachi at home Grand Terrace, teppanyaki chef small town, Japanese chef community spirit, hibachi catering family neighborhoods, private chef Blue Mountain",
  openGraph: {
    title: "Hibachi at Home Grand Terrace | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Grand Terrace. Professional Japanese teppanyaki chefs for small-town charm and family communities.",
    url: "https://realhibachi.com/service-area/san-bernardino/grand-terrace",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Grand Terrace - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Grand Terrace | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Grand Terrace. Small-town charm and community spirit service.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function GrandTerraceServicePage() {
  return <GrandTerraceServiceClient />
}

