import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase"
import { customItemLine, customItemsOf, parseCustomItemsInput, sameCustomItems } from "@/lib/custom-items"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 订单另加（自定义项，老板 2026-11-21：「那就订单这里加个自定义项，以后可能还有很多新的需求，到时候就
// 从这个地方走」）：订单弹窗交上来这一单要存成的整份清单（lib/custom-items.ts）。
//
// 发票归发票应用管，这里不直接写 orders.invoice_data：按订单 id 读发票应用的那份（lookup，带 admin
// token），换上这份清单，走 save-invoice 存——和 desk order set、发票工具同一条路。所以账单和尾款快照、
// 规则引擎、派对页同步、师傅备料单的改单通知（72 小时内约 10 分钟后短信）、审查指纹全都照常动。
// 读和存之间有人改了这单（客人的派对页、发票工具、desk），save-invoice 回 409，什么都不存，弹窗让人重开。
// 会改账单，所以只给老板（和备货备注一样）。

const INVOICE_APP_ORIGIN = "https://invoice.realhibachi.com"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Lookup = { ok?: boolean; found?: boolean; order?: { orderNo?: string; updatedAt?: string; version?: string }; prefill?: Record<string, unknown> }

export async function POST(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  if (actor.role !== "owner") return NextResponse.json({ ok: false, error: "只有老板能改订单另加的东西（会改账单）" }, { status: 403 })
  let body: { orderId?: unknown; items?: unknown }
  try {
    body = (await request.json()) as { orderId?: unknown; items?: unknown }
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 })
  }
  const orderId = String(body.orderId ?? "")
  if (!UUID.test(orderId)) return NextResponse.json({ ok: false, error: "orderId required" }, { status: 400 })
  const parsed = parseCustomItemsInput(body.items)
  if (parsed.errors.length) return NextResponse.json({ ok: false, error: parsed.errors.join("；") }, { status: 400 })
  const token = process.env.INVOICE_UPDATE_ADMIN_TOKEN?.trim()
  if (!token) return NextResponse.json({ ok: false, error: "INVOICE_UPDATE_ADMIN_TOKEN is not configured on the workbench side." }, { status: 500 })

  const call = async (path: string, payload: unknown): Promise<{ status: number; json: Record<string, unknown> | null }> => {
    try {
      const res = await fetch(`${INVOICE_APP_ORIGIN}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-token": token },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: AbortSignal.timeout(45_000),
      })
      return { status: res.status, json: (await res.json().catch(() => null)) as Record<string, unknown> | null }
    } catch (e) {
      return { status: 0, json: { error: e instanceof Error ? e.message : "fetch failed" } }
    }
  }

  // 1. 这一单在发票应用里的样子（每个编辑入口打开的都是这一份），按 id 取，不靠电话邮箱猜是哪一单。
  const look = (await call("/api/self-service/orders/lookup", { orderId })) as { status: number; json: Lookup | null }
  if (look.status !== 200 || !look.json?.ok) return NextResponse.json({ ok: false, error: `发票应用读不到这单（${look.status || "连不上"}）` }, { status: 502 })
  if (!look.json.found || !look.json.prefill || !look.json.order) return NextResponse.json({ ok: false, error: "发票应用里没有这单" }, { status: 404 })
  const { order, prefill } = look.json
  const orderNo = order.orderNo ?? null
  const was = customItemsOf(prefill)
  if (sameCustomItems(was, parsed.items)) return NextResponse.json({ ok: true, unchanged: true, orderNo, items: parsed.items })

  // 2. 换上这份清单，按 desk 和发票工具的存法存（读的时候的 updatedAt / version 一起交，中间被改过就 409）。
  const invoiceData: Record<string, unknown> = { ...prefill }
  if (parsed.items.length) invoiceData.customItems = parsed.items
  else delete invoiceData.customItems
  const saved = await call("/api/self-service/orders/save-invoice", { orderId, invoiceData, baseUpdatedAt: order.updatedAt, baseVersion: order.version })
  if (saved.status === 409) {
    return NextResponse.json(
      { ok: false, conflict: true, error: "这单刚被改过（客人的派对页、发票工具或 desk），什么都没存。关掉弹窗重新打开这单，再改一次。" },
      { status: 409 },
    )
  }
  if (saved.status !== 200 || !saved.json?.ok) {
    return NextResponse.json({ ok: false, error: `没存上：${String(saved.json?.error ?? saved.status ?? "")}`.trim() }, { status: 502 })
  }

  // 3. 读回来：2026-11-21 以前的发票应用不认这个字段，会存了单却悄悄丢掉。
  const back = (await call("/api/self-service/orders/lookup", { orderId })) as { status: number; json: Lookup | null }
  const kept = back.status === 200 && back.json?.found ? sameCustomItems(back.json.prefill?.customItems, parsed.items) : null

  const supabase = createServerSupabaseClient()
  if (supabase) {
    await supabase.from("order_events").insert({
      order_id: orderId,
      actor: `workbench:${actor.alias}`,
      action: "custom_items_set",
      metadata: { items: parsed.items.map(customItemLine), was: was.map(customItemLine), kept },
    })
  }
  return NextResponse.json({
    ok: true,
    orderNo,
    items: parsed.items,
    kept,
    ...(kept === false ? { warning: "存了，但发票应用没留下这些项（新版可能还没部署）——账单和备料单上还没有，部署后再存一次" } : {}),
    lint: saved.json.lint ?? null,
  })
}
