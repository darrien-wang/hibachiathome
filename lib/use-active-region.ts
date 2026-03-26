"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { DEFAULT_REGION_CODE, type RegionCode } from "@/config/regional-policies"
import { persistRegionCookie, resolveRegionForClient } from "@/lib/region-resolver"

export function useActiveRegion(fallbackRegion: RegionCode = DEFAULT_REGION_CODE): RegionCode {
  const searchParams = useSearchParams()
  const searchParamsKey = searchParams.toString()
  const [activeRegion, setActiveRegion] = useState<RegionCode>(fallbackRegion)

  useEffect(() => {
    const resolvedRegion = resolveRegionForClient({
      searchParams: searchParamsKey,
      cookieString: typeof document !== "undefined" ? document.cookie : null,
      fallbackRegion,
    })

    setActiveRegion((current) => (current === resolvedRegion ? current : resolvedRegion))
    persistRegionCookie(resolvedRegion)
  }, [fallbackRegion, searchParamsKey])

  return activeRegion
}
