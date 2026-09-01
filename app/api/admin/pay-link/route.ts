import { type NextRequest, NextResponse } from "next/server"
import { getStripeServerClient } from "@/lib/stripe-server"

export const dynamic = "force-dynamic"

const CARD_FEE_RATE = 0.04 // must match the published policy (FAQ / invoice tool)
const INVOICE_BALANCE_API = "https://invoice.realhibachi.com/api/self-service/orders/balance"

// Staff-only credit-card balance links.
//
//   action:"quote"  { phone?, email? }        -> live balance from the invoice
//                                                system (gratuity tier, deposit,
//                                                card fee - the single source of
//                                                truth), so texted links can
//                                                never drift from the invoice.
//   (default)       { amount, base?, ... }    -> mint a Stripe Checkout link.
//                                                amountIsFinal=true charges the
//                                                exact amount (invoice already
//                                                includes the card fee);
//                                                otherwise 4% is added here.
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
    action?: string
    phone?: string
    email?: string
    amount?: number
    amountIsFinal?: boolean
    customerName?: string
    note?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  if (body.action === "quote") {
    try {
      const res = await fetch(INVOICE_BALANCE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: body.phone || undefined, email: body.email || undefined }),
        cache: "no-store",
      })
      const data = await res.json()
      return NextResponse.json(data, { status: res.ok ? 200 : res.status })
    } catch (error) {
      return NextResponse.json({ ok: false, error: String(error) }, { status: 502 })
    }
  }

  const amount = Number(body.amount)
  if (!Number.isFinite(amount) || amount < 1 || amount > 20000) {
    return NextResponse.json({ error: "amount must be between 1 and 20000" }, { status: 400 })
  }
  const amountIsFinal = body.amountIsFinal === true
  const total = amountIsFinal
    ? Math.round(amount * 100) / 100
    : Math.round(amount * (1 + CARD_FEE_RATE) * 100) / 100
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
              description: amountIsFinal
                ? note || "Balance per your invoice (all fees included)"
                : `Balance $${amount.toFixed(2)} + 4% card processing${note ? ` · ${note}` : ""}`,
            },
          },
        },
      ],
      metadata: {
        flow: "balance_payment",
        base_amount: amount.toFixed(2),
        amount_is_final: String(amountIsFinal),
        customer_name: name || "unknown",
        note: note || "",
      },
    })
    if (!session.url) throw new Error("no session url")
    return NextResponse.json({ ok: true, url: session.url, total, base: amount, amountIsFinal })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
