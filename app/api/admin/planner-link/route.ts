import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"

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
async function isAuthorized(request: NextRequest): Promise<boolean> {
  return (await resolveAdminActor(request)) !== null
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  let body: { email?: string; phone?: string; booked?: boolean; leadId?: string }
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
    // The lead id rides along so what the customer then does in the planner
    // (opened it, invited guests, finished the menu) lands on this lead's
    // timeline. The planner only accepts a lead id with the shared admin
    // token - a browser cannot attach one - so the header goes with it.
    const adminToken = process.env.INVOICE_UPDATE_ADMIN_TOKEN?.trim()
    const leadId = String(body.leadId ?? "").trim()
    const res = await fetch(`${PLANNER_HOST}/api/order-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(adminToken ? { "x-admin-token": adminToken } : {}) },
      body: JSON.stringify({
        email: email || undefined,
        phone: phone || undefined,
        booked: body.booked === true,
        leadId: adminToken && leadId ? leadId : undefined,
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
