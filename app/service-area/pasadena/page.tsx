import type { Metadata } from "next"
import PasadenaServiceClient from "./PasadenaServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Pasadena | Historic Charm Teppanyaki Chef Service | Real Hibachi",
  description: "Historic charm hibachi chef service in beautiful Pasadena including Old Pasadena and Rose Bowl area. Elegant gatherings in the City of Roses.",
  keywords: "hibachi at home Pasadena, teppanyaki chef Old Pasadena, Japanese chef Rose Bowl, hibachi catering City of Roses, private chef Pasadena CA, historic venue hibachi",
  openGraph: {
    title: "Hibachi at Home Pasadena | Historic Charm Teppanyaki Chef Service",
    description: "Experience hibachi at home in historic Pasadena. Professional Japanese teppanyaki chefs bringing elegant dining to the City of Roses.",
    url: "https://realhibachi.com/service-area/pasadena",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Pasadena - Historic Charm Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Pasadena | Historic Charm Teppanyaki Chef',
    description: 'Historic charm hibachi chef service in Pasadena, Old Pasadena, and Rose Bowl area.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function PasadenaServicePage() {
  return <PasadenaServiceClient />
}
