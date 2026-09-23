import { NextRequest, NextResponse } from "next/server"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"
import { computeCharge } from "@/lib/pay-link-math"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 客户打开 /pay?o=<订单 id> 时读的数据。
//
// 数字一律来自发票系统的 self-service balance 接口（它用 calcInvoiceTotal 现
// 算），这边一个都不自己算——staff 那条 pay-link 也是这么做的，就是为了"短信
// 发出去的链接永远不会和发票对不上"。
//
// 只回客户自己那场派对该知道的：名字、日期、尾款。不回地址、电话、邮箱、成
// 本——订单 id 是能力凭证，但凭证泄漏也不该连带泄漏联系方式。

const INVOICE_BALANCE_API = "https://invoice.realhibachi.com/api/self-service/orders/balance"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type BalanceResponse = {
  ok?: boolean
  found?: boolean
  clientName?: string
  eventDate?: string
  guests?: number
  paymentMethod?: string
  balanceDue?: number
  adjustedTotal?: number
  gratuityOptions?: Array<{ rate: number; amount: number }>
}

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

  let data: BalanceResponse
  try {
    const res = await fetch(INVOICE_BALANCE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
      cache: "no-store",
    })
    data = (await res.json()) as BalanceResponse
    if (!res.ok) throw new Error("balance lookup failed")
  } catch {
    return NextResponse.json(
      { ok: false, error: "We couldn't load your balance. Text us and we'll sort it." },
      { status: 502 },
    )
  }

  if (!data.found || typeof data.balanceDue !== "number") {
    return NextResponse.json({ ok: false, error: "We couldn't find that party." }, { status: 404 })
  }
  if (data.balanceDue <= 0) {
    return NextResponse.json({ ok: true, settled: true, clientName: firstName(data.clientName) })
  }

  const invoiceIsCard = data.paymentMethod === "card"
  // 客户自己填金额（老板 09-23 定：不给档位）。只给一个参考数——20% 是多少，
  // 省得他自己按计算器；这是一行字，不是按钮。
  const twenty = data.gratuityOptions?.find((o) => Math.abs(o.rate - 0.2) < 0.001)?.amount ?? null

  return NextResponse.json({
    ok: true,
    settled: false,
    clientName: firstName(data.clientName),
    eventDate: data.eventDate ?? null,
    guests: data.guests ?? null,
    balanceDue: data.balanceDue,
    invoiceIsCard,
    twentyPercentTip: twenty,
    noTipChargeCents: computeCharge(data.balanceDue, 0, invoiceIsCard).chargeCents,
  })
}

/** 页面上只称呼名字，不回全名。 */
function firstName(name?: string): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? ""
}
