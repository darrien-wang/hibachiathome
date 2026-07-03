import type { Metadata } from "next"
import FAQClientPage from "./FAQClientPage"
import { faqItems } from "@/config/faq"
import { JsonLd } from "@/components/structured-data"

export const metadata: Metadata = {
  title: "Hibachi at Home FAQ | Pricing, Setup & Booking Questions",
  description:
    "Get answers to common questions about hibachi at home service in Los Angeles & Orange County. Pricing, setup, booking process, and more. Professional teppanyaki chefs.",
  keywords:
    "hibachi at home FAQ Los Angeles, hibachi catering questions LA, teppanyaki at home Orange County, hibachi chef booking questions, Japanese chef service FAQ",
  openGraph: {
    title: "Hibachi at Home FAQ | Real Hibachi",
    description:
      "Common questions about hibachi at home service in Los Angeles. Learn about our professional teppanyaki catering experience.",
    url: "https://www.realhibachi.com/faq",
    siteName: "Real Hibachi",
    type: "website",
  },
}

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
}

export default function FAQPage() {
  return (
    <>
      <JsonLd data={faqJsonLd} />
      <FAQClientPage />
    </>
  )
}
