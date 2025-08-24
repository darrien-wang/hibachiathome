import type { Metadata } from "next"
import LaVerneServiceClient from "./LaVerneServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home La Verne | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in La Verne. Professional Japanese teppanyaki chefs for home dining experiences. University of La Verne and historic downtown service.",
  keywords: "hibachi at home La Verne, teppanyaki chef University of La Verne, Japanese chef historic downtown, hibachi catering tree-lined streets, private chef educational community",
  openGraph: {
    title: "Hibachi at Home La Verne | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in La Verne. Professional Japanese teppanyaki chefs for university and historic downtown communities.",
    url: "https://realhibachi.com/service-area/san-bernardino/la-verne",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home La Verne - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home La Verne | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in La Verne. University and historic downtown community service.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function LaVerneServicePage() {
  return <LaVerneServiceClient />
}

