import { DEFAULT_REGION_CODE, REGION_COOKIE_KEY, type RegionCode, normalizeRegionCode } from "@/config/regional-policies"

type ResolveRegionForClientOptions = {
  searchParams?: URLSearchParams | string | null
  cookieString?: string | null
  fallbackRegion?: RegionCode
}

const REGION_QUERY_KEYS = ["region", "service_region"] as const

function extractRegionFromSearch(searchParams?: URLSearchParams | string | null): RegionCode | null {
  if (!searchParams) {
    return null
  }

  const params =
    typeof searchParams === "string"
      ? new URLSearchParams(searchParams.startsWith("?") ? searchParams.slice(1) : searchParams)
      : searchParams

  for (const key of REGION_QUERY_KEYS) {
    const resolved = normalizeRegionCode(params.get(key))
    if (resolved) {
      return resolved
    }
  }

  return null
}

export function extractRegionFromCookie(cookieString?: string | null): RegionCode | null {
  if (!cookieString) {
    return null
  }

  const cookieMap = cookieString
    .split(";")
    .map((cookiePart) => cookiePart.trim())
    .filter(Boolean)

  for (const cookieEntry of cookieMap) {
    const separatorIndex = cookieEntry.indexOf("=")
    if (separatorIndex <= 0) {
      continue
    }

    const key = cookieEntry.slice(0, separatorIndex)
    if (key !== REGION_COOKIE_KEY) {
      continue
    }

    const value = cookieEntry.slice(separatorIndex + 1)
    return normalizeRegionCode(decodeURIComponent(value))
  }

  return null
}

export function resolveRegionForClient(options: ResolveRegionForClientOptions = {}): RegionCode {
  const queryRegion = extractRegionFromSearch(options.searchParams)
  if (queryRegion) {
    return queryRegion
  }

  const cookieRegion = extractRegionFromCookie(options.cookieString)
  if (cookieRegion) {
    return cookieRegion
  }

  return options.fallbackRegion ?? DEFAULT_REGION_CODE
}

export function persistRegionCookie(region: RegionCode, cookieDays = 90): void {
  if (typeof document === "undefined") {
    return
  }

  const maxAgeSeconds = Math.max(1, Math.floor(cookieDays * 24 * 60 * 60))
  document.cookie = `${REGION_COOKIE_KEY}=${encodeURIComponent(region)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`
}
