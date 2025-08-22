import type { Metadata } from "next"
import ElCajonServiceClient from "./ElCajonServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home El Cajon | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in El Cajon including Downtown El Cajon, Fletcher Hills, Bostonia, and surrounding areas. Professional Japanese teppanyaki experience at your home.",
  keywords: "hibachi at home El Cajon, teppanyaki chef El Cajon, Japanese chef El Cajon, hibachi catering Fletcher Hills, private chef El Cajon, hibachi party El Cajon",
  openGraph: {
    title: "Hibachi at Home El Cajon | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in El Cajon. Professional Japanese teppanyaki chefs bringing the restaurant experience to your location.",
    url: "https://realhibachi.com/service-area/san-diego/el-cajon",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home El Cajon - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home El Cajon | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service covering El Cajon, Fletcher Hills, Bostonia, and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function ElCajonServicePage() {
  return <ElCajonServiceClient />
}
