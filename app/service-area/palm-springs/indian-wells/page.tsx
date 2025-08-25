import type { Metadata } from "next"
import IndianWellsServiceClient from "./IndianWellsServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Indian Wells | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Indian Wells. Professional Japanese teppanyaki chefs for home dining experiences. Elite tennis tournament destination with ultra-exclusive community service.",
  keywords: "hibachi at home Indian Wells, teppanyaki chef Indian Wells, Japanese chef tennis resort, hibachi catering championship events, private chef luxury hotels",
  openGraph: {
    title: "Hibachi at Home Indian Wells | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Indian Wells. Professional Japanese teppanyaki chefs for tennis celebrations and championship gatherings.",
    url: "https://realhibachi.com/service-area/palm-springs/indian-wells",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Indian Wells - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Indian Wells | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Indian Wells. Tennis tournaments and championship celebrations.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function IndianWellsServicePage() {
  return <IndianWellsServiceClient />
}





