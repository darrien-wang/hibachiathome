import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"

import { encodeDeal, normalizeDeal, signDeal } from "@/lib/custom-deal"

export const dynamic = "force-dynamic"

// Staff-only: sign the owner's deal for a lead's deposit link.
//   POST { leadId, adultRate?, childRate?, freeExtraIds?, flatOff?, note? }
//     -> { ok, deal, query }
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
      { ok: false, error: "give at least one rule: adultRate, childRate, freeExtraIds or flatOff" },
      { status: 400 },
    )
  }
  const encoded = encodeDeal(deal)
  const sig = signDeal(leadId, encoded)
  if (!sig) return NextResponse.json({ ok: false, error: "cannot sign - AGREED_TOTAL_SECRET / ADMIN_DASH_KEY missing" }, { status: 500 })

  const query = new URLSearchParams({ deal: encoded, deal_sig: sig }).toString()
  return NextResponse.json({ ok: true, deal, query })
}
