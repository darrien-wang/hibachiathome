import type { Metadata } from "next"
import CoachellaServiceClient from "./CoachellaServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Coachella | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Coachella. Professional Japanese teppanyaki chefs for home dining experiences. Heart of Coachella Valley agricultural region service.",
  keywords: "hibachi at home Coachella, teppanyaki chef Coachella, Japanese chef agricultural community, hibachi catering graduation celebrations, private chef cultural heritage",
  openGraph: {
    title: "Hibachi at Home Coachella | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Coachella. Professional Japanese teppanyaki chefs for graduation celebrations and multicultural gatherings.",
    url: "https://realhibachi.com/service-area/palm-springs/coachella",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Coachella - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Coachella | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Coachella. Agricultural heritage and family celebrations.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function CoachellaServicePage() {
  return <CoachellaServiceClient />
}





