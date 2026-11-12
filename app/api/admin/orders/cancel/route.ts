import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"
import { cancelOrder } from "@/lib/order-cancel"
import { createServerSupabaseClient } from "@/lib/supabase"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 取消订单（2026-11-11，D-1111-03）。以前没有这个动作：11-07、11-11 两次都是手写
// SQL 六步，师傅那条短信靠人记得发。现在工作台订单抽屉的按钮和
// `desk order cancel <单号> --why "…"` 都走这里，一步做完：
//
//   订单   order_status=cancelled、date_lock_status=not_locked、calendar_status=not_synced
//          （和发票仓库 lib/integration-service.ts 的 processOrderCancelled 同三列），
//          记 order_cancelled 事件，排一条 cancel_calendar
//   师傅   派在这单上的每一位（含帮手）收到中文短信「…那场取消了，你不用去」，
//          备料单链接作废，派工撤掉
//   线索   标流失，原因记成 [lost] … [why] …；客人还有别的没办的派对就不标
//
// 钱一分不动：48 小时内取消按政策可以收 $99（D-1006-04），这里只在返回里提示，
// 收不收老板定；收过的钱也不自动退。
//
//   POST { orderId | orderNo, reason, dryRun?, source? }
//   dryRun:true 只读只算，什么都不写、不发，返回的结构和真取消一样。
//   已经取消的单再调一次不会重复通知，只把没做完的补上（还挂着的派工、没标的线索）。
//
// 只有老板能取消：这一下会给师傅发短信，而且没有"恢复"。
export async function POST(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  if (actor.role !== "owner") return NextResponse.json({ ok: false, error: "只有老板能取消订单" }, { status: 403 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })
  let body: { orderId?: unknown; orderNo?: unknown; reason?: unknown; dryRun?: unknown; source?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 })
  }
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "")
  // desk 和工作台走同一个口子，审计里要分得清是谁点的。
  const source = text(body.source) === "desk" ? "desk" : "workbench"
  try {
    const out = await cancelOrder(supabase, {
      orderId: text(body.orderId),
      orderNo: text(body.orderNo),
      reason: text(body.reason),
      actor: `${source}:${actor.alias}`,
      dryRun: body.dryRun === true,
    })
    if (!out.ok) return NextResponse.json({ ok: false, error: out.error }, { status: out.status })
    return NextResponse.json(out)
  } catch (e) {
    const msg = e instanceof Error ? e.message : e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : String(e)
    console.error("[admin/orders/cancel]", msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
