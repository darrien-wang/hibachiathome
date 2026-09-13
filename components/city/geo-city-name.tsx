"use client"

import { useEffect, useState } from "react"
import { geoLocationName } from "@/config/geo-locations"

// Ads clicks arrive with ?loc=<geo target id> (account final URL suffix). When the
// visitor's city is known and differs from the page's city, show theirs — the
// headline they clicked already said it. Server-renders the fallback so there is
// no hydration mismatch; swaps after mount.
//
// Resolution order: the small static table (top SoCal cities, ships with the
// page) → /api/geo-name (full California table incl. postal codes, server-side).
// Google sends a postal-code id for most phone clicks, so the API path is the
// common one; one cached fetch per page view.

const resolved = new Map<string, Promise<string | null>>()

function resolveLoc(loc: string): Promise<string | null> {
  const local = geoLocationName(loc)
  if (local) return Promise.resolve(local)
  let p = resolved.get(loc)
  if (!p) {
    p = fetch(`/api/geo-name?loc=${encodeURIComponent(loc)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { name?: string | null } | null) => (d && typeof d.name === "string" && d.name ? d.name : null))
      .catch(() => null)
    resolved.set(loc, p)
  }
  return p
}

export function useLocCity(fallback: string, enabled = true): string {
  const [city, setCity] = useState(fallback)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    try {
      const loc = new URLSearchParams(window.location.search).get("loc")
      if (!loc || !/^\d{1,12}$/.test(loc)) return
      resolveLoc(loc).then((name) => {
        if (alive && name) setCity(name)
      })
    } catch {
      // ignore — keep the page city
    }
    return () => {
      alive = false
    }
  }, [enabled])
  return enabled ? city : fallback
}

/** `enabled=false` pins the page's own city (see GEO_GREETING_SLUGS in config/geo-locations). */
export default function GeoCityName({ fallback, enabled = true }: { fallback: string; enabled?: boolean }) {
  const city = useLocCity(fallback, enabled)
  return <>{city}</>
}
