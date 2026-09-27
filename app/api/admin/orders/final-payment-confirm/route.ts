import { resolveAdminActor } from "@/lib/admin-auth"
import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { registerFinalPayment } from "@/lib/final-payment"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Staff-only: record a balance payment the pipeline did not book itself —
// cash / Venmo / Zelle taken at the party, or a card payment that needs
// entering by hand. The payment rides as type "final" onto the EXISTING order
// (matched by its source_ref), so the payments projection and balance snapshot
// settle and the order advances to 已办完. Audit-first: operator + proof
// recorded.
//
// The "stripe" channel exists because a card payment entered as "other" loses
// the one thing that makes it reconcilable — the payment intent id. Entered
// under this channel the row carries provider "stripe" and the real pi_ as
// both its identity and its transaction ref, so it lines up with the Stripe
// dashboard and with anything the webhook books for the same payment.
async function isAuthorized(request: NextRequest): Promise<boolean> {
  return (await resolveAdminActor(request)) !== null
}

const CHANNELS = ["cash", "venmo", "zelle", "stripe", "other"] as const

// pi_ (payment intent), ch_/py_ (charge), cs_ (checkout session).
const STRIPE_REF_PATTERN = /^(pi|ch|py|cs)_[A-Za-z0-9_]{8,}$/

function asTrimmed(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const t = value.trim()
  return t ? t : undefined
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: {
    orderId?: string
    amount?: number
    channel?: string
    proofUrl?: string
    operator?: string
    paymentRef?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const orderId = asTrimmed(body.orderId)
  const channel = (asTrimmed(body.channel)?.toLowerCase() ?? "") as (typeof CHANNELS)[number]
  const amount = Number(body.amount)
  const operator = asTrimmed(body.operator) ?? "staff"
  const proofUrl = asTrimmed(body.proofUrl)
  const paymentRef = asTrimmed(body.paymentRef)

  if (!orderId) return NextResponse.json({ error: "orderId is required" }, { status: 400 })
  if (!CHANNELS.includes(channel)) {
    return NextResponse.json({ error: `channel must be one of ${CHANNELS.join("/")}` }, { status: 400 })
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > 20000) {
    return NextResponse.json({ error: "amount must be between 0 and 20000" }, { status: 400 })
  }
  if (channel === "stripe" && (!paymentRef || !STRIPE_REF_PATTERN.test(paymentRef))) {
    return NextResponse.json(
      { error: "stripe channel requires paymentRef like pi_… (the Stripe payment intent id)" },
      { status: 400 },
    )
  }

  const supabase = createServerSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 500 })
  }

  const r = await registerFinalPayment(supabase, {
    orderId,
    amountCents: Math.round(amount * 100),
    channel,
    operator,
    paymentRef,
    proofUrl,
    entrySurface: "orders_workbench",
  })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ ok: true, orderNo: r.orderNo })

}
