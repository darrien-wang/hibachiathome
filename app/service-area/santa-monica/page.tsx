import type { Metadata } from "next"
import SantaMonicaServiceClient from "./SantaMonicaServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Santa Monica | Beachside Teppanyaki Chef Service | Real Hibachi",
  description: "Beachside hibachi chef service in Santa Monica including Third Street Promenade and Santa Monica Pier areas. Ocean vibes with authentic Japanese teppanyaki cuisine.",
  keywords: "hibachi at home Santa Monica, beachside teppanyaki chef, Hibachi Chef Santa Monica Pier, hibachi catering Third Street Promenade, private chef Santa Monica Beach, oceanside hibachi party",
  openGraph: {
    title: "Hibachi at Home Santa Monica | Beachside Teppanyaki Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/santa-monica",
  },
    description: "Experience beachside hibachi at home in Santa Monica. Professional Japanese teppanyaki chefs combining ocean vibes with authentic cuisine at your Santa Monica location.",
    url: "https://www.realhibachi.com/service-area/santa-monica",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Santa Monica - Beachside Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Santa Monica | Beachside Teppanyaki Chef',
    description: 'Beachside hibachi chef service in Santa Monica, Third Street Promenade, and ocean-view venues.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function SantaMonicaServicePage() {
  return <SantaMonicaServiceClient />
}
