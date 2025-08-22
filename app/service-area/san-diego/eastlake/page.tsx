import type { Metadata } from "next"
import EastlakeServiceClient from "./EastlakeServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Eastlake | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Eastlake including Eastlake Village, Eastlake Greens, Eastlake Woods, and surrounding areas. Professional Japanese teppanyaki experience at your home.",
  keywords: "hibachi at home Eastlake, teppanyaki chef Eastlake, Japanese chef Eastlake Village, hibachi catering Eastlake Greens, private chef Eastlake, hibachi party Eastlake",
  openGraph: {
    title: "Hibachi at Home Eastlake | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Eastlake. Professional Japanese teppanyaki chefs bringing the restaurant experience to your location.",
    url: "https://realhibachi.com/service-area/san-diego/eastlake",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Eastlake - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Eastlake | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service covering Eastlake Village, Eastlake Greens, and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function EastlakeServicePage() {
  return <EastlakeServiceClient />
}
