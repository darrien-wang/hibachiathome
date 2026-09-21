import { NextRequest, NextResponse } from "next/server"
import { findDepositLock } from "@/lib/deposit-lock"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"

// Asked by the deposit page as it opens: is this party already locked?
// Read-only. Answers with the order number and a planner link only when the
// caller holds the lead id from the texted link; an email + date match gets
// a bare yes/no. Never cached: a restored Safari tab must see the truth.
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const limit = await rateLimit("deposit-status", request, 30, 60)
  if (!limit.ok) {
    const { status, body } = tooManyRequests()
    return NextResponse.json(body, { status })
  }

  const params = request.nextUrl.searchParams
  const lock = await findDepositLock({
    leadId: params.get("lead_id"),
    email: params.get("email"),
    eventDate: params.get("event_date"),
  })

  const body = lock.locked
    ? {
        locked: true,
        order_no: lock.matchedBy === "lead" ? lock.orderNo : undefined,
        event_date: lock.eventDate ?? undefined,
        event_time: lock.eventTime ?? undefined,
        manage_url: lock.manageUrl ?? undefined,
      }
    : { locked: false }

  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } })
}
