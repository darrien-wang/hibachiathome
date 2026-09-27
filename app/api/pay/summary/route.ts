import { NextRequest, NextResponse } from "next/server"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"
import { loadPayContext } from "@/lib/pay-balance"

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

  // 2026-09-28 用户定：快捷小费按钮整个去掉，页面只留一个输入框。
  return NextResponse.json({
    ok: true,
    settled: ctx.settled,
    clientName: firstName(ctx.clientName),
    eventDate: ctx.eventDate,
    guests: ctx.guests,
  })
}

/** 页面上只称呼名字，不回全名。 */
function firstName(name?: string): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? ""
}
