import type { Metadata } from "next"
import FAQClientPage from "./FAQClientPage"

export const metadata: Metadata = {
  title: "Hibachi at Home FAQ Los Angeles | Real Hibachi Questions & Answers",
  description: "Get answers to common questions about hibachi at home service in Los Angeles & Orange County. Pricing, setup, booking process, and more. Professional teppanyaki chefs.",
  keywords: "hibachi at home FAQ Los Angeles, hibachi catering questions LA, teppanyaki at home Orange County, hibachi chef booking questions, Japanese chef service FAQ",
  openGraph: {
    title: "Hibachi at Home FAQ Los Angeles | Real Hibachi",
    description: "Common questions about hibachi at home service in Los Angeles. Learn about our professional teppanyaki catering experience.",
    url: "https://realhibachi.com/faq",
    siteName: "Real Hibachi",
    type: "website",
  },
}

export default function FAQPage() {
  return <FAQClientPage />
}
