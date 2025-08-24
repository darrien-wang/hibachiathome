import type { Metadata } from "next"
import PomonaServiceClient from "./PomonaServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Pomona | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Pomona. Professional Japanese teppanyaki chefs for home dining experiences. Cal Poly Pomona and fairplex community service.",
  keywords: "hibachi at home Pomona, teppanyaki chef Cal Poly Pomona, Japanese chef fairplex, hibachi catering university campus, private chef arts colony",
  openGraph: {
    title: "Hibachi at Home Pomona | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Pomona. Professional Japanese teppanyaki chefs for Cal Poly Pomona and multicultural communities.",
    url: "https://realhibachi.com/service-area/san-bernardino/pomona",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Pomona - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Pomona | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Pomona. Cal Poly Pomona and fairplex community service.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function PomonaServicePage() {
  return <PomonaServiceClient />
}

