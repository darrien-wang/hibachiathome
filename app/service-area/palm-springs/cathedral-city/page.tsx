import type { Metadata } from "next"
import CathedralCityServiceClient from "./CathedralCityServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Cathedral City | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Cathedral City. Professional Japanese teppanyaki chefs for home dining experiences. Growing desert community with family-friendly atmosphere service.",
  keywords: "hibachi at home Cathedral City, teppanyaki chef Cathedral City, Japanese chef desert community, hibachi catering golf communities, private chef family celebrations",
  openGraph: {
    title: "Hibachi at Home Cathedral City | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Cathedral City. Professional Japanese teppanyaki chefs for family celebrations and desert community gatherings.",
    url: "https://realhibachi.com/service-area/palm-springs/cathedral-city",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Cathedral City - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Cathedral City | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Cathedral City. Desert family communities and celebrations.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function CathedralCityServicePage() {
  return <CathedralCityServiceClient />
}



