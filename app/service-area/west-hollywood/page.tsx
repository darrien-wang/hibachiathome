import type { Metadata } from "next"
import WestHollywoodServiceClient from "./WestHollywoodServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home West Hollywood | Trendy Teppanyaki Chef Service | Real Hibachi",
  description: "Contemporary hibachi chef service in trendy West Hollywood including Sunset Strip and Design District. Perfect for stylish gatherings and modern events.",
  keywords: "hibachi at home West Hollywood, teppanyaki chef Sunset Strip, Hibachi Chef WeHo, hibachi catering Design District, private chef West Hollywood, trendy hibachi party",
  openGraph: {
    title: "Hibachi at Home West Hollywood | Trendy Teppanyaki Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/west-hollywood",
  },
    description: "Experience contemporary hibachi at home in trendy West Hollywood. Professional Japanese teppanyaki chefs bringing stylish dining to your West Hollywood location.",
    url: "https://www.realhibachi.com/service-area/west-hollywood",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home West Hollywood - Trendy Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home West Hollywood | Trendy Teppanyaki Chef',
    description: 'Contemporary hibachi chef service in trendy West Hollywood, Sunset Strip, and Design District areas.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function WestHollywoodServicePage() {
  return <WestHollywoodServiceClient />
}
