import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Staff-only: record that an order-stage SOP message was sent, so the drawer
// checklist can tick it. Audit-log append only — order state never changes here.
async function isAuthorized(request: NextRequest): Promise<boolean> {
  return (await resolveAdminActor(request)) !== null
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
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
