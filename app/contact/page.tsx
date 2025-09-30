import type { Metadata } from "next"
import ContactPageClient from "./ContactPageClient"

export const metadata: Metadata = {
  title: "Contact Real Hibachi Los Angeles | Book Hibachi Chef at Home",
  description: "Contact Real Hibachi for premium hibachi catering in Los Angeles & Orange County. Call (213) 770-7788 to book your authentic Japanese teppanyaki experience today!",
  keywords: "contact hibachi chef Los Angeles, book hibachi LA, hibachi catering contact Orange County, Japanese chef hire Los Angeles, Real Hibachi phone number",
  openGraph: {
    title: "Contact Real Hibachi Los Angeles | Book Hibachi Chef",
    description: "Ready to book your hibachi experience in Los Angeles? Contact us today for authentic Japanese teppanyaki at your home.",
    url: "https://realhibachi.com/contact",
    siteName: "Real Hibachi",
    type: "website",
  },
}

export default function ContactPage() {
  return <ContactPageClient />
}
