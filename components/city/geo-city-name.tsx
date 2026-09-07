"use client"

import { useEffect, useState } from "react"
import { geoLocationName } from "@/config/geo-locations"

// Ads clicks arrive with ?loc=<geo target id> (account final URL suffix). When the
// visitor's city is known and differs from the page's city, show theirs — the
// headline they clicked already said it. Server-renders the fallback so there is
// no hydration mismatch; swaps after mount.

export function useLocCity(fallback: string): string {
  const [city, setCity] = useState(fallback)
  useEffect(() => {
    try {
      const loc = new URLSearchParams(window.location.search).get("loc")
      const name = geoLocationName(loc)
      if (name) setCity(name)
    } catch {
      // ignore — keep the page city
    }
  }, [])
  return city
}

export default function GeoCityName({ fallback }: { fallback: string }) {
  const city = useLocCity(fallback)
  return <>{city}</>
}
