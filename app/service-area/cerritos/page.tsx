import type { Metadata } from "next"
import CerritosServiceClient from "./CerritosServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Cerritos | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Upscale suburban hibachi service in beautiful Cerritos, bringing premium dining to this well-planned community. Professional Japanese teppanyaki experience at your Cerritos location.",
  keywords: "hibachi at home Cerritos, teppanyaki chef Cerritos, Hibachi Chef Cerritos, hibachi catering Cerritos, private chef Cerritos, hibachi party Cerritos",
  openGraph: {
    title: "Hibachi at Home Cerritos | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Cerritos. Professional Japanese teppanyaki chefs bringing the restaurant experience to your Cerritos location.",
    url: "https://realhibachi.com/service-area/cerritos",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Cerritos - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Cerritos | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Cerritos and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function CerritosServicePage() {
  return <CerritosServiceClient />
}