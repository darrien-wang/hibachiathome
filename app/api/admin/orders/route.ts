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

    return NextResponse.json({
      ok: true,
      order: orderRes.data,
      payments: paymentsRes.data ?? [],
      events: eventsRes.data ?? [],
    })
  }

  const { data, error } = await supabase
    .from("orders")
    .select(LIST_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, orders: data ?? [] })
}
