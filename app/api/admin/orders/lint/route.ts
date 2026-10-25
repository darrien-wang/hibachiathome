import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"
import { fetchOrderLint } from "@/lib/order-lint-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/admin/orders/lint?id=<order id or RH- number>   (admin)
//
// What the order is missing that the customer is owed, as the invoice app's
// order lint sees it (D-1017-02) - the desk's `order show` / `order remind`
// read it here with the admin key; the invoice app's own route takes the
// shared token this side holds. Read-only.
export async function GET(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  const id = (request.nextUrl.searchParams.get("id") ?? "").trim()
  if (!id) return NextResponse.json({ ok: false, error: "id=<order id or RH- number> is required" }, { status: 400 })
  const lint = await fetchOrderLint(id)
  if (!lint) return NextResponse.json({ ok: false, error: "the invoice app's order lint did not answer" }, { status: 502 })
  return NextResponse.json({ ok: true, ...lint })
}
