import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Staff-only order workbench reads. Orders live in the shared Supabase
// project and are owned by the invoice app; this surface reads them directly
// (read-direct) while every state change goes through the integration event
// channel (write-via-events) — see the order-workbench design doc.
function isAuthorized(request: NextRequest): boolean {
  const provided = request.headers.get("x-admin-key") ?? ""
  if (!provided) return false
  const owner = process.env.ADMIN_DASH_KEY
  if (owner && provided === owner) return true
  for (const entry of (process.env.AGENT_DASH_KEYS ?? "").split(",")) {
    const [alias, key] = entry.split(":").map((s) => s?.trim())
    if (alias && key && provided === key) return true
  }
  return false
}

const LIST_COLUMNS = [
  "id",
  "order_no",
  "customer_name",
  "customer_email",
  "customer_phone",
  "event_start",
  "event_address",
  "guest_adult_count",
  "guest_child_count",
  "order_status",
  "deposit_status",
  "deposit_required_cents",
  "deposit_paid_total_cents",
  "details_status",
  "quoted_total_cents",
  "amount_paid_total_cents",
  "balance_due_cents",
  "source",
  "source_ref",
  "source_metadata",
  "created_at",
  "updated_at",
].join(",")

type FinishedOrderShape = {
  id: string
  event_start: string | null
  order_status: string | null
  balance_due_cents: number | null
  source_ref: string | null
}

type PendingRequestShape = {
  id: string
  order_id: string | null
  external_order_id: string | null
  status: string
}

// 派对已经办完(或订单取消)的单子上,还挂着"待确认/处理中"的客户修改请求时,
// 自动静默关闭。两个理由:这些请求已经不可能再执行,留着列表会一直亮"有修改";
// 而人工去点"标记完成"会经发票 app 给客户补发一封"更新已完成"的邮件——
// 派对都结束好几天了再收到这个,纯属打扰客户。
//
// 静默是靠绕路实现的:客户通知只写在发票 app 的 confirm/complete 两条路由里,
// 这里直接改共享库里的行,不碰那两条路由,所以一封邮件、一条短信都不会发。
//
// 只关 balance_due_cents === 0 的单:还欠尾款时,"改人数"这类请求可能仍然
// 影响最终账单,必须留给人工处理,不能替他关掉。
//
// 不写 chef_notified_at —— 真正人工完成的请求一定会写上(见发票 app 的
// completeInvoiceUpdateRequest),所以"状态已完成 + chef_notified_at 为空"
// 就是自动关闭的标记,工作台据此区分显示,统计时也不会把它算成人工处理过。
async function autoCloseFinishedOrderRequests(
  supabase: NonNullable<ReturnType<typeof createServerSupabaseClient>>,
  orders: FinishedOrderShape[],
  pending: PendingRequestShape[]
): Promise<PendingRequestShape[]> {
  if (pending.length === 0) return pending

  const now = Date.now()
  const finishedIds = new Set<string>()
  const finishedRefs = new Set<string>()
  for (const o of orders) {
    const eventMs = o.event_start ? Date.parse(o.event_start) : NaN
    const eventPassed = Number.isFinite(eventMs) && eventMs < now
    const finished = o.order_status === "cancelled" || (eventPassed && o.balance_due_cents === 0)
    if (!finished) continue
    finishedIds.add(o.id)
    if (o.source_ref) finishedRefs.add(o.source_ref)
  }
  if (finishedIds.size === 0) return pending

  const stale = pending.filter(
    (r) =>
      (r.order_id && finishedIds.has(r.order_id)) ||
      (r.external_order_id && finishedRefs.has(r.external_order_id))
  )
  if (stale.length === 0) return pending

  const { error } = await supabase
    .from("invoice_update_requests")
    .update({ status: "updated_chef_notified" })
    .in(
      "id",
      stale.map((r) => r.id)
    )
  if (error) {
    // 关不掉不该影响工作台本身能不能打开,下次刷新会再试一次。
    console.error("[orders] auto-close stale update requests failed", error.message)
    return pending
  }

  const closed = new Set(stale.map((r) => r.id))
  return pending.filter((r) => !closed.has(r.id))
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const supabase = createServerSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 500 })
  }

  const orderId = request.nextUrl.searchParams.get("id")?.trim()

  if (orderId) {
    const [orderRes, paymentsRes, eventsRes] = await Promise.all([
      supabase.from("orders").select(LIST_COLUMNS + ",internal_notes,customer_notes,notes").eq("id", orderId).maybeSingle(),
      supabase
        .from("payments")
        .select("id,provider,external_payment_id,type,status,amount_cents,paid_at,refunded_at,transaction_ref,created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("order_events")
        .select("id,actor,action,metadata,created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false })
        .limit(60),
    ])

    if (orderRes.error) {
      return NextResponse.json({ error: orderRes.error.message }, { status: 500 })
    }
    if (!orderRes.data) {
      return NextResponse.json({ error: "order not found" }, { status: 404 })
    }

    // 客户从任一入口(party 图形 / invoice 专业表单)提交的修改单,
    // 按 order_id 或 external_order_id(= source_ref)都能挂上。
    const sourceRef = (orderRes.data as { source_ref?: string | null }).source_ref
    let requestsQuery = supabase
      .from("invoice_update_requests")
      .select("id,status,customer_name,customer_message,change_summary,confirmed_at,chef_notified_at,created_at")
      .order("created_at", { ascending: false })
      .limit(20)
    requestsQuery = sourceRef
      ? requestsQuery.or(`order_id.eq.${orderId},external_order_id.eq.${sourceRef}`)
      : requestsQuery.eq("order_id", orderId)
    const requestsRes = await requestsQuery

    return NextResponse.json({
      ok: true,
      order: orderRes.data,
      payments: paymentsRes.data ?? [],
      events: eventsRes.data ?? [],
      updateRequests: requestsRes.data ?? [],
    })
  }

  const [listRes, pendingRes] = await Promise.all([
    supabase.from("orders").select(LIST_COLUMNS).order("created_at", { ascending: false }).limit(200),
    supabase
      .from("invoice_update_requests")
      .select("id,order_id,external_order_id,status")
      .in("status", ["received", "confirmed_in_progress"])
      .limit(300),
  ])

  if (listRes.error) {
    return NextResponse.json({ error: listRes.error.message }, { status: 500 })
  }

  const orders = (listRes.data ?? []) as FinishedOrderShape[]
  const stillPending = await autoCloseFinishedOrderRequests(supabase, orders, pendingRes.data ?? [])

  return NextResponse.json({ ok: true, orders, pendingUpdateRequests: stillPending })
}
