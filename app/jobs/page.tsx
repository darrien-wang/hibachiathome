import type { Metadata } from "next"
import { Suspense } from "react"
import JobsPageClient from "./JobsPageClient"

// Unlisted, like /referral: the page is live and anyone with the link can use
// it, but it stays out of search and out of site navigation. Customers looking
// for dinner should not land on a hiring page, and pay ladders and training
// terms are not something we want indexed next to the menu.
export const metadata: Metadata = {
  title: "Weekend Hibachi Chef & Apprentice Jobs | Real Hibachi",
  description:
    "Weekend hibachi chef and apprentice openings across Southern California. Shared directly with applicants.",
  robots: { index: false, follow: false },
}

export default function JobsPage() {
  return (
    <Suspense fallback={null}>
      <JobsPageClient />
    </Suspense>
  )
}
