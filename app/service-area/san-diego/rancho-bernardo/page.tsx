import type { Metadata } from "next"
import RanchoBernardoServiceClient from "./RanchoBernardoServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Rancho Bernardo | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Rancho Bernardo including Bernardo Heights, Westwood, Oaks North, and surrounding areas. Professional Japanese teppanyaki experience at your home.",
  keywords: "hibachi at home Rancho Bernardo, teppanyaki chef Rancho Bernardo, Japanese chef Bernardo Heights, hibachi catering Westwood, private chef Rancho Bernardo, hibachi party Rancho Bernardo",
  openGraph: {
    title: "Hibachi at Home Rancho Bernardo | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Rancho Bernardo. Professional Japanese teppanyaki chefs bringing the restaurant experience to your location.",
    url: "https://realhibachi.com/service-area/san-diego/rancho-bernardo",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Rancho Bernardo - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Rancho Bernardo | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service covering Rancho Bernardo, Bernardo Heights, and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function RanchoBernardoServicePage() {
  return <RanchoBernardoServiceClient />
}
