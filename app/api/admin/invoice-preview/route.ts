import { NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase"
import { mintInvoiceView } from "@/lib/partner-invoice"

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
// 铸法在 lib/partner-invoice.ts mintInvoiceView，外包单给合作方的长期链接（/p/invoice/<token>）也是它。

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
  const minted = await mintInvoiceView({ order_no: (order?.order_no as string | null) ?? null, invoice_data: order?.invoice_data ?? null })
  if (!minted.ok) return NextResponse.json({ ok: false, error: minted.error }, { status: minted.status })
  return NextResponse.json({ ok: true, url: minted.url })
}
