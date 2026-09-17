"use client"

import { useEffect } from "react"
import { INTERNAL_COOKIE_MAX_AGE_SECONDS, INTERNAL_COOKIE_NAME } from "@/lib/internal-traffic"

// Anyone who opens the /admin workbench is staff. GTM never loads on /admin, so
// this only leaves the marker behind: the next time this browser opens a
// public page, lib/internal-traffic.ts tags its GA4 events as internal.
export function MarkInternal() {
  useEffect(() => {
    document.cookie = `${INTERNAL_COOKIE_NAME}=1; Max-Age=${INTERNAL_COOKIE_MAX_AGE_SECONDS}; path=/; SameSite=Lax`
  }, [])
  return null
}
