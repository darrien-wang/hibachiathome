import type { Metadata } from "next"
import IdyllwildServiceClient from "./IdyllwildServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Idyllwild | Mountain Arts Village Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Idyllwild. Professional Japanese teppanyaki chefs for mountain arts community celebrations, cabin retreats, and artist gatherings in this charming alpine village.",
  keywords: "hibachi at home Idyllwild, teppanyaki chef mountain arts village, Japanese chef cabin retreat, hibachi catering artist community, private chef alpine village",
  openGraph: {
    title: "Hibachi at Home Idyllwild | Mountain Arts Village Teppanyaki Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/riverside/idyllwild",
  },
    description: "Experience authentic hibachi at home in Idyllwild. Professional Japanese teppanyaki chefs for mountain arts community celebrations and cabin retreat gatherings.",
    url: "https://www.realhibachi.com/service-area/riverside/idyllwild",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Idyllwild - Mountain Arts Village Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Idyllwild | Mountain Arts Village Teppanyaki Chef',
    description: 'Premium hibachi chef service in Idyllwild. Mountain arts community and cabin celebrations.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function IdyllwildServicePage() {
  return <IdyllwildServiceClient />
}







