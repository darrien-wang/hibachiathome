import type { Metadata } from "next"
import WoodlandHillsServiceClient from "./WoodlandHillsServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Woodland Hills | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Upscale hibachi catering in beautiful Woodland Hills, perfect for elegant gatherings in this scenic Valley locale. Professional Japanese teppanyaki experience at your Woodland Hills location.",
  keywords: "hibachi at home Woodland Hills, teppanyaki chef Woodland Hills, Hibachi Chef Woodland Hills, hibachi catering Woodland Hills, private chef Woodland Hills, hibachi party Woodland Hills",
  openGraph: {
    title: "Hibachi at Home Woodland Hills | Professional Teppanyaki Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/woodland-hills",
  },
    description: "Experience authentic hibachi at home in Woodland Hills. Professional Japanese teppanyaki chefs bringing the restaurant experience to your Woodland Hills location.",
    url: "https://www.realhibachi.com/service-area/woodland-hills",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Woodland Hills - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Woodland Hills | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Woodland Hills and surrounding areas.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function WoodlandHillsServicePage() {
  return <WoodlandHillsServiceClient />
}