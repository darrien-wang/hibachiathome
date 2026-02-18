"use client"

import { useEffect } from "react"
import { captureAttributionOnLanding } from "@/lib/tracking"

export function TrackingBootstrap() {
  useEffect(() => {
    captureAttributionOnLanding(window.location.search)
  }, [])

  return null
}
