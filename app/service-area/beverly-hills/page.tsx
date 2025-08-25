import type { Metadata } from "next"
import BeverlyHillsServiceClient from "./BeverlyHillsServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Beverly Hills | Luxury Teppanyaki Chef Service | Real Hibachi",
  description: "Luxury hibachi chef service in prestigious Beverly Hills including Trousdale Estates and Beverly Hills Flats. Five-star Japanese teppanyaki experience for elegant homes.",
  keywords: "hibachi at home Beverly Hills, luxury teppanyaki chef 90210, Hibachi Chef Beverly Hills Flats, hibachi catering Trousdale Estates, private chef Beverly Hills, luxury hibachi party",
  openGraph: {
    title: "Hibachi at Home Beverly Hills | Luxury Teppanyaki Chef Service",
    description: "Experience luxury hibachi at home in Beverly Hills. Professional Japanese teppanyaki chefs bringing five-star dining to your prestigious Beverly Hills location.",
    url: "https://realhibachi.com/service-area/beverly-hills",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Beverly Hills - Luxury Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Beverly Hills | Luxury Teppanyaki Chef',
    description: 'Luxury hibachi chef service in prestigious Beverly Hills, Trousdale Estates, and surrounding luxury areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function BeverlyHillsServicePage() {
  return <BeverlyHillsServiceClient />
}
