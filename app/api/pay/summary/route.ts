import { NextRequest, NextResponse } from "next/server"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"
import { loadPayContext } from "@/lib/pay-balance"
import { quickFillCents } from "@/lib/pay-link-math"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 客户打开 /pay?o=<订单 id> 时读的数据。
//
// 2026-09-23 起**不再回金额**：师傅当天已经和客户当面谈好付多少，页面只要一个
// 输入框（老板定）。少回一个字段也顺带少一分风险——链接落到别人手里，看不到
// 这场派对花了多少钱。
//
// 只回：名字、日期、人数，以及这单是不是已经结清（结清了页面换个说法，不然
// 客户会以为自己在重复付款）。

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
      { ok: false, error: "We couldn't load your party. Text us and we'll sort it." },
      { status: 502 },
    )
  }
  if (!ctx.found) {
    return NextResponse.json({ ok: false, error: "We couldn't find that party." }, { status: 404 })
  }

  // 快捷按钮：点一下把"含 4% 的全额"填进输入框（老板 09-23 定）。百分比的基数
  // 用发票的 adjustedTotal，和发票底部那张小费表印的是同一批数。页面不显示尾款
  // 本身，只显示按下去会填多少。
  const tiers = ctx.gratuityOptions.map((o) => ({
    rate: o.rate,
    // 显示的是小费本身（老板 09-23 定）：百分比配小费金额才对得上，
    // 写总额会让人以为"20% = $863"。
    tipCents: Math.round(o.amount * 100),
    // 点下去填进输入框的是含 4% 的全额。
    fillCents: quickFillCents(ctx.balanceDue, o.amount, ctx.invoiceIsCard),
  }))

  return NextResponse.json({
    ok: true,
    settled: ctx.settled,
    clientName: firstName(ctx.clientName),
    eventDate: ctx.eventDate,
    guests: ctx.guests,
    tiers,
  })
}

/** 页面上只称呼名字，不回全名。 */
function firstName(name?: string): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? ""
}
