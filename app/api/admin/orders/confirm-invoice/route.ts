import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// 老板手动标记"客户已确认"（客户在短信/电话里说的没问题）。和客户自己在
// /confirm 页点的走同一套版本号：发票之后再改，照样自动打回"改后未确认"。
export async function POST(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (actor.role !== "owner") return NextResponse.json({ error: "只有老板能替客户标记确认" }, { status: 403 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "supabase not configured" }, { status: 500 })
  let body: { orderId?: string }
  try {
    body = (await request.json()) as { orderId?: string }
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  if (typeof body.orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.orderId)) return NextResponse.json({ error: "orderId required" }, { status: 400 })
  const { data: o } = await supabase.from("orders").select("id, invoice_revision").eq("id", body.orderId).maybeSingle()
  if (!o) return NextResponse.json({ error: "not found" }, { status: 404 })
  const now = new Date().toISOString()
  const { error } = await supabase
    .from("orders")
    .update({ invoice_confirmed_at: now, invoice_confirmed_revision: o.invoice_revision as number, invoice_confirmed_by: `owner:${actor.alias}`, updated_at: now })
    .eq("id", o.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await supabase.from("order_events").insert({ order_id: o.id, actor: `workbench:${actor.alias}`, action: "invoice_confirmed", metadata: { revision: o.invoice_revision, via: "manual" } })
  return NextResponse.json({ ok: true })
}
