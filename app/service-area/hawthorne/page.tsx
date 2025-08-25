import type { Metadata } from "next"
import HawthorneServiceClient from "./HawthorneServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Hawthorne | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Neighborhood hibachi service in working-class Hawthorne, bringing affordable luxury to local families. Professional Japanese teppanyaki experience at your Hawthorne location.",
  keywords: "hibachi at home Hawthorne, teppanyaki chef Hawthorne, Hibachi Chef Hawthorne, hibachi catering Hawthorne, private chef Hawthorne, hibachi party Hawthorne",
  openGraph: {
    title: "Hibachi at Home Hawthorne | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Hawthorne. Professional Japanese teppanyaki chefs bringing the restaurant experience to your Hawthorne location.",
    url: "https://realhibachi.com/service-area/hawthorne",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Hawthorne - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Hawthorne | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Hawthorne and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function HawthorneServicePage() {
  return <HawthorneServiceClient />
}