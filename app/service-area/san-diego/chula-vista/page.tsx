import type { Metadata } from "next"
import ChulaVistaServiceClient from "./ChulaVistaServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Chula Vista | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Chula Vista including Eastlake, Otay Ranch, Rolling Hills Ranch, and surrounding areas. Professional Japanese teppanyaki experience at your home.",
  keywords: "hibachi at home Chula Vista, teppanyaki chef Chula Vista, Japanese chef Eastlake, hibachi catering Otay Ranch, private chef Chula Vista, hibachi party Chula Vista",
  openGraph: {
    title: "Hibachi at Home Chula Vista | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Chula Vista. Professional Japanese teppanyaki chefs bringing the restaurant experience to your location.",
    url: "https://realhibachi.com/service-area/san-diego/chula-vista",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Chula Vista - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Chula Vista | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service covering Chula Vista, Eastlake, Otay Ranch, and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function ChulaVistaServicePage() {
  return <ChulaVistaServiceClient />
}
