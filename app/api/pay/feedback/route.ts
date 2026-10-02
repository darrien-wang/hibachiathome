import { NextRequest, NextResponse } from "next/server"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { sendSupportNotificationEmail } from "@/lib/ops-notifications"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// "Something wasn't right" on the pay page (owner 2026-10-01). A customer who
// pays only the balance is shown what the chef's gratuity is for; if the real
// reason is that the party disappointed, we would rather hear it than lose it.
// Lands on the order's timeline and in support@, nothing else.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  const limited = await rateLimit("pay-feedback", request, 5, 600)
  if (!limited.ok) {
    const r = tooManyRequests()
    return NextResponse.json({ ok: false, error: r.body.error }, { status: r.status })
  }
  let body: { o?: unknown; message?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Malformed request." }, { status: 400 })
  }
  const orderId = typeof body.o === "string" ? body.o.trim() : ""
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : ""
  if (!UUID.test(orderId) || message.length < 2) {
    return NextResponse.json({ ok: false, error: "Tell us a little about what happened." }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ ok: false, error: "Not available right now - text us." }, { status: 500 })
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_no, customer_name, customer_phone, event_start")
    .eq("id", orderId)
    .maybeSingle()
  if (!order) return NextResponse.json({ ok: false, error: "We couldn't find that party." }, { status: 404 })

  await supabase.from("order_events").insert({
    order_id: order.id,
    actor: "customer_pay_page",
    action: "customer_feedback",
    metadata: { message, via: "pay_page_balance_only" },
  })

  const when = String(order.event_start ?? "").slice(0, 16).replace("T", " ")
  await sendSupportNotificationEmail({
    subject: `Customer feedback from the pay page - ${order.customer_name ?? order.order_no ?? "party"}`,
    text: [
      `Order: ${order.order_no ?? order.id}`,
      `Customer: ${order.customer_name ?? "-"} ${order.customer_phone ?? ""}`,
      `Party: ${when || "-"}`,
      "",
      "They chose to pay only the balance and said something wasn't right:",
      "",
      message,
    ].join("\n"),
  }).catch(() => undefined)

  return NextResponse.json({ ok: true })
}
