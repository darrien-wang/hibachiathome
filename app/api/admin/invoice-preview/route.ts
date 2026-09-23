import { NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 「看一眼现在的发票」——只看，不改（老板 2026-09-23 要的）。
//
// 发票工具没有只读页面，只有 /api/invoice/pdf?token=…，而 token 要先把发票
// 数据 POST 回去才拿得到（30 分钟有效）。所以这里拿订单上存的 invoice_data
// 现铸一个，前端直接开。
//
// 为什么不直接存一个长期链接：发票会改（改人数、改菜单、加 Special rate），
// 长期链接会指向旧版本。每次现铸，看到的就永远是当前这版。
// 要看「当时发给客户的那一版」用订单抽屉里的"已发送的发票（存档）"。

const INVOICE_API = "https://invoice.realhibachi.com/api/invoice"

export async function POST(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })

  let body: { orderId?: string }
  try {
    body = (await request.json()) as { orderId?: string }
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 })
  }
  const orderId = (body.orderId ?? "").trim()
  if (!orderId) return NextResponse.json({ ok: false, error: "orderId required" }, { status: 400 })

  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })

  const { data: order, error } = await supabase
    .from("orders")
    .select("order_no, invoice_data")
    .eq("id", orderId)
    .maybeSingle()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  if (!order?.invoice_data) {
    return NextResponse.json({ ok: false, error: "这单还没有发票数据，先用专业表单开一张" }, { status: 404 })
  }

  try {
    const res = await fetch(INVOICE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order.invoice_data),
      cache: "no-store",
    })
    const data = (await res.json()) as { pdfUrl?: string; errors?: string[]; error?: string }
    if (!res.ok || !data.pdfUrl) {
      return NextResponse.json(
        { ok: false, error: data.errors?.join("; ") || data.error || "发票工具没接受这份数据" },
        { status: 502 },
      )
    }
    // view=confirmed 是客户看的那一版（只印点了的菜，不印内部勾选清单）。
    const url = `${data.pdfUrl}&order_no=${encodeURIComponent(order.order_no ?? "")}&view=confirmed`
    return NextResponse.json({ ok: true, url })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 })
  }
}
