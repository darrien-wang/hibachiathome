import type { Metadata } from "next"
import RunningSpringsServiceClient from "./RunningSpringsServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Running Springs | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Running Springs. Professional Japanese teppanyaki chefs for home dining experiences. Peaceful mountain forest and outdoor recreation service.",
  keywords: "hibachi at home Running Springs, teppanyaki chef mountain forest, Japanese chef forest conservation, hibachi catering quiet neighborhoods, private chef outdoor recreation",
  openGraph: {
    title: "Hibachi at Home Running Springs | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Running Springs. Professional Japanese teppanyaki chefs for peaceful mountain forest and outdoor recreation communities.",
    url: "https://realhibachi.com/service-area/san-bernardino/running-springs",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Running Springs - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Running Springs | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Running Springs. Peaceful mountain forest and outdoor recreation service.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function RunningSpringsServicePage() {
  return <RunningSpringsServiceClient />
}

