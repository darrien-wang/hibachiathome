import type { Metadata } from "next"
import ElSegundoServiceClient from "./ElSegundoServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home El Segundo | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Professional hibachi catering in tech-savvy El Segundo, ideal for corporate and residential events. Professional Japanese teppanyaki experience at your El Segundo location.",
  keywords: "hibachi at home El Segundo, teppanyaki chef El Segundo, Hibachi Chef El Segundo, hibachi catering El Segundo, private chef El Segundo, hibachi party El Segundo",
  openGraph: {
    title: "Hibachi at Home El Segundo | Professional Teppanyaki Chef Service",
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/el-segundo",
  },
    description: "Experience authentic hibachi at home in El Segundo. Professional Japanese teppanyaki chefs bringing the restaurant experience to your El Segundo location.",
    url: "https://www.realhibachi.com/service-area/el-segundo",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home El Segundo - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home El Segundo | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in El Segundo and surrounding areas.',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function ElSegundoServicePage() {
  return <ElSegundoServiceClient />
}