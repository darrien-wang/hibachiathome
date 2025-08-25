import type { Metadata } from "next"
import NorwalkServiceClient from "./NorwalkServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Norwalk | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Welcoming hibachi service in diverse Norwalk, bringing authentic flavors to this vibrant community. Professional Japanese teppanyaki experience at your Norwalk location.",
  keywords: "hibachi at home Norwalk, teppanyaki chef Norwalk, Hibachi Chef Norwalk, hibachi catering Norwalk, private chef Norwalk, hibachi party Norwalk",
  openGraph: {
    title: "Hibachi at Home Norwalk | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Norwalk. Professional Japanese teppanyaki chefs bringing the restaurant experience to your Norwalk location.",
    url: "https://realhibachi.com/service-area/norwalk",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Norwalk - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Norwalk | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Norwalk and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function NorwalkServicePage() {
  return <NorwalkServiceClient />
}