import { NextRequest, NextResponse } from "next/server"
import { depositAmountFor, toOfferView } from "@/config/deposit-offers"
import { readOfferAttribution, resolveDepositOffer } from "@/lib/deposit-offer"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"

export const runtime = "nodejs"

// What the deposit page should show: the same answer /api/deposit/start will
// charge, derived from this visit's attribution and the lead the link names.
export async function GET(request: NextRequest) {
  const limit = await rateLimit("deposit-offer", request, 30, 60)
  if (!limit.ok) {
    const { status, body } = tooManyRequests()
    return NextResponse.json(body, { status })
  }
  const leadId = request.nextUrl.searchParams.get("lead_id")?.trim() || undefined
  const offer = await resolveDepositOffer({ attribution: readOfferAttribution(request), leadId })
  return NextResponse.json(
    { amount: depositAmountFor(offer), offer: offer ? toOfferView(offer) : null },
    { headers: { "Cache-Control": "no-store" } },
  )
}
