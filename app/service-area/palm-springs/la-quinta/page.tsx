import type { Metadata } from "next"
import LaQuintaServiceClient from "./LaQuintaServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home La Quinta | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in La Quinta. Professional Japanese teppanyaki chefs for home dining experiences. Home to prestigious PGA West golf courses service.",
  keywords: "hibachi at home La Quinta, teppanyaki chef La Quinta, Japanese chef PGA West, hibachi catering golf tournaments, private chef Masters celebrations",
  openGraph: {
    title: "Hibachi at Home La Quinta | Professional Teppanyaki Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/palm-springs/la-quinta",
  },
    description: "Experience authentic hibachi at home in La Quinta. Professional Japanese teppanyaki chefs for golf celebrations and PGA tournament gatherings.",
    url: "https://www.realhibachi.com/service-area/palm-springs/la-quinta",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home La Quinta - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home La Quinta | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in La Quinta. PGA golf communities and championship celebrations.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function LaQuintaServicePage() {
  return <LaQuintaServiceClient />
}





