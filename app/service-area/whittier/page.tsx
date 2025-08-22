import type { Metadata } from "next"
import WhittierServiceClient from "./WhittierServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Whittier | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Community-centered hibachi service in friendly Whittier, perfect for celebrating life's special moments together. Professional Japanese teppanyaki experience at your Whittier location.",
  keywords: "hibachi at home Whittier, teppanyaki chef Whittier, Japanese chef Whittier, hibachi catering Whittier, private chef Whittier, hibachi party Whittier",
  openGraph: {
    title: "Hibachi at Home Whittier | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Whittier. Professional Japanese teppanyaki chefs bringing the restaurant experience to your Whittier location.",
    url: "https://realhibachi.com/service-area/whittier",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Whittier - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Whittier | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Whittier and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function WhittierServicePage() {
  return <WhittierServiceClient />
}