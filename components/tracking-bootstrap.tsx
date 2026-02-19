"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { captureAttributionOnLanding, trackEvent } from "@/lib/tracking"

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

  useEffect(() => {
    if (window.__realHibachiLastPageViewKey === pathWithSearch) {
      return
    }

    window.__realHibachiLastPageViewKey = pathWithSearch
    trackEvent("page_view")
  }, [pathWithSearch])

  return null
}
