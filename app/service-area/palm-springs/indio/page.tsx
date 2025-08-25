import type { Metadata } from "next"
import IndioServiceClient from "./IndioServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Indio | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Indio. Professional Japanese teppanyaki chefs for home dining experiences. Home to world-famous Coachella Music Festival service.",
  keywords: "hibachi at home Indio, teppanyaki chef Indio, Japanese chef Coachella Festival, hibachi catering music celebrations, private chef Grammy winners",
  openGraph: {
    title: "Hibachi at Home Indio | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Indio. Professional Japanese teppanyaki chefs for music celebrations and festival gatherings.",
    url: "https://realhibachi.com/service-area/palm-springs/indio",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Indio - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Indio | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Indio. Music festival and entertainment celebrations.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function IndioServicePage() {
  return <IndioServiceClient />
}





