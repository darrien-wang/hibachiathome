import type { Metadata } from "next"
import MonroviaServiceClient from "./MonroviaServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Monrovia | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Charming foothill hibachi service in historic Monrovia, combining small-town warmth with authentic cuisine. Professional Japanese teppanyaki experience at your Monrovia location.",
  keywords: "hibachi at home Monrovia, teppanyaki chef Monrovia, Hibachi Chef Monrovia, hibachi catering Monrovia, private chef Monrovia, hibachi party Monrovia",
  openGraph: {
    title: "Hibachi at Home Monrovia | Professional Teppanyaki Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/monrovia",
  },
    description: "Experience authentic hibachi at home in Monrovia. Professional Japanese teppanyaki chefs bringing the restaurant experience to your Monrovia location.",
    url: "https://www.realhibachi.com/service-area/monrovia",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Monrovia - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Monrovia | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Monrovia and surrounding areas.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function MonroviaServicePage() {
  return <MonroviaServiceClient />
}