import { type NextRequest, NextResponse } from "next/server"

import { signAgreedTotal } from "@/lib/agreed-total"

export const dynamic = "force-dynamic"

// Staff-only: sign a negotiated total for a lead's deposit link.
//   POST { leadId?, agreedTotal } -> { ok, agreedTotal, sig, query }
// `query` is ready to append to a /deposit/pay URL. It also pins the estimate
// to the agreed number so the deposit page shows the customer that price.
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
  if (!isAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  let body: { leadId?: string; agreedTotal?: number | string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  const leadId = String(body.leadId ?? "").trim()
  const amount = Math.round(Number(body.agreedTotal) * 100) / 100
  const sig = signAgreedTotal(leadId, amount)
  if (!sig) return NextResponse.json({ ok: false, error: "agreedTotal must be a positive dollar amount" }, { status: 400 })
  const fixed = amount.toFixed(2)
  const query = new URLSearchParams({ agreed_total: fixed, agreed_sig: sig, estimate_low: fixed, estimate_high: fixed }).toString()
  return NextResponse.json({ ok: true, agreedTotal: amount, sig, query })
}
