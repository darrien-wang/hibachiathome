"use client"

import { useEffect } from "react"
import Link from "next/link"
import { siteConfig } from "@/config/site"
import { reportClientError } from "@/lib/report-client-error"

// Page-level crash screen. Next.js's built-in fallback is a bare line of black
// serif text on white — a paid visitor who hits it is simply gone. This one
// costs nothing to keep alive and hands them the two things that still work
// when React does not: the retry button and the phone.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    reportClientError(error, "error_boundary")
  }, [error])

  const smsHref = `sms:+1${siteConfig.contact.phone.replace(/\D/g, "")}`

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold text-gray-900">This page hit a snag</h1>
      <p className="text-gray-600">
        Sorry — something broke on our end, not yours. Reloading usually fixes it, and if it
        doesn&apos;t, text us and we&apos;ll quote your party by hand in a few minutes.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-amber-500 px-5 py-2.5 font-medium text-white transition-colors hover:bg-amber-600"
        >
          Try again
        </button>
        <a
          href={smsHref}
          className="rounded-lg border border-gray-300 px-5 py-2.5 font-medium text-gray-800 transition-colors hover:bg-gray-50"
        >
          Text {siteConfig.contact.phone}
        </a>
      </div>
      <Link href="/" className="text-sm text-gray-500 underline underline-offset-2 hover:text-gray-700">
        Back to the homepage
      </Link>
      {error.digest ? <p className="text-xs text-gray-400">Reference: {error.digest}</p> : null}
    </div>
  )
}
