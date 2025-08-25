import type { Metadata } from "next"
import TarzanaServiceClient from "./TarzanaServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Tarzana | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Exclusive hibachi at home service in upscale Tarzana, bringing five-star dining to this prestigious Valley community. Professional Japanese teppanyaki experience at your Tarzana location.",
  keywords: "hibachi at home Tarzana, teppanyaki chef Tarzana, Hibachi Chef Tarzana, hibachi catering Tarzana, private chef Tarzana, hibachi party Tarzana",
  openGraph: {
    title: "Hibachi at Home Tarzana | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Tarzana. Professional Japanese teppanyaki chefs bringing the restaurant experience to your Tarzana location.",
    url: "https://realhibachi.com/service-area/tarzana",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Tarzana - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Tarzana | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Tarzana and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function TarzanaServicePage() {
  return <TarzanaServiceClient />
}