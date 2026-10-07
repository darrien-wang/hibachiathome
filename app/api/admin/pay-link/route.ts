import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"
import { getStripeServerClient } from "@/lib/stripe-server"
import { createServerSupabaseClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

const INVOICE_BALANCE_API = "https://invoice.realhibachi.com/api/self-service/orders/balance"

// Staff-only credit-card balance links.
//
//   action:"quote"  { orderId? | phone?, email? } -> live balance from the invoice
//                                                system: the single source of truth
//                                                for the two bills (cash / card with the
//                                                party's sales tax and
//                                                card processing under the by-method
//                                                terms, +4% under v1), gratuity tier
//                                                and deposit - so texted links and the
//                                                workbench never drift from the invoice.
//   (default)       { amount, ... }            -> mint a Stripe Checkout link for exactly
//                                                that amount (金额从不加 4%，09-28 起; the
//                                                caller passes the card bill the invoice
//                                                quoted).
// Which order this link settles. The webhook can only book the money against
// an order it can name, so the link is stamped with the order's source_ref at
// mint time — before this existed, every paid balance link was dropped on the
// floor and had to be typed back in by hand.
type LinkedOrder = { id: string; order_no: string | null; source_ref: string }

function asTrimmed(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

async function resolveOrderForLink(params: {
  orderId?: string
  phone?: string
  email?: string
}): Promise<{ order: LinkedOrder | null; reason?: string }> {
  const supabase = createServerSupabaseClient()
  if (!supabase) return { order: null, reason: "supabase_not_configured" }

  if (params.orderId) {
    const { data, error } = await supabase
      .from("orders")
      .select("id, order_no, source_ref")
      .eq("id", params.orderId)
      .maybeSingle()
    if (error) return { order: null, reason: `lookup_failed:${error.message}` }
    if (!data) return { order: null, reason: "order_not_found" }
    if (!data.source_ref) return { order: null, reason: "order_has_no_source_ref" }
    return { order: data as LinkedOrder }
  }

  // Contact-matched links (the leads surface texts from a lead, not an order).
  // Attribute ONLY when the contact has exactly one open order with a balance:
  // booking the money against the wrong party is worse than not booking it,
  // and an unattributed payment still raises an ops email from the webhook.
  const digits = (params.phone ?? "").replace(/\D/g, "").slice(-10)
  const email = (params.email ?? "").trim().toLowerCase()
  if (!digits && !email) return { order: null, reason: "no_contact_given" }

  const filters: string[] = []
  if (digits) filters.push(`customer_phone.ilike.%${digits}%`)
  if (email) filters.push(`customer_email.ilike.${email}`)

  const { data, error } = await supabase
    .from("orders")
    .select("id, order_no, source_ref, balance_due_cents, order_status")
    .or(filters.join(","))
    .gt("balance_due_cents", 0)
    .neq("order_status", "cancelled")
    .limit(5)
  if (error) return { order: null, reason: `lookup_failed:${error.message}` }

  const candidates = (data ?? []).filter((row) => Boolean(row.source_ref))
  if (candidates.length !== 1) {
    return { order: null, reason: candidates.length === 0 ? "no_open_order_for_contact" : "ambiguous_contact_match" }
  }
  return { order: candidates[0] as LinkedOrder }
}

async function isAuthorized(request: NextRequest): Promise<boolean> {
  return (await resolveAdminActor(request)) !== null
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
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
    orderId?: string
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
        // orderId wins over contact (the order dialog knows its party); the lead dialog quotes by contact.
        body: JSON.stringify({ orderId: asTrimmed(body.orderId), phone: body.phone || undefined, email: body.email || undefined }),
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
  // 2026-09-28 用户定：收款链接不加 4%——填多少刷多少，和 /pay 一个口径。
  // amountIsFinal 参数保留但不再改变金额（老调用不炸）。
  const total = Math.round(amount * 100) / 100
  const name = String(body.customerName ?? "").trim().slice(0, 80)
  const note = String(body.note ?? "").trim().slice(0, 200)

  const linked = await resolveOrderForLink({
    orderId: asTrimmed(body.orderId),
    phone: body.phone,
    email: body.email,
  })

  try {
    const stripe = getStripeServerClient()
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // Card only - no Link. See app/api/deposit/start/route.ts for why.
      payment_method_types: ["card"],
      // A balance payment is not a deposit: the deposit success page fires
      // deposit tracking and speaks deposit language.
      success_url: "https://www.realhibachi.com/balance/success",
      cancel_url: "https://www.realhibachi.com/deposit/cancel",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(total * 100),
            product_data: {
              name: name ? `Real Hibachi Balance — ${name}` : "Real Hibachi Balance Payment",
              description: note || "Balance per your invoice",
            },
          },
        },
      ],
      metadata: {
        flow: "balance_payment",
        base_amount: amount.toFixed(2),
        customer_name: name || "unknown",
        note: note || "",
        // The webhook reads these three. order_source_ref is the one that
        // matters — it is how the CRM addresses an existing order.
        order_id: linked.order?.id ?? "",
        order_no: linked.order?.order_no ?? "",
        order_source_ref: linked.order?.source_ref ?? "",
        order_match: linked.order ? (body.orderId ? "by_order_id" : "by_contact") : `unmatched:${linked.reason ?? "unknown"}`,
      },
    })
    if (!session.url) throw new Error("no session url")
    return NextResponse.json({
      ok: true,
      url: session.url,
      total,
      base: amount,
      // Surfaced so staff can see, before sending the link, whether paying it
      // will settle the order on its own or land as an unattributed payment.
      linkedOrderNo: linked.order?.order_no ?? null,
      unmatchedReason: linked.order ? null : linked.reason ?? "unknown",
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
