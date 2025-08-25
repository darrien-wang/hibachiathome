import type { Metadata } from "next"
import MissionViejoServiceClient from "./MissionViejoServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Mission Viejo | Orange County Private Chef Service | Real Hibachi",
  description: "Premium hibachi at home experience in Mission Viejo, Orange County. Professional private chef bringing authentic Japanese teppanyaki and unforgettable memories to your celebration.",
  keywords: "hibachi at home Mission Viejo, private chef Orange County, Japanese teppanyaki Mission Viejo, hibachi catering OC, private birthday hibachi party Mission Viejo",
  openGraph: {
    title: "Hibachi at Home Mission Viejo | Orange County Private Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/orange-county/mission-viejo",
  },
    description: "Create unforgettable memories with our hibachi at home experience in Mission Viejo. Professional private chef, authentic teppanyaki, and emotional celebrations that matter.",
    url: "https://www.realhibachi.com/service-area/orange-county/mission-viejo",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Mission Viejo - Create Memories That Matter',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Mission Viejo | Memories That Matter',
    description: 'Transform your special moments with our hibachi at home experience in Mission Viejo, Orange County.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function MissionViejoServicePage() {
  return <MissionViejoServiceClient />
}