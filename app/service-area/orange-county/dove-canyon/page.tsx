import type { Metadata } from "next"
import DoveCanyonServiceClient from "./DoveCanyonServiceClient"

export const metadata: Metadata = {
  title: "Hibachi at Home Dove Canyon CA | Private Chef Teppanyaki Service in Orange County",
  description: "Professional hibachi chefs bringing authentic Japanese teppanyaki experience to your Dove Canyon home. Book private hibachi catering for parties, celebrations & special events in Orange County.",
  keywords: "hibachi at home Dove Canyon, private chef Orange County, teppanyaki catering Dove Canyon CA, Japanese hibachi chef, in-home hibachi party, Orange County hibachi service",
  openGraph: {
    title: "Private Hibachi Chef Service in Dove Canyon,
  alternates: {
    canonical: "https://www.realhibachi.com/service-area/orange-county/dove-canyon",
  }, Orange County",
    description: "Authentic hibachi at home experience in Dove Canyon. Professional Hibachi Chefs bring the excitement of teppanyaki cooking directly to your home.",
    url: "https://www.realhibachi.com/service-area/orange-county/dove-canyon",
    type: "website",
    locale: "en_US"
  }
}

export default function DoveCanyonPage() {
  return <DoveCanyonServiceClient />
}
