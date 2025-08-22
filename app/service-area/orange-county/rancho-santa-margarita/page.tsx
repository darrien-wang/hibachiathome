import type { Metadata } from "next"
import RanchoSantaMargaritaServiceClient from "./RanchoSantaMargaritaServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Rancho Santa Margarita | Orange County Private Chef Service | Real Hibachi",
  description: "Premium hibachi at home experience in Rancho Santa Margarita, Orange County. Professional private chef bringing authentic Japanese teppanyaki and unforgettable memories to your celebration.",
  keywords: "hibachi at home Rancho Santa Margarita, private chef Orange County, Japanese teppanyaki Rancho Santa Margarita, hibachi catering OC, private birthday hibachi party Rancho Santa Margarita",
  openGraph: {
    title: "Hibachi at Home Rancho Santa Margarita | Orange County Private Chef Service",
    description: "Create unforgettable memories with our hibachi at home experience in Rancho Santa Margarita. Professional private chef, authentic teppanyaki, and emotional celebrations that matter.",
    url: "https://realhibachi.com/service-area/orange-county/rancho-santa-margarita",
    siteName: "Real Hibachi",
    type: "website",
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Rancho Santa Margarita - Create Memories That Matter',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hibachi at Home Rancho Santa Margarita | Memories That Matter',
    description: 'Transform your special moments with our hibachi at home experience in Rancho Santa Margarita, Orange County.',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
}

export default function RanchoSantaMargaritaServicePage() {
  return <RanchoSantaMargaritaServiceClient />
}