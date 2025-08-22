import type { Metadata } from "next"
import ScrippsRanchServiceClient from "./ScrippsRanchServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Scripps Ranch | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Scripps Ranch including Scripps Ranch Village, Miramar Ranch North, Cypress Canyon, and surrounding areas. Professional Japanese teppanyaki experience at your home.",
  keywords: "hibachi at home Scripps Ranch, teppanyaki chef Scripps Ranch, Japanese chef Scripps Ranch Village, hibachi catering Miramar Ranch North, private chef Scripps Ranch, hibachi party Scripps Ranch",
  openGraph: {
    title: "Hibachi at Home Scripps Ranch | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Scripps Ranch. Professional Japanese teppanyaki chefs bringing the restaurant experience to your location.",
    url: "https://realhibachi.com/service-area/san-diego/scripps-ranch",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Scripps Ranch - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Scripps Ranch | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service covering Scripps Ranch Village, Miramar Ranch North, and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function ScrippsRanchServicePage() {
  return <ScrippsRanchServiceClient />
}
