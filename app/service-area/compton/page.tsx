import type { Metadata } from "next"
import ComptonServiceClient from "./ComptonServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Compton | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Community-focused hibachi service in historic Compton, bringing cultural appreciation through authentic dining experiences. Professional Japanese teppanyaki experience at your Compton location.",
  keywords: "hibachi at home Compton, teppanyaki chef Compton, Hibachi Chef Compton, hibachi catering Compton, private chef Compton, hibachi party Compton",
  openGraph: {
    title: "Hibachi at Home Compton | Professional Teppanyaki Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/compton",
  },
    description: "Experience authentic hibachi at home in Compton. Professional Japanese teppanyaki chefs bringing the restaurant experience to your Compton location.",
    url: "https://www.realhibachi.com/service-area/compton",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Compton - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Compton | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Compton and surrounding areas.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function ComptonServicePage() {
  return <ComptonServiceClient />
}