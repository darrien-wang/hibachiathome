import { type NextRequest, NextResponse } from "next/server"
import { getStripeServerClient } from "@/lib/stripe-server"

export const dynamic = "force-dynamic"

const CARD_FEE_RATE = 0.04 // must match the published policy (FAQ / invoice tool)

// Staff-only: mint a Stripe Checkout link for a balance (or any amount) so a
// credit-card customer can pay in seconds from a text. The 4% processing fee
// is added server-side by default so quoted balances stay pre-fee.
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
  let body: { amount?: number; customerName?: string; note?: string; addFee?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  const base = Number(body.amount)
  if (!Number.isFinite(base) || base < 1 || base > 20000) {
    return NextResponse.json({ error: "amount must be between 1 and 20000" }, { status: 400 })
  }
  const addFee = body.addFee !== false
  const total = addFee ? Math.round(base * (1 + CARD_FEE_RATE) * 100) / 100 : Math.round(base * 100) / 100
  const name = String(body.customerName ?? "").trim().slice(0, 80)
  const note = String(body.note ?? "").trim().slice(0, 200)

  try {
    const stripe = getStripeServerClient()
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: "https://www.realhibachi.com/deposit/success?flow=balance",
      cancel_url: "https://www.realhibachi.com/deposit/cancel",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(total * 100),
            product_data: {
              name: name ? `Real Hibachi Balance — ${name}` : "Real Hibachi Balance Payment",
              description: addFee
                ? `Balance $${base.toFixed(2)} + 4% card processing${note ? ` · ${note}` : ""}`
                : note || undefined,
            },
          },
        },
      ],
      metadata: {
        flow: "balance_payment",
        base_amount: base.toFixed(2),
        fee_added: String(addFee),
        customer_name: name || "unknown",
        note: note || "",
      },
    })
    if (!session.url) throw new Error("no session url")
    return NextResponse.json({ ok: true, url: session.url, total, base, feeAdded: addFee })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
