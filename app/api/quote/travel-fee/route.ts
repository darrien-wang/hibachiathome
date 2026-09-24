import { NextResponse } from "next/server"
import { getDrivingMiles, TravelDistanceError } from "@/lib/travel-distance"
import { homeBaseOrigin } from "@/config/home-base"
import {
  calcTravelFee,
  TRAVEL_FREE_RADIUS_MILES,
  TRAVEL_RATE_PER_MILE,
} from "@/config/pricing-rules"

export const runtime = "nodejs"

// Driving distance is measured from the dispatch home-base zip centroid —
// close enough against a 50-mile free radius, and the exact street address
// deliberately never appears in code, git history, or API responses.
// TRAVEL_ORIGIN_ADDRESS overrides without a deploy.
const ORIGIN_ZIP = homeBaseOrigin()

// Policy lives in config/pricing-rules.ts and is shared with the invoice app,
// so a quote and the invoice that follows it can never disagree. This route
// only turns an address into driving miles and applies that policy.
//
// Distance comes from OSRM by default — free and keyless, matching the
// OpenStreetMap geocoder — and from Google Distance Matrix when
// GOOGLE_MAPS_API_KEY is set. When neither can answer we say so instead of
// inventing a number: the previous version derived "miles" from the arithmetic
// difference between zip codes, which quoted travel fees off a figure that was
// not a distance at all.
/**
 * Coarser version of an address, for when the exact house does not geocode.
 * "8050 Stargate, Yucca Valley, CA 92284" has no entry in the map data (a real
 * customer address, 2026-09-24) but the town does - and a town-level distance
 * out in the desert is far better than quoting $0 travel for a 107-mile drive.
 */
function coarserDestination(destination: string): string | null {
  const zip = destination.match(/\b\d{5}(?:-\d{4})?\b/)?.[0]
  const cityState = destination.match(/([A-Za-z][A-Za-z .'-]{1,30}),\s*(?:CA|California)\b/i)?.[1]?.trim()
  if (cityState && zip) return `${cityState}, CA ${zip}`
  if (cityState) return `${cityState}, CA`
  if (zip) return zip
  return null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const destination = (searchParams.get("destination") ?? "").trim()
  // Optional origin override lets the staff invoice tool measure from an
  // edited home base while sharing this route's providers and policy.
  const origin = (searchParams.get("origin") ?? "").trim() || ORIGIN_ZIP

  if (!destination) {
    return NextResponse.json(
      {
        error: "Missing destination",
        origin_zip: origin,
        distance_miles: null,
        travel_fee_range: { low: 0, high: 0 },
        free_radius_miles: TRAVEL_FREE_RADIUS_MILES,
        rate_per_mile: TRAVEL_RATE_PER_MILE,
        source: "missing_destination",
      },
      { status: 400 },
    )
  }

  try {
    const result = await getDrivingMiles(origin, destination)
    const fee = calcTravelFee(result.drivingMiles)

    return NextResponse.json({
      origin_zip: origin,
      destination: result.destination.label,
      distance_miles: result.drivingMiles,
      chargeable_miles: Math.round(Math.max(0, result.drivingMiles - TRAVEL_FREE_RADIUS_MILES) * 10) / 10,
      travel_fee_range: { low: fee, high: fee },
      free_radius_miles: TRAVEL_FREE_RADIUS_MILES,
      rate_per_mile: TRAVEL_RATE_PER_MILE,
      source: result.provider,
    })
  } catch (error) {
    // The exact house may not exist in the map data. Try the town before
    // giving up - an approximate distance beats a $0 fee on a 107-mile drive.
    const coarser = coarserDestination(destination)
    if (coarser && coarser.toLowerCase() !== destination.toLowerCase()) {
      try {
        const result = await getDrivingMiles(origin, coarser)
        const fee = calcTravelFee(result.drivingMiles)
        return NextResponse.json({
          origin_zip: origin,
          destination: result.destination.label,
          requested_destination: destination,
          distance_miles: result.drivingMiles,
          chargeable_miles: Math.round(Math.max(0, result.drivingMiles - TRAVEL_FREE_RADIUS_MILES) * 10) / 10,
          travel_fee_range: { low: fee, high: fee },
          free_radius_miles: TRAVEL_FREE_RADIUS_MILES,
          rate_per_mile: TRAVEL_RATE_PER_MILE,
          source: `${result.provider}_city_fallback`,
          approximate: true,
        })
      } catch {
        // fall through to the unavailable response below
      }
    }
    // No usable route at all: quote $0 travel and let the team confirm, rather
    // than showing a guessed fee the invoice would then contradict.
    const code = error instanceof TravelDistanceError ? error.code : "provider_unavailable"
    return NextResponse.json(
      {
        origin_zip: origin,
        destination,
        distance_miles: null,
        travel_fee_range: { low: 0, high: 0 },
        free_radius_miles: TRAVEL_FREE_RADIUS_MILES,
        rate_per_mile: TRAVEL_RATE_PER_MILE,
        source: "unavailable",
        code,
      },
      { status: 200 },
    )
  }
}
