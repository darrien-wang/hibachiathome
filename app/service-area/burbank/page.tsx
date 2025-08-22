import type { Metadata } from "next"
import BurbankServiceClient from "./BurbankServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Burbank | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Entertainment capital hibachi service in Burbank, bringing showbiz flair to your dining experience. Professional Japanese teppanyaki experience at your Burbank location.",
  keywords: "hibachi at home Burbank, teppanyaki chef Burbank, Japanese chef Burbank, hibachi catering Burbank, private chef Burbank, hibachi party Burbank",
  openGraph: {
    title: "Hibachi at Home Burbank | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Burbank. Professional Japanese teppanyaki chefs bringing the restaurant experience to your Burbank location.",
    url: "https://realhibachi.com/service-area/burbank",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Burbank - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Burbank | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Burbank and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function BurbankServicePage() {
  return <BurbankServiceClient />
}