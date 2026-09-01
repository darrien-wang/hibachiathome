import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Staff-only: record that an order-stage SOP message was sent, so the drawer
// checklist can tick it. Audit-log append only — order state never changes here.
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

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: { orderId?: string; sopId?: string; title?: string; operator?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const orderId = String(body.orderId ?? "").trim()
  const sopId = String(body.sopId ?? "").trim()
  if (!orderId || !sopId) {
    return NextResponse.json({ error: "orderId and sopId are required" }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 500 })
  }

  const { error } = await supabase.from("order_events").insert({
    order_id: orderId,
    actor: `admin:${String(body.operator ?? "staff").trim() || "staff"}`,
    action: "sop_sent",
    metadata: {
      sop_id: sopId,
      title: String(body.title ?? "").slice(0, 120) || null,
    },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
