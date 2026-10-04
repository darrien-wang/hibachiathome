import { getDrivingMiles, TravelDistanceError, type DistanceResult } from "@/lib/travel-distance"
import { coarserDestinations, MAX_PLAUSIBLE_MILES } from "@/lib/coarse-destination"

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
