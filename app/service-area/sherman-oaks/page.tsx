import type { Metadata } from "next"
import ShermanOaksServiceClient from "./ShermanOaksServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Sherman Oaks | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Sophisticated hibachi dining in upscale Sherman Oaks, bringing elegance to this prestigious Valley community. Professional Japanese teppanyaki experience at your Sherman Oaks location.",
  keywords: "hibachi at home Sherman Oaks, teppanyaki chef Sherman Oaks, Hibachi Chef Sherman Oaks, hibachi catering Sherman Oaks, private chef Sherman Oaks, hibachi party Sherman Oaks",
  openGraph: {
    title: "Hibachi at Home Sherman Oaks | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Sherman Oaks. Professional Japanese teppanyaki chefs bringing the restaurant experience to your Sherman Oaks location.",
    url: "https://realhibachi.com/service-area/sherman-oaks",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Sherman Oaks - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Sherman Oaks | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Sherman Oaks and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function ShermanOaksServicePage() {
  return <ShermanOaksServiceClient />
}