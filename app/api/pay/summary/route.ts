import { NextRequest, NextResponse } from "next/server"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"
import { loadPayContext } from "@/lib/pay-balance"
import { cardPrice } from "@/lib/pay-link-math"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 客户打开 /pay?o=<订单 id> 时读的数据。
//
// 2026-10-01 起（老板定）专属链接**回刷卡价**：从这里付一定是刷卡，所以直接给
// 已含 4% 的尾款，再给"加 20% / 25% 小费"的刷卡总数，客人点一个就付。
// 2026-09-23 那版不回金额（"师傅当面谈好了，页面只要一个输入框"），结果客人
// 得自己算 4%、算小费，Daria 那单的 4% 就被记成了小费。链接里是订单的 UUID，
// 猜不到；转给别人看到的也只是尾款和小费档位。
//
// 发票上已经选好小费的单子（很少，一年一两单）：尾款里本来就含小费，直接回
// 含小费的刷卡价，不再给小费档位，免得客人付两遍小费。
//
// 已结清的单子不回金额：页面换成"只补小费"的说法。

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TIP_RATES = [0.2, 0.25]

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

  const owed = ctx.cashBalance + ctx.includedGratuity
  const priced = !ctx.settled && owed > 0
  const tipIncluded = ctx.includedGratuity > 0
  const tipOptions =
    priced && !tipIncluded
      ? TIP_RATES.map((rate) => {
          const tip = ctx.gratuityOptions.find((o) => Math.abs(o.rate - rate) < 1e-9)?.amount ?? 0
          return { rate, tip, total: cardPrice(ctx.cashBalance + tip) }
        }).filter((o) => o.tip > 0)
      : []

  return NextResponse.json({
    ok: true,
    settled: ctx.settled,
    clientName: firstName(ctx.clientName),
    eventDate: ctx.eventDate,
    guests: ctx.guests,
    cardBalance: priced ? cardPrice(owed) : null,
    gratuityIncluded: priced && tipIncluded ? ctx.includedGratuity : null,
    tipOptions,
  })
}

/** 页面上只称呼名字，不回全名。 */
function firstName(name?: string): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? ""
}
