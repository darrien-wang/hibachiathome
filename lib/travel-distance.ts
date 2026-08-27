// ============================================================
// Driving distance for the travel fee
// ============================================================
// The travel fee is priced on DRIVING miles, not straight-line distance, so
// the free 50-mile radius means what a customer thinks it means.
//
// Provider order:
//   1. Google Distance Matrix, when GOOGLE_MAPS_API_KEY is configured.
//   2. OSRM, otherwise — free and keyless, matching the OpenStreetMap
//      geocoder this app already uses for address autocomplete.
//
// Runs server-side so the key never reaches the browser and so the
// geocoder sees one origin instead of every visitor's IP.

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving"
const GOOGLE_MATRIX_URL = "https://maps.googleapis.com/maps/api/distancematrix/json"

const METERS_PER_MILE = 1609.344
const USER_AGENT = "RealHibachi-Marketing/1.0 (support@realhibachi.com)"

export interface GeoPoint {
  lat: number
  lng: number
  label: string
}

export interface DistanceResult {
  drivingMiles: number
  provider: "google" | "osrm"
  origin: GeoPoint
  destination: GeoPoint
}

export class TravelDistanceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "origin_not_found"
      | "destination_not_found"
      | "no_route"
      | "provider_unavailable",
  ) {
    super(message)
    this.name = "TravelDistanceError"
  }
}

function milesFromMeters(meters: number): number {
  return Math.round((meters / METERS_PER_MILE) * 10) / 10
}

export async function geocode(query: string): Promise<GeoPoint | null> {
  const trimmed = query.trim()
  if (!trimmed) return null

  const params = new URLSearchParams({
    q: trimmed,
    format: "json",
    addressdetails: "0",
    countrycodes: "us",
    limit: "1",
  })

  const res = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
    // Addresses rarely move; let the platform cache identical lookups for a day.
    next: { revalidate: 86_400 },
  })
  if (!res.ok) return null

  const results = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>
  const hit = results?.[0]
  if (!hit) return null

  const lat = Number.parseFloat(hit.lat)
  const lng = Number.parseFloat(hit.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  return { lat, lng, label: hit.display_name }
}

async function routeWithOsrm(origin: GeoPoint, destination: GeoPoint): Promise<number | null> {
  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`
  const res = await fetch(`${OSRM_URL}/${coords}?overview=false`, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 86_400 },
  })
  if (!res.ok) return null

  const data = (await res.json()) as { code?: string; routes?: Array<{ distance?: number }> }
  if (data.code !== "Ok") return null

  const meters = data.routes?.[0]?.distance
  return typeof meters === "number" && Number.isFinite(meters) ? meters : null
}

async function routeWithGoogle(
  origin: GeoPoint,
  destination: GeoPoint,
  apiKey: string,
): Promise<number | null> {
  const params = new URLSearchParams({
    origins: `${origin.lat},${origin.lng}`,
    destinations: `${destination.lat},${destination.lng}`,
    units: "imperial",
    key: apiKey,
  })

  const res = await fetch(`${GOOGLE_MATRIX_URL}?${params}`, { next: { revalidate: 86_400 } })
  if (!res.ok) return null

  const data = (await res.json()) as {
    status?: string
    rows?: Array<{ elements?: Array<{ status?: string; distance?: { value?: number } }> }>
  }
  if (data.status !== "OK") return null

  const element = data.rows?.[0]?.elements?.[0]
  if (element?.status !== "OK") return null

  const meters = element.distance?.value
  return typeof meters === "number" && Number.isFinite(meters) ? meters : null
}

/**
 * Driving miles between two free-text US addresses.
 * Throws TravelDistanceError so the caller can tell the customer which half
 * of the lookup failed rather than silently pricing the trip at $0.
 */
export async function getDrivingMiles(
  originQuery: string,
  destinationQuery: string,
): Promise<DistanceResult> {
  const [origin, destination] = await Promise.all([
    geocode(originQuery),
    geocode(destinationQuery),
  ])

  if (!origin) {
    throw new TravelDistanceError(`Could not locate the home base: ${originQuery}`, "origin_not_found")
  }
  if (!destination) {
    throw new TravelDistanceError(
      `Could not locate the event address: ${destinationQuery}`,
      "destination_not_found",
    )
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  let meters: number | null = null
  let provider: DistanceResult["provider"] = "osrm"

  if (apiKey) {
    meters = await routeWithGoogle(origin, destination, apiKey)
    if (meters != null) provider = "google"
  }
  if (meters == null) {
    meters = await routeWithOsrm(origin, destination)
    provider = "osrm"
  }

  if (meters == null) {
    throw new TravelDistanceError(
      "No driving route found between the home base and the event address.",
      "no_route",
    )
  }

  return { drivingMiles: milesFromMeters(meters), provider, origin, destination }
}
