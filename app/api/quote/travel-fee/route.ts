import { NextResponse } from "next/server"
import { getDrivingMiles, TravelDistanceError, type DistanceResult } from "@/lib/travel-distance"
import { homeBaseOrigin } from "@/config/home-base"
import { coarserDestinations, MAX_PLAUSIBLE_MILES } from "@/lib/coarse-destination"
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
// inventing a number: an early version derived "miles" from the arithmetic
// difference between zip codes, which quoted travel fees off a figure that was
// not a distance at all.

/** Nothing this far away is a real party — it's a geocode that went wrong. */
function implausible(miles: number): boolean {
  return !Number.isFinite(miles) || miles > MAX_PLAUSIBLE_MILES
}

function quote(result: DistanceResult, origin: string, extra: Record<string, unknown> = {}) {
  const fee = calcTravelFee(result.drivingMiles)
  return NextResponse.json({
    origin_zip: origin,
    destination: result.destination.label,
    distance_miles: result.drivingMiles,
    chargeable_miles:
      Math.round(Math.max(0, result.drivingMiles - TRAVEL_FREE_RADIUS_MILES) * 10) / 10,
    travel_fee_range: { low: fee, high: fee },
    free_radius_miles: TRAVEL_FREE_RADIUS_MILES,
    rate_per_mile: TRAVEL_RATE_PER_MILE,
    source: result.provider,
    ...extra,
  })
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

  let code: TravelDistanceError["code"] = "provider_unavailable"

  try {
    const result = await getDrivingMiles(origin, destination)
    if (!implausible(result.drivingMiles)) return quote(result, origin)
    // The address geocoded, but to the wrong side of the country.
    code = "destination_not_found"
  } catch (error) {
    code = error instanceof TravelDistanceError ? error.code : "provider_unavailable"
  }

  // The exact house may not exist in the map data. Try the town, then the zip,
  // before giving up — an approximate distance beats a $0 fee on a 107-mile
  // drive. Anything still implausible is dropped rather than quoted.
  for (const candidate of coarserDestinations(destination)) {
    try {
      const result = await getDrivingMiles(origin, candidate)
      if (implausible(result.drivingMiles)) continue
      return quote(result, origin, {
        requested_destination: destination,
        source: `${result.provider}_city_fallback`,
        approximate: true,
      })
    } catch {
      // try the next, coarser candidate
    }
  }

  // No usable route at all: quote $0 travel and let the team confirm, rather
  // than showing a guessed fee the invoice would then contradict.
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
