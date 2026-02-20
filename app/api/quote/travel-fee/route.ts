import { NextResponse } from "next/server"

const ORIGIN_ZIP = "91748"

type FeeRange = { low: number; high: number }

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max))
}

function mapTravelFeeRangeByMiles(distanceMiles: number): FeeRange {
  if (distanceMiles <= 20) return { low: 0, high: 0 }
  const fee = Math.round(distanceMiles * 1)
  return { low: fee, high: fee }
}

function fallbackFeeRange(destination: string): { distanceMiles: number; feeRange: FeeRange } {
  const normalized = destination.trim().toLowerCase()
  if (!normalized) {
    return { distanceMiles: 0, feeRange: { low: 0, high: 0 } }
  }

  // Fallback estimate without external API.
  const zipMatch = normalized.match(/\b(\d{5})\b/)
  if (zipMatch) {
    const zip = Number.parseInt(zipMatch[1], 10)
    const origin = Number.parseInt(ORIGIN_ZIP, 10)
    const pseudoMiles = clampNumber(Math.abs(zip - origin) / 35, 0, 120)
    return { distanceMiles: Math.round(pseudoMiles), feeRange: mapTravelFeeRangeByMiles(pseudoMiles) }
  }

  // If user enters city text only, return conservative local estimate.
  const pseudoMiles = 18
  return { distanceMiles: pseudoMiles, feeRange: mapTravelFeeRangeByMiles(pseudoMiles) }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const destinationRaw = searchParams.get("destination") ?? ""
  const destination = destinationRaw.trim()

  if (!destination) {
    return NextResponse.json(
      {
        error: "Missing destination",
        origin_zip: ORIGIN_ZIP,
        distance_miles: 0,
        travel_fee_range: { low: 0, high: 0 },
      },
      { status: 400 },
    )
  }

  const zipMatch = destination.match(/\b\d{5}\b/)
  const destinationQuery = zipMatch ? zipMatch[0] : destination
  const apiKey = process.env.GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    const fallback = fallbackFeeRange(destinationQuery)
    return NextResponse.json({
      origin_zip: ORIGIN_ZIP,
      destination: destinationQuery,
      distance_miles: fallback.distanceMiles,
      travel_fee_range: fallback.feeRange,
      source: "fallback_no_api_key",
    })
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
      ORIGIN_ZIP,
    )}&destinations=${encodeURIComponent(destinationQuery)}&key=${apiKey}&units=imperial`

    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) {
      const fallback = fallbackFeeRange(destinationQuery)
      return NextResponse.json({
        origin_zip: ORIGIN_ZIP,
        destination: destinationQuery,
        distance_miles: fallback.distanceMiles,
        travel_fee_range: fallback.feeRange,
        source: "fallback_http_error",
      })
    }

    const data = await response.json()
    const element = data?.rows?.[0]?.elements?.[0]
    const meters = Number(element?.distance?.value ?? NaN)

    if (!Number.isFinite(meters)) {
      const fallback = fallbackFeeRange(destinationQuery)
      return NextResponse.json({
        origin_zip: ORIGIN_ZIP,
        destination: destinationQuery,
        distance_miles: fallback.distanceMiles,
        travel_fee_range: fallback.feeRange,
        source: "fallback_bad_distance",
      })
    }

    const miles = Math.round((meters / 1609.344) * 10) / 10
    return NextResponse.json({
      origin_zip: ORIGIN_ZIP,
      destination: destinationQuery,
      distance_miles: miles,
      travel_fee_range: mapTravelFeeRangeByMiles(miles),
      source: "google_distance_matrix",
    })
  } catch {
    const fallback = fallbackFeeRange(destinationQuery)
    return NextResponse.json({
      origin_zip: ORIGIN_ZIP,
      destination: destinationQuery,
      distance_miles: fallback.distanceMiles,
      travel_fee_range: fallback.feeRange,
      source: "fallback_exception",
    })
  }
}
