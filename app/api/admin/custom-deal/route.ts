import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"

import { encodeDeal, normalizeDeal, signDeal } from "@/lib/custom-deal"

export const dynamic = "force-dynamic"

// Staff-only: sign the owner's deal for a lead's deposit link.
//   POST { leadId, adultRate?, childRate?, freeExtraIds?, extraRates?, flatOff?, travelWaived?, note? }
//     -> { ok, deal, query }
// extraRates bills an extra at a set price per unit, e.g. { tables_chairs: 5 }
// for Saturday's half-price tables (D-1017-01). travelWaived: true puts the
// travel on the owner - the order bills $0 travel and keeps the miles.
// `query` appends to a /deposit/pay URL. Unlike agreed_total (one frozen
// number), these rules travel to the order system and are re-priced whenever
// the party changes - headcount, upgrades, rentals.
async function isAuthorized(request: NextRequest): Promise<boolean> {
  return (await resolveAdminActor(request)) !== null
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const leadId = String(body.leadId ?? "").trim()
  const deal = normalizeDeal(body.deal ?? body)
  if (!deal) {
    return NextResponse.json(
      { ok: false, error: "give at least one rule: adultRate, childRate, freeExtraIds, extraRates, flatOff or travelWaived" },
      { status: 400 },
    )
  }
  const encoded = encodeDeal(deal)
  // Checkout carries the deal in a 500-character Stripe metadata field; a
  // longer one would verify on the page and then be cut off on the way to the
  // order, so the party would be billed at catalog price.
  if (encoded.length > 500) {
    return NextResponse.json({ ok: false, error: "deal too long to carry through checkout - fewer extras or a shorter note" }, { status: 400 })
  }
  const sig = signDeal(leadId, encoded)
  if (!sig) return NextResponse.json({ ok: false, error: "cannot sign - AGREED_TOTAL_SECRET / ADMIN_DASH_KEY missing" }, { status: 500 })

  const query = new URLSearchParams({ deal: encoded, deal_sig: sig }).toString()
  return NextResponse.json({ ok: true, deal, query })
}
