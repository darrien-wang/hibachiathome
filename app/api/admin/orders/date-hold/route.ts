import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 日期待定（2026-10-04 老板定，alice kim 那单）：客人付了押金，但日期定不下来。
//
// 订单照旧有效、押金照旧在，只是把日期拿掉：event_start 清空，原来的日期记在
// source_metadata.date_hold 里。所有按日期取单的地方（日历、日地图、备货、/quote
// 档期、派对临近提醒、师傅那天的单）都按日期范围查，日期空了自然就不出现；日历上
// 另外列一栏"日期待定"，免得忘了。
//
// 发票上的日期一起清掉：发票工具一保存（save-invoice）就把发票上的日期写回订单，
// 不清的话这单会自己跳回原来那天。客人定了日期就"定日期"：日期写回订单和发票，
// date_hold 去掉，挪进 order_events 留底。
//
// 只改这几列，所以直接写（和 confirm-invoice 一样），不走集成事件。

type Body = { orderId?: string; action?: "hold" | "set_date"; note?: string; date?: string; time?: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// 只定了日期、没定时间：和押金页 "Not sure yet" 一样，放个占位时间并标 event_time_tbd。
const PLACEHOLDER_TIME = "17:00"

export async function POST(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  const orderId = String(body.orderId ?? "")
  if (!UUID.test(orderId)) return NextResponse.json({ error: "orderId required" }, { status: 400 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "supabase not configured" }, { status: 500 })

  const { data: o } = await supabase
    .from("orders")
    .select("id, order_no, event_start, order_status, source_metadata, invoice_data")
    .eq("id", orderId)
    .maybeSingle()
  if (!o) return NextResponse.json({ error: "订单不存在" }, { status: 404 })
  if (o.order_status === "cancelled") return NextResponse.json({ error: "这单已经取消了" }, { status: 400 })

  const now = new Date().toISOString()
  const who = `workbench:${actor.alias}`
  const meta = (o.source_metadata ?? {}) as Record<string, unknown>
  const inv = (o.invoice_data ?? null) as Record<string, unknown> | null
  const invoiceWithDate = (date: string, time: string) =>
    inv ? { ...inv, contactInfo: { ...((inv.contactInfo ?? {}) as Record<string, unknown>), eventDate: date, eventTime: time } } : undefined

  if (body.action === "hold") {
    if (!o.event_start) return NextResponse.json({ ok: true, already: true })
    const note = String(body.note ?? "").trim().slice(0, 300)
    const hold = { since: now, by: actor.alias, previous_start: o.event_start, ...(note ? { note } : {}) }
    const { event_time_tbd: _drop, ...restMeta } = meta
    const patch: Record<string, unknown> = { event_start: null, event_end: null, source_metadata: { ...restMeta, date_hold: hold }, updated_at: now }
    const cleared = invoiceWithDate("", "")
    if (cleared) patch.invoice_data = cleared
    const { error } = await supabase.from("orders").update(patch).eq("id", o.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await supabase.from("order_events").insert({ order_id: o.id, actor: who, action: "date_hold_set", metadata: { previous_start: o.event_start, note: note || null } })
    return NextResponse.json({ ok: true })
  }

  if (body.action === "set_date") {
    if (o.event_start) return NextResponse.json({ error: "这单有日期，改日期去发票工具" }, { status: 400 })
    const date = String(body.date ?? "").trim()
    const time = String(body.time ?? "").trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return NextResponse.json({ error: "日期不对" }, { status: 400 })
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return NextResponse.json({ error: "时间不对" }, { status: 400 })
    const clock = time || PLACEHOLDER_TIME
    // event_start 存的是墙上时间当 UTC（"2026-10-04 17:00+00" = 洛杉矶下午 5 点）。
    const start = `${date}T${clock}:00+00:00`
    const { date_hold: held, event_time_tbd: _tbd, ...restMeta } = meta
    const patch: Record<string, unknown> = {
      event_start: start,
      source_metadata: time ? restMeta : { ...restMeta, event_time_tbd: true },
      updated_at: now,
    }
    const dated = invoiceWithDate(date, clock)
    if (dated) patch.invoice_data = dated
    const { error } = await supabase.from("orders").update(patch).eq("id", o.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await supabase.from("order_events").insert({
      order_id: o.id,
      actor: who,
      action: "date_hold_released",
      metadata: { new_start: start, time_tbd: !time, previous_start: (held as { previous_start?: string } | undefined)?.previous_start ?? null },
    })
    return NextResponse.json({ ok: true, eventStart: start })
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 })
}
