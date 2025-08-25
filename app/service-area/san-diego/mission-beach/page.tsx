import type { Metadata } from "next"
import MissionBeachServiceClient from "./MissionBeachServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Mission Beach | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Mission Beach including Mission Beach Boardwalk, Belmont Park, Ocean Front Walk, and surrounding areas. Professional Japanese teppanyaki experience at your home.",
  keywords: "hibachi at home Mission Beach, teppanyaki chef Mission Beach, Hibachi Chef Mission Beach Boardwalk, hibachi catering Belmont Park, private chef Mission Beach, hibachi party Mission Beach",
  openGraph: {
    title: "Hibachi at Home Mission Beach | Professional Teppanyaki Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/san-diego/mission-beach",
  },
    description: "Experience authentic hibachi at home in Mission Beach. Professional Japanese teppanyaki chefs bringing the restaurant experience to your location.",
    url: "https://www.realhibachi.com/service-area/san-diego/mission-beach",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Mission Beach - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Mission Beach | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service covering Mission Beach Boardwalk, Belmont Park, and surrounding areas.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function MissionBeachServicePage() {
  return <MissionBeachServiceClient />
}
