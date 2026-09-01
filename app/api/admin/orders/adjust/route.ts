import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Staff-only guest-count / quote adjustment. Party headcounts drift right up
// to event day, so the workbench needs to restate the operational snapshot
// (guest counts, quoted total, derived balance) at any time. Money already
// collected stays owned by the invoice app; this endpoint only restates the
// quote side and leaves a full before/after audit trail in order_events —
// the same pragmatic direct-write exception deposit-confirm already uses
// for source_metadata.
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

function intInRange(value: unknown, min: number, max: number): number | null {
  const n = Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) return null
  return n
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: {
    orderId?: string
    adults?: number
    kids?: number
    quotedTotalCents?: number
    breakdown?: Record<string, unknown>
    note?: string
    operator?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const orderId = String(body.orderId ?? "").trim()
  const adults = intInRange(body.adults, 0, 500)
  const kids = intInRange(body.kids, 0, 500)
  const quotedTotalCents = intInRange(body.quotedTotalCents, 0, 10_000_000)
  if (!orderId || adults === null || kids === null || quotedTotalCents === null) {
    return NextResponse.json({ error: "orderId, adults, kids, quotedTotalCents required" }, { status: 400 })
  }
  const operator = String(body.operator ?? "staff").trim() || "staff"
  const note = String(body.note ?? "").trim().slice(0, 300)

  const supabase = createServerSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 500 })
  }

  const { data: order, error: readError } = await supabase
    .from("orders")
    .select(
      "id,guest_adult_count,guest_child_count,quoted_total_cents,balance_due_cents,deposit_paid_total_cents,non_deposit_paid_total_cents,invoice_data",
    )
    .eq("id", orderId)
    .maybeSingle()
  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 })
  }
  if (!order) {
    return NextResponse.json({ error: "order not found" }, { status: 404 })
  }

  const paidCents = (order.deposit_paid_total_cents ?? 0) + (order.non_deposit_paid_total_cents ?? 0)
  const balanceDueCents = Math.max(0, quotedTotalCents - paidCents)
  const nowIso = new Date().toISOString()

  const mergedInvoiceData = {
    ...((order.invoice_data as Record<string, unknown>) ?? {}),
    total_cost: quotedTotalCents / 100,
    adjusted_at: nowIso,
    adjusted_by: operator,
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      guest_adult_count: adults,
      guest_child_count: kids,
      quoted_total_cents: quotedTotalCents,
      balance_due_cents: balanceDueCents,
      invoice_data: mergedInvoiceData,
      updated_at: nowIso,
    })
    .eq("id", orderId)
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  await supabase.from("order_events").insert({
    order_id: orderId,
    actor: `admin:${operator}`,
    action: "order_details_adjusted",
    metadata: {
      before: {
        adults: order.guest_adult_count,
        kids: order.guest_child_count,
        quoted_total_cents: order.quoted_total_cents,
        balance_due_cents: order.balance_due_cents,
      },
      after: {
        adults,
        kids,
        quoted_total_cents: quotedTotalCents,
        balance_due_cents: balanceDueCents,
      },
      breakdown: body.breakdown ?? null,
      note: note || null,
    },
  })

  return NextResponse.json({ ok: true, balanceDueCents })
}
