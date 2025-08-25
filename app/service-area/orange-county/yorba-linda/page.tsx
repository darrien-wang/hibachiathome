import type { Metadata } from "next"
import YorbaLindaServiceClient from "./YorbaLindaServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Yorba Linda | Orange County Private Chef Service | Real Hibachi",
  description: "Premium hibachi at home experience in Yorba Linda, Orange County. Professional private chef bringing authentic Japanese teppanyaki and unforgettable memories to your celebration.",
  keywords: "hibachi at home Yorba Linda, private chef Orange County, Japanese teppanyaki Yorba Linda, hibachi catering OC, private birthday hibachi party Yorba Linda",
  openGraph: {
    title: "Hibachi at Home Yorba Linda | Orange County Private Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/orange-county/yorba-linda",
  },
    description: "Create unforgettable memories with our hibachi at home experience in Yorba Linda. Professional private chef, authentic teppanyaki, and emotional celebrations that matter.",
    url: "https://www.realhibachi.com/service-area/orange-county/yorba-linda",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Yorba Linda - Create Memories That Matter',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Yorba Linda | Memories That Matter',
    description: 'Transform your special moments with our hibachi at home experience in Yorba Linda, Orange County.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function YorbaLindaServicePage() {
  return <YorbaLindaServiceClient />
}