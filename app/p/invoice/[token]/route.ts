import { type NextRequest, NextResponse } from "next/server"

import { createServerSupabaseClient } from "@/lib/supabase"
import { PARTNER_ORDER_COLUMNS, partnerInvoiceRedirect, payOf, type PartnerOrder } from "@/lib/partner-invoice"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// /p/invoice/<token> —— 给合作方的 invoice 链接（外包单，老板 2026-11-18）。不用登录：token 本身就是钥匙
// （32 位随机，lib/outsourced.ts）。每次打开按订单现在的 invoice_data 现铸一份，302 到发票工具的客户视角
// （lib/partner-invoice.ts），所以链接不过期、永远是最新版。改回直营、订单取消，链接就 404。
// 默认打开现金那张账单（老板发给合作方的就是 pay=cash）；?pay=card / venmo 换一张。
// 不发短信、不发邮件，客人那边什么都不变。
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createServerSupabaseClient()
  const result = await partnerInvoiceRedirect(token, {
    pay: payOf(request.nextUrl.searchParams.get("pay")) ?? "cash",
    findOrders: async (t) => {
      if (!supabase) throw new Error("supabase not configured")
      const { data, error } = await supabase.from("orders").select(PARTNER_ORDER_COLUMNS).eq("dispatch_plan->outsourced->>invoice_token", t).limit(2)
      if (error) throw new Error(error.message)
      return (data ?? []) as PartnerOrder[]
    },
  })
  const response =
    result.status === 302
      ? NextResponse.redirect(result.location, 302)
      : new NextResponse(result.body, { status: result.status, headers: { "Content-Type": "text/plain; charset=utf-8" } })
  // 和 /d/<code> 一样：不缓存、不进搜索。Referer 跨站只带域名（next.config 的 strict-origin-when-cross-origin），token 不外泄。
  response.headers.set("Cache-Control", "no-store")
  response.headers.set("X-Robots-Tag", "noindex, nofollow")
  return response
}
