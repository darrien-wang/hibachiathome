import type { Metadata } from "next"
import YucaipaServiceClient from "./YucaipaServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Yucaipa | Professional Teppanyaki Chef Service | Real Hibachi",
  description: "Premium hibachi chef service in Yucaipa. Professional Japanese teppanyaki chefs for home dining experiences. Oak Glen apple orchards and mountain foothill service.",
  keywords: "hibachi at home Yucaipa, teppanyaki chef Oak Glen, Japanese chef apple orchards, hibachi catering regional park, private chef mountain foothills",
  openGraph: {
    title: "Hibachi at Home Yucaipa | Professional Teppanyaki Chef Service",
    description: "Experience authentic hibachi at home in Yucaipa. Professional Japanese teppanyaki chefs for Oak Glen apple orchards and mountain foothill communities.",
    url: "https://realhibachi.com/service-area/san-bernardino/yucaipa",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Yucaipa - Professional Teppanyaki Chef Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Yucaipa | Professional Teppanyaki Chef',
    description: 'Premium hibachi chef service in Yucaipa. Oak Glen apple orchards and mountain foothill service.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function YucaipaServicePage() {
  return <YucaipaServiceClient />
}

