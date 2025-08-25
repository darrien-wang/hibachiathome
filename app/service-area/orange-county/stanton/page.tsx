import type { Metadata } from "next"
import StantonServiceClient from "./StantonServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Stanton | Orange County Private Chef Service | Real Hibachi",
  description: "Premium hibachi at home experience in Stanton, Orange County. Professional private chef bringing authentic Japanese teppanyaki and unforgettable memories to your celebration.",
  keywords: "hibachi at home Stanton, private chef Orange County, Japanese teppanyaki Stanton, hibachi catering OC, private birthday hibachi party Stanton",
  openGraph: {
    title: "Hibachi at Home Stanton | Orange County Private Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/orange-county/stanton",
  },
    description: "Create unforgettable memories with our hibachi at home experience in Stanton. Professional private chef, authentic teppanyaki, and emotional celebrations that matter.",
    url: "https://www.realhibachi.com/service-area/orange-county/stanton",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Stanton - Create Memories That Matter',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Stanton | Memories That Matter',
    description: 'Transform your special moments with our hibachi at home experience in Stanton, Orange County.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function StantonServicePage() {
  return <StantonServiceClient />
}