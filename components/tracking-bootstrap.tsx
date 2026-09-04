"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { captureAttributionOnLanding, trackEvent } from "@/lib/tracking"
import { installGlobalErrorReporting } from "@/lib/report-client-error"

declare global {
  interface Window {
    __realHibachiLastPageViewKey?: string
  }
}

export function TrackingBootstrap() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams.toString()
  const pathWithSearch = `${pathname}${search ? `?${search}` : ""}`

  useEffect(() => {
    captureAttributionOnLanding(search ? `?${search}` : "")
  }, [search])

  // Error boundaries only see render-time throws. Rejected promises, throwing
  // listeners and third-party scripts need these listeners, and this component
  // is already mounted on every page.
  useEffect(() => installGlobalErrorReporting(), [])

  useEffect(() => {
    if (window.__realHibachiLastPageViewKey === pathWithSearch) {
      return
    }

    window.__realHibachiLastPageViewKey = pathWithSearch
    trackEvent("page_view")
  }, [pathWithSearch])

  return null
}
