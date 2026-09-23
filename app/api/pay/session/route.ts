import { NextRequest, NextResponse } from "next/server"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"
import { getStripeServerClient } from "@/lib/stripe-server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { computeCharge, dollars } from "@/lib/pay-link-math"
import { loadPayContext } from "@/lib/pay-balance"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 客户在 /pay 填完小费按"Pay"走到这里：现算余额 → 加上小费 → 铸一条 Stripe
// Checkout。
//
// 尾款金额**不接受客户端传**：只有小费是客户说了算，尾款永远现查发票系统。
// 客户端传过来的只有小费，而且夹在 0–2000。
//
// 付款成功由 Stripe webhook 记账（flow=balance_payment，那套逻辑没动）。这里
// 额外把"客户选了多少小费"写回订单，因为师傅结算要用这个数——webhook 只知道
// 总额，拆不出小费。写的是"选了"不是"付了"：客户可能填完不付，所以工作台上
// 标注了状态。

const INVOICE_BALANCE_API = "https://invoice.realhibachi.com/api/self-service/orders/balance"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_TIP = 2000

export async function POST(request: NextRequest) {
  const limited = await rateLimit("pay-session", request, 20, 600)
  if (!limited.ok) {
    const r = tooManyRequests()
    return NextResponse.json({ ok: false, error: r.body.error }, { status: r.status })
  }

  let body: { o?: unknown; tip?: unknown }
  try {
    body = (await request.json()) as { o?: unknown; tip?: unknown }
  } catch {
    return NextResponse.json({ ok: false, error: "Malformed request." }, { status: 400 })
  }

  const orderId = typeof body.o === "string" ? body.o.trim() : ""
  if (!UUID.test(orderId)) {
    return NextResponse.json({ ok: false, error: "That link looks incomplete." }, { status: 400 })
  }

  const tipRaw = typeof body.tip === "number" ? body.tip : Number.parseFloat(String(body.tip ?? "0"))
  if (!Number.isFinite(tipRaw) || tipRaw < 0) {
    return NextResponse.json({ ok: false, error: "That tip amount doesn't look right." }, { status: 400 })
  }
  const tip = Math.min(MAX_TIP, Math.round(tipRaw * 100) / 100)

  // 欠多少问发票、付没付问账本，都在 lib/pay-balance.ts。客户端传的金额一律
  // 不认——他能决定的只有小费。
  const ctx = await loadPayContext(orderId)
  if (!ctx) {
    return NextResponse.json({ ok: false, error: "We couldn't load your balance. Text us and we'll sort it." }, { status: 502 })
  }
  if (!ctx.found) {
    return NextResponse.json({ ok: false, error: "We couldn't find that party." }, { status: 404 })
  }
  // 结清了还没给小费 = 没什么可收的。结清了又给了小费 = 事后补小费，放行。
  if (ctx.balanceDue <= 0 && tip <= 0) {
    return NextResponse.json({ ok: false, error: "This party has nothing left to pay." }, { status: 409 })
  }

  const math = computeCharge(ctx.balanceDue, tip, ctx.invoiceIsCard)

  // 这张单的 source_ref 是 webhook 记账用的地址；没有就别铸链接，否则钱落地
  // 找不到归属（pay-link 路由踩过这个坑）。
  const order = ctx.order
  if (!order?.sourceRef) {
    return NextResponse.json({ ok: false, error: "We couldn't load your balance. Text us and we'll sort it." }, { status: 409 })
  }

  try {
    const stripe = getStripeServerClient()
    const name = (order.customerName ?? ctx.clientName ?? "").trim().slice(0, 80)
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: "https://www.realhibachi.com/balance/success",
      cancel_url: "https://www.realhibachi.com/pay?o=" + orderId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: math.chargeCents,
            product_data: {
              name:
                math.balanceCents === 0
                  ? name
                    ? `Real Hibachi Chef Gratuity — ${name}`
                    : "Real Hibachi Chef Gratuity"
                  : name
                    ? `Real Hibachi Balance — ${name}`
                    : "Real Hibachi Balance Payment",
              description:
                math.balanceCents === 0
                  ? `Chef gratuity $${dollars(math.tipCents)} + 4% card processing`
                  : math.tipCents > 0
                    ? `Balance $${dollars(math.balanceCents)} + chef gratuity $${dollars(math.tipCents)} + 4% card processing`
                    : `Balance $${dollars(math.balanceCents)} + 4% card processing`,
            },
          },
        },
      ],
      metadata: {
        flow: "balance_payment",
        base_amount: dollars(math.balanceCents),
        amount_is_final: "true",
        customer_name: name || "unknown",
        note: math.tipCents > 0 ? `chef gratuity $${dollars(math.tipCents)} (customer chose)` : "no gratuity added",
        // webhook 靠这三个把钱记到订单上，形状和 /api/admin/pay-link 一致。
        order_id: order.id,
        order_no: order.orderNo ?? "",
        order_source_ref: order.sourceRef,
        order_match: "by_order_id",
        // 师傅结算要拆小费，总额拆不出来，所以单独带一份。
        chef_gratuity_cents: String(math.tipCents),
      },
    })
    if (!session.url) throw new Error("no session url")

    const supabase = getSupabaseAdmin()
    // 记下"客户选了多少"。webhook 只会记总额，这行是唯一能把小费拆出来的地方。
    if (supabase) {
      await supabase
        .from("orders")
        .update({
          chosen_gratuity_cents: math.tipCents,
          chosen_gratuity_at: new Date().toISOString(),
        })
        .eq("id", orderId)
    }

    return NextResponse.json({ ok: true, url: session.url, chargeCents: math.chargeCents })
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}
