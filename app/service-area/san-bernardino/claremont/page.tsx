import type { Metadata } from "next"
import ClaremontServiceClient from "./ClaremontServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Claremont | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Claremont. Professional Japanese teppanyaki chefs for home dining experiences. Claremont Colleges and village atmosphere service.",
  keywords: "hibachi at home Claremont, teppanyaki chef Claremont Colleges, Japanese chef village atmosphere, hibachi catering academic community, private chef tree-lined streets",
  openGraph: {
    title: "Hibachi at Home Claremont | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Claremont. Professional Japanese teppanyaki chefs for Claremont Colleges and village communities.",
    url: "https://realhibachi.com/service-area/san-bernardino/claremont",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Claremont - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Claremont | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Claremont. Claremont Colleges and village atmosphere service.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function ClaremontServicePage() {
  return <ClaremontServiceClient />
}

