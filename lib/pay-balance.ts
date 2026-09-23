import { getSupabaseAdmin } from "@/lib/supabase-admin"

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
  /** 还欠多少（美元）。settled 时为 0。 */
  balanceDue: number
  /** 发票本身是不是按刷卡报的价（决定 4% 加在哪一层）。 */
  invoiceIsCard: boolean
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
  gratuityOptions?: Array<{ rate: number; amount: number }>
}

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

  return {
    found: true,
    settled,
    balanceDue: settled ? 0 : Math.max(0, data.balanceDue),
    invoiceIsCard: data.paymentMethod === "card",
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
    invoiceIsCard: false,
    clientName: "",
    eventDate: null,
    guests: null,
    gratuityOptions: [],
    order: null,
  }
}
