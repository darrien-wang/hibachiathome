import type { Metadata } from "next"
import FAQClientPage from "./FAQClientPage"

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
}

export default function FAQPage() {
  return <FAQClientPage />
}
