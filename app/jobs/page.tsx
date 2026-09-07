import type { Metadata } from "next"
import { Suspense } from "react"
import JobsPageClient from "./JobsPageClient"

// Unlisted, like /referral: the page is live and anyone with the link can use
// it, but it stays out of search and out of site navigation. Customers looking
// for dinner should not land on a hiring page, and pay ladders and training
// terms are not something we want indexed next to the menu.
// The title carries no " | Real Hibachi" suffix of its own — the root layout's
// template already appends one, and spelling it out here printed it twice.
export const metadata: Metadata = {
  title: "招聘周末上门铁板烧师傅／学徒",
  description: "南加州周末上门铁板烧师傅与学徒招聘。仅通过链接分享给应聘者。",
  robots: { index: false, follow: false },
}

export default function JobsPage() {
  return (
    <Suspense fallback={null}>
      <JobsPageClient />
    </Suspense>
  )
}
