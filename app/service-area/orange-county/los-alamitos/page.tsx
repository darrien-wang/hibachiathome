import type { Metadata } from "next"
import LosAlamitosServiceClient from "./LosAlamitosServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Los Alamitos | Orange County Private Chef Service | Real Hibachi",
  description: "Premium hibachi at home experience in Los Alamitos, Orange County. Professional private chef bringing authentic Japanese teppanyaki and unforgettable memories to your celebration.",
  keywords: "hibachi at home Los Alamitos, private chef Orange County, Japanese teppanyaki Los Alamitos, hibachi catering OC, private birthday hibachi party Los Alamitos",
  openGraph: {
    title: "Hibachi at Home Los Alamitos | Orange County Private Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/orange-county/los-alamitos",
  },
    description: "Create unforgettable memories with our hibachi at home experience in Los Alamitos. Professional private chef, authentic teppanyaki, and emotional celebrations that matter.",
    url: "https://www.realhibachi.com/service-area/orange-county/los-alamitos",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Los Alamitos - Create Memories That Matter',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Los Alamitos | Memories That Matter',
    description: 'Transform your special moments with our hibachi at home experience in Los Alamitos, Orange County.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function LosAlamitosServicePage() {
  return <LosAlamitosServiceClient />
}