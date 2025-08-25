import type { Metadata } from "next"
import WhittierServiceClient from "./WhittierServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Whittier | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Community-centered hibachi service in friendly Whittier, perfect for celebrating life's special moments together. Professional Japanese teppanyaki experience at your Whittier location.",
  keywords: "hibachi at home Whittier, teppanyaki chef Whittier, Hibachi Chef Whittier, hibachi catering Whittier, private chef Whittier, hibachi party Whittier",
  openGraph: {
    title: "Hibachi at Home Whittier | Professional Teppanyaki Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/whittier",
  },
    description: "Experience authentic hibachi at home in Whittier. Professional Japanese teppanyaki chefs bringing the restaurant experience to your Whittier location.",
    url: "https://www.realhibachi.com/service-area/whittier",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
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
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function WhittierServicePage() {
  return <WhittierServiceClient />
}