import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { getDrivingMiles, TravelDistanceError } from "@/lib/travel-distance"
import { calcTravelFee, TRAVEL_FREE_RADIUS_MILES, TRAVEL_RATE_PER_MILE } from "@/config/pricing-rules"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BASE_ORIGIN_ZIP = "91748"

// Staff-only driving-distance calculator for the order workbench. One engine
// (lib/travel-distance: Google Distance Matrix, OSRM keyless fallback), two
// origins by purpose:
//   customer -> base zip -> event address, priced by the shared travel policy
//               (the number the invoice's travelFee.distanceMiles wants)
//   chef     -> the chef's own address -> event address, for nearest-chef
//               dispatch and reimbursing the drive; miles only, no policy fee
// Results are appended to order_events so the same order never needs the same
// call twice and the drawer shows who calculated what.
function isAuthorized(request: NextRequest): boolean {
  const provided = request.headers.get("x-admin-key") ?? ""
  if (!provided) return false
  const owner = process.env.ADMIN_DASH_KEY
  if (owner && provided === owner) return true
  for (const entry of (process.env.AGENT_DASH_KEYS ?? "").split(",")) {
    const [alias, key] = entry.split(":").map((s) => s?.trim())
    if (alias && key && provided === key) return true
  }
  return false
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: {
    orderId?: string
    origin?: string
    destination?: string
    purpose?: string
    operator?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const destination = String(body.destination ?? "").trim()
  const purpose = body.purpose === "chef" ? "chef" : "customer"
  const origin = String(body.origin ?? "").trim() || BASE_ORIGIN_ZIP

  if (!destination) {
    return NextResponse.json({ error: "destination is required" }, { status: 400 })
  }
  if (purpose === "chef" && !String(body.origin ?? "").trim()) {
    return NextResponse.json({ error: "chef purpose requires the chef's origin address" }, { status: 400 })
  }

  try {
    const result = await getDrivingMiles(origin, destination)
    const customerFee = purpose === "customer" ? calcTravelFee(result.drivingMiles) : null

    const orderId = String(body.orderId ?? "").trim()
    if (orderId) {
      const supabase = createServerSupabaseClient()
      if (supabase) {
        await supabase.from("order_events").insert({
          order_id: orderId,
          actor: `admin:${String(body.operator ?? "staff").trim() || "staff"}`,
          action: "travel_distance_calculated",
          metadata: {
            purpose,
            origin: result.origin.label,
            destination: result.destination.label,
            driving_miles: result.drivingMiles,
            customer_fee: customerFee,
            provider: result.provider,
          },
        })
      }
    }

    return NextResponse.json({
      ok: true,
      purpose,
      origin: result.origin.label,
      destination: result.destination.label,
      miles: result.drivingMiles,
      customerFee,
      freeRadiusMiles: TRAVEL_FREE_RADIUS_MILES,
      ratePerMile: TRAVEL_RATE_PER_MILE,
      provider: result.provider,
    })
  } catch (error) {
    const code = error instanceof TravelDistanceError ? error.code : "provider_unavailable"
    return NextResponse.json({ ok: false, error: code }, { status: 200 })
  }
}
