import { getDrivingMiles, TravelDistanceError, type DistanceResult } from "@/lib/travel-distance"
import { coarserDestinations, MAX_PLAUSIBLE_MILES } from "@/lib/coarse-destination"
import { cityForZip } from "@/lib/zip-city"

// Driving miles from the home base to an address: the one number behind a
// quote's travel fee, the invoice's distance, and a chef's travel pay.
// Moved out of /api/quote/travel-fee (2026-10-04) so chef pay measures the
// same way the customer was quoted.

export type BaseDrive =
  | { ok: true; result: DistanceResult; approximate: boolean }
  | { ok: false; code: TravelDistanceError["code"] }

/** Nothing this far away is a real party — it's a geocode that went wrong. */
function implausible(miles: number): boolean {
  return !Number.isFinite(miles) || miles > MAX_PLAUSIBLE_MILES
}

export async function driveFromBase(origin: string, destination: string): Promise<BaseDrive> {
  let code: TravelDistanceError["code"] = "provider_unavailable"

  try {
    const result = await getDrivingMiles(origin, destination)
    if (!implausible(result.drivingMiles)) return { ok: true, result, approximate: false }
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
      return { ok: true, result, approximate: true }
    } catch {
      // try the next, coarser candidate
    }
  }

  return { ok: false, code }
}

/**
 * What a bare ZIP is sent to the router as: its USPS town with it, else the
 * ZIP anchored to California. The number alone is never geocoded - "90202"
 * (Bell) matched a place 882 driving miles away and the price API quoted an
 * $832 travel fee (2026-10-29).
 */
export function zipDestination(zip: string): string {
  const z = zip.trim().slice(0, 5)
  const town = cityForZip(z)
  return town ? `${town}, CA ${z}` : `${z}, CA`
}

/** driveFromBase for a ZIP, with the same guard and fallbacks as an address. */
export function driveFromBaseToZip(origin: string, zip: string): Promise<BaseDrive> {
  return driveFromBase(origin, zipDestination(zip))
}
