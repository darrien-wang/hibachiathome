import type { Metadata } from "next"
import MissionValleyServiceClient from "./MissionValleyServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Mission Valley | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Mission Valley including Mission Valley East, Mission Valley West, Grantville, and surrounding areas. Professional Japanese teppanyaki experience at your home.",
  keywords: "hibachi at home Mission Valley, teppanyaki chef Mission Valley, Japanese chef Mission Valley East, hibachi catering Grantville, private chef Mission Valley, hibachi party Mission Valley",
  openGraph: {
    title: "Hibachi at Home Mission Valley | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Mission Valley. Professional Japanese teppanyaki chefs bringing the restaurant experience to your location.",
    url: "https://realhibachi.com/service-area/san-diego/mission-valley",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Mission Valley - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Mission Valley | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service covering Mission Valley, Grantville, and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function MissionValleyServicePage() {
  return <MissionValleyServiceClient />
}
