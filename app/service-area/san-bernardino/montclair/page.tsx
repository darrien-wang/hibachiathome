import type { Metadata } from "next"
import MontclairServiceClient from "./MontclairServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Montclair | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Montclair. Professional Japanese teppanyaki chefs for home dining experiences. Diverse multicultural community and arts scene service.",
  keywords: "hibachi at home Montclair, teppanyaki chef multicultural, Japanese chef arts scene, hibachi catering Monte Vista, private chef cultural center",
  openGraph: {
    title: "Hibachi at Home Montclair | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Montclair. Professional Japanese teppanyaki chefs for diverse multicultural and arts communities.",
    url: "https://realhibachi.com/service-area/san-bernardino/montclair",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Montclair - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Montclair | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Montclair. Diverse multicultural community and arts scene service.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function MontclairServicePage() {
  return <MontclairServiceClient />
}

