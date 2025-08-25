import type { Metadata } from "next"
import DesertHotSpringsServiceClient from "./DesertHotSpringsServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Desert Hot Springs | Spa Resort Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Desert Hot Springs. Professional Japanese teppanyaki chefs for spa resort celebrations, wellness retreats, and hot springs vacation rentals in this famous natural springs destination.",
  keywords: "hibachi at home Desert Hot Springs, teppanyaki chef spa resort, Japanese chef wellness retreat, hibachi catering hot springs, private chef spa vacation",
  openGraph: {
    title: "Hibachi at Home Desert Hot Springs | Spa Resort Teppanyaki Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/palm-springs/desert-hot-springs",
  },
    description: "Experience authentic hibachi at home in Desert Hot Springs. Professional Japanese teppanyaki chefs for spa resort celebrations and wellness retreat gatherings.",
    url: "https://www.realhibachi.com/service-area/palm-springs/desert-hot-springs",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Desert Hot Springs - Spa Resort Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Desert Hot Springs | Spa Resort Teppanyaki Chef',
    description: 'Premium hibachi chef service in Desert Hot Springs. Spa destinations and wellness celebrations.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function DesertHotSpringsServicePage() {
  return <DesertHotSpringsServiceClient />
}