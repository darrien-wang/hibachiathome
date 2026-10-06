import { getSupabaseAdmin } from "@/lib/supabase-admin"
import type { PayTerms } from "@/lib/pay-link-math"

// /pay 的两个接口（summary 读、session 写）共用的"这单现在还欠多少"。
//
// 两个来源，各管一半，缺一不可：
//
//   发票系统  —— 欠多少。balanceDue 由 calcInvoiceTotal 现算（含折扣、路费、
//               卡费、协议价），是唯一能回答金额的地方。
//   订单账本  —— 付没付。发票那个数是"总额 − 押金"，**完全不看实际收款**，
//               所以客户付完之后它照样返回全额。只信它的话，已经付清的客户
//               再点一次链接会再付一次（2026-09-23 发现，当天靠退款才没撞上）。
//
// 所以：金额听发票的，"已结清"听账本的。账本可信的前提是退款也记进去了，
// 那件事同一天在 handleChargeRefunded 里补上了。

const INVOICE_BALANCE_API = "https://invoice.realhibachi.com/api/self-service/orders/balance"

export type PayContext = {
  found: boolean
  /** 账本说已经收够了 —— 此时 balanceDue 强制为 0，只能补小费。 */
  settled: boolean
  /** 还欠多少（美元，发票原样）。settled 时为 0。 */
  balanceDue: number
  /**
   * 派对本身还欠多少，现金口径：拿掉发票上的 4%，也拿掉发票上已经选好的小费
   * （那部分在 includedGratuity）。拆账和刷卡价都从它算。
   */
  cashBalance: number
  /** 发票上已经选好、算进尾款里的小费（现金口径）。没选就是 0。 */
  includedGratuity: number
  /** 发票本身是不是按刷卡报的价。 */
  invoiceIsCard: boolean
  /**
   * 这单的口径：v1 = 含税价 + 刷卡 4%（10-05 及之前建的单）；v2 = 税前价 + 10%
   * 消费税、现金折扣同额、无手续费（10-06 起）。taxDollars 是 v2 下这单的税
   * （按派对总价算，发票接口给），v1 为 0。settled 时为 0。
   */
  terms: PayTerms
  clientName: string
  eventDate: string | null
  guests: number | null
  gratuityOptions: Array<{ rate: number; amount: number }>
  /** webhook 要靠 source_ref 把钱记到订单上；没有就不能铸链接。 */
  order: { id: string; orderNo: string | null; sourceRef: string | null; customerName: string | null } | null
}

type BalanceResponse = {
  found?: boolean
  clientName?: string
  eventDate?: string
  guests?: number
  paymentMethod?: string
  balanceDue?: number
  creditCardFee?: number
  selectedGratuity?: number
  gratuityOptions?: Array<{ rate: number; amount: number }>
  pricingTerms?: string
  salesTax?: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

export async function loadPayContext(orderId: string): Promise<PayContext | null> {
  let data: BalanceResponse
  try {
    const res = await fetch(INVOICE_BALANCE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
      cache: "no-store",
    })
    data = (await res.json()) as BalanceResponse
    if (!res.ok) return null
  } catch {
    return null
  }
  if (!data.found || typeof data.balanceDue !== "number") {
    return { ...empty(), found: false }
  }

  const supabase = getSupabaseAdmin()
  const { data: row } = supabase
    ? await supabase
        .from("orders")
        .select("id, order_no, source_ref, customer_name, quoted_total_cents, amount_paid_total_cents, balance_due_cents")
        .eq("id", orderId)
        .maybeSingle()
    : { data: null }

  // 已结清的判据要三条都成立，任何一条缺失都按"还欠着"处理——宁可让客户多
  // 看一眼金额，也不能把一张真欠钱的单说成付清了。
  const quoted = typeof row?.quoted_total_cents === "number" ? row.quoted_total_cents : 0
  const paid = typeof row?.amount_paid_total_cents === "number" ? row.amount_paid_total_cents : 0
  const settled = quoted > 0 && paid > 0 && paid >= quoted

  // 发票的 balanceDue = 派对 + 4%（刷卡发票才有）+ 选好的小费 − 押金。三块都由
  // 发票接口直接给，拆开用，不靠 ÷1.04 倒推（那样会差一分钱）。
  const owed = Math.max(0, data.balanceDue - (data.creditCardFee ?? 0))
  const includedGratuity = Math.min(Math.max(0, data.selectedGratuity ?? 0), owed)

  return {
    found: true,
    settled,
    balanceDue: settled ? 0 : Math.max(0, data.balanceDue),
    cashBalance: settled ? 0 : round2(owed - includedGratuity),
    includedGratuity: settled ? 0 : round2(includedGratuity),
    // The invoice says "credit_card"; this read "card" and so never matched.
    invoiceIsCard: data.paymentMethod === "credit_card" || data.paymentMethod === "card",
    terms:
      data.pricingTerms === "v2_tax_added"
        ? { version: "v2", taxDollars: settled ? 0 : round2(Math.max(0, data.salesTax ?? 0)) }
        : { version: "v1", taxDollars: 0 },
    clientName: (data.clientName ?? "").trim(),
    eventDate: data.eventDate ?? null,
    guests: typeof data.guests === "number" ? data.guests : null,
    gratuityOptions: data.gratuityOptions ?? [],
    order: row
      ? {
          id: row.id as string,
          orderNo: (row.order_no as string | null) ?? null,
          sourceRef: (row.source_ref as string | null) ?? null,
          customerName: (row.customer_name as string | null) ?? null,
        }
      : null,
  }
}

function empty(): PayContext {
  return {
    found: false,
    settled: false,
    balanceDue: 0,
    cashBalance: 0,
    includedGratuity: 0,
    invoiceIsCard: false,
    terms: { version: "v1", taxDollars: 0 },
    clientName: "",
    eventDate: null,
    guests: null,
    gratuityOptions: [],
    order: null,
  }
}
