import { type NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const PLANNER_HOST = "https://party.realhibachi.com"

// Staff-only: mint a personal party-planner link for a lead.
//
// The key carries the lead's email+phone, so the planner opens already tied
// to their identity: the anchor registry reconnects any session they started
// earlier (under email OR phone, any formatting), or starts a fresh one that
// future visits will converge on. `booked:true` (won leads) additionally tells
// the planner the deposit is confirmed - regardless of channel (Stripe, Venmo,
// Zelle) - so the customer never sees an "unpaid deposit" warning.
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
  let body: { email?: string; phone?: string; booked?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  const email = String(body.email ?? "").trim()
  const phone = String(body.phone ?? "").trim()
  if (!email && !phone) {
    return NextResponse.json({ ok: false, error: "email or phone required" }, { status: 400 })
  }
  try {
    const res = await fetch(`${PLANNER_HOST}/api/order-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email || undefined,
        phone: phone || undefined,
        booked: body.booked === true,
      }),
      cache: "no-store",
    })
    const data = await res.json()
    if (!res.ok || !data.ok || !data.id) {
      return NextResponse.json({ ok: false, error: data?.error || "mint failed" }, { status: 502 })
    }
    return NextResponse.json({ ok: true, url: `${PLANNER_HOST}/order?key=${data.id}` })
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 502 })
  }
}
