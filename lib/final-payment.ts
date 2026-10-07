import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { buildBalancePaidEventEnvelope, sendCrmEventEnvelope } from "@/lib/crm-integration"

// 把"这单的尾款已经收到"记进账本（payments 投影 + 发票系统余额同步 +
// order_events 审计）。原来只有订单弹窗的手动登记卡在用；2026-09-28 起
// 厨师结算里确认"师傅代收现金 / 已付清"时也自动走这里——同一件事只说一次。
//
// 幂等：externalPaymentId 由 渠道+订单号+金额 决定，重复提交合并成同一行。

// "venmo" / "zelle" are legacy-only (D-1006-06, 2026-10-06): those accounts stopped being
// customer rails that night and now only pay chef wages. The values stay so historical rows
// keep rendering; a legacy transfer nets to the business like cash (tax inside, no processing).
export type FinalPaymentChannel = "cash" | "venmo" | "zelle" | "stripe" | "other"

export async function registerFinalPayment(
  supabase: SupabaseClient,
  args: {
    orderId: string
    amountCents: number
    channel: FinalPaymentChannel
    operator: string
    /** stripe 渠道必填：pi_/ch_/py_/cs_ 开头的真实 id */
    paymentRef?: string
    proofUrl?: string
    /** 从哪个界面来的（审计） */
    entrySurface?: "orders_workbench" | "chef_settlement"
    /** 没有凭证链接时可用一句说明顶上（进 proof_url 位） */
    note?: string
  },
): Promise<{ ok: true; orderNo: string | null } | { ok: false; error: string; status: number }> {
  const { data: order, error: readError } = await supabase
    .from("orders")
    .select("id, order_no, source_ref, customer_name, customer_email, customer_phone, event_start, event_address")
    .eq("id", args.orderId)
    .maybeSingle()
  if (readError) return { ok: false, error: readError.message, status: 500 }
  if (!order) return { ok: false, error: "order not found", status: 404 }
  if (!order.source_ref) return { ok: false, error: "order has no source_ref; cannot address it through the integration channel", status: 422 }

  const nowIso = new Date().toISOString()
  const isStripe = args.channel === "stripe"
  const externalPaymentId = isStripe
    ? args.paymentRef!
    : `manual_final_${args.channel}_${order.order_no}_${args.amountCents}`.slice(0, 80)

  const built = buildBalancePaidEventEnvelope({
    eventId: `evt_manual_final_${randomUUID()}`,
    order: { ...order, source_ref: String(order.source_ref) },
    amountCents: args.amountCents,
    externalPaymentId,
    provider: isStripe ? "stripe" : "other",
    paidAt: nowIso,
    transactionRef: isStripe ? args.paymentRef : `manual:${args.channel}`,
    metadata: {
      payment_kind: "final_balance",
      entry_surface: args.entrySurface ?? "orders_workbench",
      manual_entry: true,
      channel: args.channel,
      operator: args.operator,
      proof_url: args.proofUrl ?? args.note,
    },
  })
  if (!built.ok) return { ok: false, error: built.detail, status: 422 }

  const delivery = await sendCrmEventEnvelope({ envelope: built.envelope })
  if (!delivery.attempted || !delivery.delivered) {
    const detail = delivery.attempted ? (delivery.error ?? `http_${delivery.status}`) : (delivery.detail ?? delivery.reason)
    return { ok: false, error: `CRM ingest failed: ${detail}`, status: 502 }
  }

  await supabase.from("order_events").insert({
    order_id: args.orderId,
    actor: `admin:${args.operator}`,
    action: "final_payment_confirmed",
    metadata: {
      channel: args.channel,
      amount_cents: args.amountCents,
      proof_url: args.proofUrl ?? null,
      external_payment_id: externalPaymentId,
      stripe_payment_ref: args.paymentRef ?? null,
      entry_surface: args.entrySurface ?? "orders_workbench",
    },
  })

  return { ok: true, orderNo: (order.order_no as string | null) ?? null }
}
