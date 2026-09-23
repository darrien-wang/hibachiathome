import { NextRequest, NextResponse } from "next/server"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"
import { getStripeServerClient } from "@/lib/stripe-server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { splitPayment, dollars } from "@/lib/pay-link-math"
import { loadPayContext } from "@/lib/pay-balance"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 客户在 /pay 填完总数按 Pay 走到这里。
//
// 口径（老板 2026-09-23 定）：**客户填多少就刷多少**，超出尾款的部分全是师傅
// 的小费。师傅当天一般已经和客户当面谈好，所以页面不显示欠多少、也不再在上面
// 加 4%——收到的金额必须正好等于他跟师傅谈的那个数。
//
// 客户填的是"付多少"，不是"欠多少"：拆账用的余额每次现查（发票算金额、订单
// 账本判有没有付过，见 lib/pay-balance.ts），客户端传不进来。
//
// 付款成功由 Stripe webhook 记账（flow=balance_payment）。这里额外把拆出来的
// 小费写回订单，因为 webhook 只知道总额、拆不出小费，而师傅结算要这个数。

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MIN_AMOUNT = 1
const MAX_AMOUNT = 20000

export async function POST(request: NextRequest) {
  const limited = await rateLimit("pay-session", request, 20, 600)
  if (!limited.ok) {
    const r = tooManyRequests()
    return NextResponse.json({ ok: false, error: r.body.error }, { status: r.status })
  }

  let body: { o?: unknown; amount?: unknown }
  try {
    body = (await request.json()) as { o?: unknown; amount?: unknown }
  } catch {
    return NextResponse.json({ ok: false, error: "Malformed request." }, { status: 400 })
  }

  const orderId = typeof body.o === "string" ? body.o.trim() : ""
  if (!UUID.test(orderId)) {
    return NextResponse.json({ ok: false, error: "That link looks incomplete." }, { status: 400 })
  }

  const raw = typeof body.amount === "number" ? body.amount : Number.parseFloat(String(body.amount ?? ""))
  if (!Number.isFinite(raw) || raw < MIN_AMOUNT) {
    return NextResponse.json({ ok: false, error: "Enter the amount you're paying." }, { status: 400 })
  }
  if (raw > MAX_AMOUNT) {
    return NextResponse.json({ ok: false, error: "That's more than we can take online — text us." }, { status: 400 })
  }
  const amount = Math.round(raw * 100) / 100

  const ctx = await loadPayContext(orderId)
  if (!ctx) {
    return NextResponse.json({ ok: false, error: "We couldn't load your party. Text us and we'll sort it." }, { status: 502 })
  }
  if (!ctx.found) {
    return NextResponse.json({ ok: false, error: "We couldn't find that party." }, { status: 404 })
  }

  const split = splitPayment(amount, ctx.balanceDue)

  // webhook 靠 source_ref 把钱记到订单上；没有就别铸链接，否则钱落地找不到
  // 归属（pay-link 路由踩过这个坑）。
  const order = ctx.order
  if (!order?.sourceRef) {
    return NextResponse.json({ ok: false, error: "We couldn't load your party. Text us and we'll sort it." }, { status: 409 })
  }

  try {
    const stripe = getStripeServerClient()
    const name = (order.customerName ?? ctx.clientName ?? "").trim().slice(0, 80)
    const onlyTip = split.towardBalanceCents === 0
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: "https://www.realhibachi.com/balance/success",
      cancel_url: "https://www.realhibachi.com/pay?o=" + orderId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: split.chargeCents,
            product_data: {
              name: onlyTip
                ? name
                  ? `Real Hibachi Chef Gratuity — ${name}`
                  : "Real Hibachi Chef Gratuity"
                : name
                  ? `Real Hibachi — ${name}`
                  : "Real Hibachi Party Payment",
              description: onlyTip
                ? `Chef gratuity $${dollars(split.tipCents)}`
                : split.tipCents > 0
                  ? `Party balance $${dollars(split.towardBalanceCents)} + chef gratuity $${dollars(split.tipCents)}`
                  : `Party balance $${dollars(split.towardBalanceCents)}`,
            },
          },
        },
      ],
      metadata: {
        flow: "balance_payment",
        base_amount: dollars(split.towardBalanceCents),
        amount_is_final: "true",
        customer_name: name || "unknown",
        note:
          split.tipCents > 0
            ? `customer paid $${dollars(split.chargeCents)} total · chef gratuity $${dollars(split.tipCents)}`
            : `customer paid $${dollars(split.chargeCents)} total · no gratuity`,
        // webhook 靠这三个把钱记到订单上，形状和 /api/admin/pay-link 一致。
        order_id: order.id,
        order_no: order.orderNo ?? "",
        order_source_ref: order.sourceRef,
        order_match: "by_order_id",
        // 师傅结算要拆小费，总额拆不出来，所以单独带一份。
        chef_gratuity_cents: String(split.tipCents),
      },
    })
    if (!session.url) throw new Error("no session url")

    // 记下拆出来的小费。webhook 只会记总额，这行是唯一能把小费拆出来的地方；
    // 写的是"填了"不是"付了"，工作台上标注了状态。
    const supabase = getSupabaseAdmin()
    if (supabase) {
      await supabase
        .from("orders")
        .update({ chosen_gratuity_cents: split.tipCents, chosen_gratuity_at: new Date().toISOString() })
        .eq("id", orderId)
    }

    return NextResponse.json({ ok: true, url: session.url, chargeCents: split.chargeCents })
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}
