import type { Metadata } from "next"
import ArcadiaServiceClient from "./ArcadiaServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Arcadia | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Upscale hibachi service in beautiful Arcadia, bringing premium dining to this prestigious foothill community. Professional Japanese teppanyaki experience at your Arcadia location.",
  keywords: "hibachi at home Arcadia, teppanyaki chef Arcadia, Japanese chef Arcadia, hibachi catering Arcadia, private chef Arcadia, hibachi party Arcadia",
  openGraph: {
    title: "Hibachi at Home Arcadia | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Arcadia. Professional Japanese teppanyaki chefs bringing the restaurant experience to your Arcadia location.",
    url: "https://realhibachi.com/service-area/arcadia",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Arcadia - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Arcadia | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Arcadia and surrounding areas.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function ArcadiaServicePage() {
  return <ArcadiaServiceClient />
}