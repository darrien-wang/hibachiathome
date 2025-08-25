import type { Metadata } from "next"
import CypressServiceClient from "./CypressServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Cypress | Orange County Private Chef Service | Real Hibachi",
  description: "Premium hibachi at home experience in Cypress, Orange County. Professional private chef bringing authentic Japanese teppanyaki and unforgettable memories to your celebration.",
  keywords: "hibachi at home Cypress, private chef Orange County, Japanese teppanyaki Cypress, hibachi catering OC, private birthday hibachi party Cypress",
  openGraph: {
    title: "Hibachi at Home Cypress | Orange County Private Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/orange-county/cypress",
  },
    description: "Create unforgettable memories with our hibachi at home experience in Cypress. Professional private chef, authentic teppanyaki, and emotional celebrations that matter.",
    url: "https://www.realhibachi.com/service-area/orange-county/cypress",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Cypress - Create Memories That Matter',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Cypress | Memories That Matter',
    description: 'Transform your special moments with our hibachi at home experience in Cypress, Orange County.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function CypressServicePage() {
  return <CypressServiceClient />
}