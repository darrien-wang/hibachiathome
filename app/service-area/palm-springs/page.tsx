import type { Metadata } from "next"
import PalmSpringsServiceClient from "./PalmSpringsServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Palm Springs | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Palm Springs including Palm Desert, Rancho Mirage, La Quinta, Indio, and desert communities. Professional Japanese teppanyaki experience.",
  keywords: "hibachi at home Palm Springs, teppanyaki chef desert, Hibachi Chef Palm Desert, hibachi catering Rancho Mirage, private chef La Quinta, hibachi party Coachella Valley",
  openGraph: {
    title: "Hibachi at Home Palm Springs | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Palm Springs and Coachella Valley. Professional Japanese teppanyaki chefs for desert communities.",
    url: "https://realhibachi.com/service-area/palm-springs",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Palm Springs - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Palm Springs | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service covering Palm Springs, Palm Desert, and Coachella Valley.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function PalmSpringsServicePage() {
  return <PalmSpringsServiceClient />
}

