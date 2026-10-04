import { NextRequest, NextResponse } from "next/server"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"
import { getStripeServerClient } from "@/lib/stripe-server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { splitCardPayment, checkoutDescription, dollars } from "@/lib/pay-link-math"
import { loadPayContext } from "@/lib/pay-balance"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 客户在 /pay 选好金额按 Pay 走到这里。
//
// 口径（老板 2026-10-01 定）：专属链接上的数都是**刷卡价**（已含 4%），客户点
// 哪个就刷哪个，金额本身不再改。拆账先把刷卡额换回现金口径（÷1.04），抵掉
// 现金尾款，剩下的才是师傅的小费（见 lib/pay-link-math.ts）。通用链接（不带
// 订单号）还是填多少刷多少。
//
// 客户传的是"付多少"，不是"欠多少"：拆账用的尾款每次现查（发票算金额、订单
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

  let body: { o?: unknown; amount?: unknown; name?: unknown; phone?: unknown; note?: unknown }
  try {
    body = (await request.json()) as { o?: unknown; amount?: unknown; name?: unknown; phone?: unknown; note?: unknown }
  } catch {
    return NextResponse.json({ ok: false, error: "Malformed request." }, { status: 400 })
  }

  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
  const payerName = str(body.name, 80)
  const payerPhone = str(body.phone, 30)
  const payerNote = str(body.note, 140)

  // 通用收款链接（老板 2026-09-25 要的）：realhibachi.com/pay 不带订单号也能用，
  // 客人自己填金额。老客户回头再办一场、当面谈好的尾款、补的差价，都不用我们
  // 每次去生成一条 24 小时就死的链接。
  //
  // 归属：先拿手机号去找订单，找到就完全走下面的老流程（拆小费、记账一条不少）；
  // 找不到也照样收款，webhook 会把这笔标成 unattributed 并发邮件到 support@，
  // 由人登记——钱不会因为对不上号就收不了。
  let orderId = typeof body.o === "string" ? body.o.trim() : ""
  let orderMatch: "by_order_id" | "by_phone" | "universal_link_no_match" = "by_order_id"
  if (!UUID.test(orderId)) {
    orderId = ""
    orderMatch = "universal_link_no_match"
    const digits = payerPhone.replace(/\D/g, "").slice(-10)
    if (digits.length === 10) {
      const db = getSupabaseAdmin()
      const { data: match } = db
        ? await db
            .from("orders")
            .select("id, event_start")
            .ilike("customer_phone", `%${digits}`)
            .not("order_status", "in", "(cancelled,canceled)")
            // NULLs last: a party on hold (日期待定) must not win over the dated one.
            .order("event_start", { ascending: false, nullsFirst: false })
            .limit(1)
            .maybeSingle()
        : { data: null }
      if (match?.id) {
        orderId = match.id as string
        orderMatch = "by_phone"
      }
    }
  }

  const raw = typeof body.amount === "number" ? body.amount : Number.parseFloat(String(body.amount ?? ""))
  if (!Number.isFinite(raw) || raw < MIN_AMOUNT) {
    return NextResponse.json({ ok: false, error: "Enter the amount you're paying." }, { status: 400 })
  }
  if (raw > MAX_AMOUNT) {
    return NextResponse.json({ ok: false, error: "That's more than we can take online — text us." }, { status: 400 })
  }
  const amount = Math.round(raw * 100) / 100

  if (!orderId) {
    // 对不上订单：照收，metadata 里带够人工归属要的信息。
    try {
      const stripe = getStripeServerClient()
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        success_url: "https://www.realhibachi.com/balance/success",
        cancel_url: "https://www.realhibachi.com/pay",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: Math.round(amount * 100),
              product_data: {
                name: payerName ? `Real Hibachi — ${payerName}` : "Real Hibachi Party Payment",
                description: payerNote || "Payment to Real Hibachi",
              },
            },
          },
        ],
        metadata: {
          flow: "balance_payment",
          base_amount: amount.toFixed(2),
          amount_is_final: "true",
          customer_name: payerName || "unknown",
          note: [payerPhone ? `phone ${payerPhone}` : null, payerNote || null, "paid through the open /pay link"]
            .filter(Boolean)
            .join(" · "),
          order_match: orderMatch,
        },
      })
      if (!session.url) throw new Error("no session url")
      return NextResponse.json({ ok: true, url: session.url })
    } catch (error) {
      console.error("[pay/session] universal checkout failed", error)
      return NextResponse.json({ ok: false, error: "We couldn't open checkout. Text us and we'll sort it." }, { status: 502 })
    }
  }

  const ctx = await loadPayContext(orderId)
  if (!ctx) {
    return NextResponse.json({ ok: false, error: "We couldn't load your party. Text us and we'll sort it." }, { status: 502 })
  }
  if (!ctx.found) {
    return NextResponse.json({ ok: false, error: "We couldn't find that party." }, { status: 404 })
  }

  // Every payment here is a card payment: change it back to cash terms first,
  // so the 4% is not booked as the chef's tip (Daria, 2026-10-01).
  const split = splitCardPayment(amount, ctx.cashBalance)

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
      // Card only - no Link. See app/api/deposit/start/route.ts for why.
      payment_method_types: ["card"],
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
              // No amounts here: the split is in cash terms and would not match the card price above it.
              description: checkoutDescription(split, ctx.cashBalance),
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
        order_match: orderMatch,
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
