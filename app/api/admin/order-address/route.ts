import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase"
import { looksLikeStreetAddress } from "@/lib/address-detect"

export const dynamic = "force-dynamic"

// The address a customer texted, offered on the order it belongs to.
//   GET  ?orderId=…  -> { suggestion } when the order has no street address
//                       and one was detected in their messages
//   POST { orderId, address } -> writes it to the order (and the stored invoice)
//
// Staff confirm with one tap rather than us overwriting an order from a text:
// customers float candidate addresses ("we're thinking about a house in La
// Habra") that are not the final answer.

async function actorOr401(request: NextRequest) {
  return (await resolveAdminActor(request)) !== null
}

export async function GET(request: NextRequest) {
  if (!(await actorOr401(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const orderId = request.nextUrl.searchParams.get("orderId")?.trim()
  if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 })

  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ ok: true, suggestion: null })

  const { data: order } = await supabase
    .from("orders")
    .select("id, event_address, customer_phone")
    .eq("id", orderId)
    .maybeSingle()
  if (!order) return NextResponse.json({ error: "order not found" }, { status: 404 })
  // Already has a real street line - nothing to offer.
  if (looksLikeStreetAddress(order.event_address)) return NextResponse.json({ ok: true, suggestion: null })

  const digits = (order.customer_phone ?? "").replace(/\D/g, "").slice(-10)
  if (digits.length !== 10) return NextResponse.json({ ok: true, suggestion: null })

  const { data: leads } = await supabase.from("leads").select("id").eq("normalized_phone", digits)
  const leadIds = (leads ?? []).map((l) => l.id)
  if (leadIds.length === 0) return NextResponse.json({ ok: true, suggestion: null })

  const { data: hits } = await supabase
    .from("lead_touchpoints")
    .select("raw_payload_json, occurred_at")
    .in("lead_id", leadIds)
    .eq("touchpoint_type", "address_detected")
    .order("occurred_at", { ascending: false })
    .limit(1)
  const hit = hits?.[0]
  const address = (hit?.raw_payload_json as { address?: string } | null)?.address
  if (!address) return NextResponse.json({ ok: true, suggestion: null })

  return NextResponse.json({
    ok: true,
    suggestion: {
      address,
      via: (hit?.raw_payload_json as { via?: string } | null)?.via ?? "text",
      at: hit?.occurred_at ?? null,
    },
  })
}

export async function POST(request: NextRequest) {
  if (!(await actorOr401(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  let body: { orderId?: string; address?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  const orderId = (body.orderId ?? "").trim()
  const address = (body.address ?? "").trim().slice(0, 200)
  if (!orderId || !address) return NextResponse.json({ error: "orderId and address required" }, { status: 400 })

  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "no database" }, { status: 500 })

  const { data: order } = await supabase.from("orders").select("id, invoice_data").eq("id", orderId).maybeSingle()
  if (!order) return NextResponse.json({ error: "order not found" }, { status: 404 })

  // Keep the stored invoice in step, or the chef sheet and the order disagree.
  const invoiceData = (order.invoice_data ?? null) as Record<string, unknown> | null
  const contact = (invoiceData?.contactInfo ?? null) as Record<string, unknown> | null
  const nextInvoice =
    invoiceData && contact ? { ...invoiceData, contactInfo: { ...contact, eventAddress: address } } : invoiceData

  const { error } = await supabase
    .from("orders")
    .update({ event_address: address, invoice_data: nextInvoice, updated_at: new Date().toISOString() })
    .eq("id", orderId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from("order_events").insert({
    order_id: orderId,
    actor: "staff",
    action: "address_set_from_message",
    metadata: { address },
  })

  return NextResponse.json({ ok: true, address })
}
