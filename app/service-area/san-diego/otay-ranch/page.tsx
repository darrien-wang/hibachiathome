import type { Metadata } from "next"
import OtayRanchServiceClient from "./OtayRanchServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Otay Ranch | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Otay Ranch including Otay Ranch Village, Rolling Hills, Millenia, and surrounding areas. Professional Japanese teppanyaki experience at your home.",
  keywords: "hibachi at home Otay Ranch, teppanyaki chef Otay Ranch, Japanese chef Otay Ranch Village, hibachi catering Rolling Hills, private chef Otay Ranch, hibachi party Otay Ranch",
  openGraph: {
    title: "Hibachi at Home Otay Ranch | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Otay Ranch. Professional Japanese teppanyaki chefs bringing the restaurant experience to your location.",
    url: "https://realhibachi.com/service-area/san-diego/otay-ranch",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Otay Ranch - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Otay Ranch | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service covering Otay Ranch Village, Rolling Hills, and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function OtayRanchServicePage() {
  return <OtayRanchServiceClient />
}
