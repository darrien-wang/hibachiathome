"use client"

import { useEffect, useState } from "react"
import { DEFAULT_REGION_CODE, type RegionCode } from "@/config/regional-policies"
import { persistRegionCookie, resolveRegionForClient } from "@/lib/region-resolver"

// NOTE: This hook intentionally reads window.location.search inside useEffect
// instead of calling useSearchParams(). useSearchParams() forces the nearest
// Suspense boundary to bail out of static prerendering, which previously left
// the homepage (and any page using this hook) with an empty server-rendered
// body — invisible to search engines and AI crawlers.
export function useActiveRegion(fallbackRegion: RegionCode = DEFAULT_REGION_CODE): RegionCode {
  const [activeRegion, setActiveRegion] = useState<RegionCode>(fallbackRegion)

  useEffect(() => {
    const searchParamsKey =
      typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : ""

    const resolvedRegion = resolveRegionForClient({
      searchParams: searchParamsKey,
      cookieString: typeof document !== "undefined" ? document.cookie : null,
      fallbackRegion,
    })

    setActiveRegion((current) => (current === resolvedRegion ? current : resolvedRegion))
    persistRegionCookie(resolvedRegion)
  }, [fallbackRegion])

  return activeRegion
}
