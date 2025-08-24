import type { Metadata } from "next"
import CrestlineServiceClient from "./CrestlineServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Crestline | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Crestline. Professional Japanese teppanyaki chefs for home dining experiences. Mountain lake and forest recreation service.",
  keywords: "hibachi at home Crestline, teppanyaki chef Lake Gregory, Japanese chef mountain community, hibachi catering forest recreation, private chef cabin retreats",
  openGraph: {
    title: "Hibachi at Home Crestline | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Crestline. Professional Japanese teppanyaki chefs for mountain lake and forest communities.",
    url: "https://realhibachi.com/service-area/san-bernardino/crestline",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Crestline - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Crestline | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Crestline. Mountain lake and forest recreation service.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function CrestlineServicePage() {
  return <CrestlineServiceClient />
}

