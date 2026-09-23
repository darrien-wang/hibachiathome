import { NextRequest, NextResponse } from "next/server"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"
import { computeCharge } from "@/lib/pay-link-math"
import { loadPayContext } from "@/lib/pay-balance"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 客户打开 /pay?o=<订单 id> 时读的数据。
//
// 金额一个都不自己算：欠多少问发票系统、付没付问订单账本，两边都在
// lib/pay-balance.ts 里。
//
// 只回客户自己那场派对该知道的：名字、日期、欠多少、小费档位。不回地址、
// 电话、邮箱、成本——订单 id 是能力凭证，但凭证泄漏也不该连带泄漏联系方式。

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const limited = await rateLimit("pay-summary", request, 40, 600)
  if (!limited.ok) {
    const r = tooManyRequests()
    return NextResponse.json({ ok: false, error: r.body.error }, { status: r.status })
  }

  const orderId = (request.nextUrl.searchParams.get("o") ?? "").trim()
  if (!UUID.test(orderId)) {
    return NextResponse.json({ ok: false, error: "That link looks incomplete." }, { status: 400 })
  }

  const ctx = await loadPayContext(orderId)
  if (!ctx) {
    return NextResponse.json(
      { ok: false, error: "We couldn't load your balance. Text us and we'll sort it." },
      { status: 502 },
    )
  }
  if (!ctx.found) {
    return NextResponse.json({ ok: false, error: "We couldn't find that party." }, { status: 404 })
  }

  // 档位按钮（老板 09-23 定：照餐厅 POS 机那样给 20/25/30，大家习惯）。百分比
  // 的基数用发票的 adjustedTotal——发票底部那张小费表印的就是这三个数，两处
  // 必须一致，否则同一场派对会出现两个"20%"。
  const tiers = ctx.gratuityOptions.map((o) => ({
    rate: o.rate,
    tip: o.amount,
    chargeCents: computeCharge(ctx.balanceDue, o.amount, ctx.invoiceIsCard).chargeCents,
  }))

  return NextResponse.json({
    ok: true,
    settled: ctx.settled,
    clientName: firstName(ctx.clientName),
    eventDate: ctx.eventDate,
    guests: ctx.guests,
    balanceDue: ctx.balanceDue,
    invoiceIsCard: ctx.invoiceIsCard,
    tiers,
    noTipChargeCents: computeCharge(ctx.balanceDue, 0, ctx.invoiceIsCard).chargeCents,
  })
}

/** 页面上只称呼名字，不回全名。 */
function firstName(name?: string): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? ""
}
