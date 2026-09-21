import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Staff-only: record that a customer email went out from the order drawer.
// The send itself is /api/admin/send-followup; this is the audit trail, so a
// shared workbench can see who already emailed and never double-sends.
// Append-only — order state never changes here.
async function isAuthorized(request: NextRequest): Promise<boolean> {
  return (await resolveAdminActor(request)) !== null
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: { orderId?: string; to?: string; cc?: string[]; subject?: string; operator?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const orderId = String(body.orderId ?? "").trim()
  const to = String(body.to ?? "").trim()
  if (!orderId || !to) {
    return NextResponse.json({ error: "orderId and to are required" }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 500 })
  }

  const cc = Array.isArray(body.cc) ? body.cc.map((x) => String(x)).slice(0, 5) : []
  const { error } = await supabase.from("order_events").insert({
    order_id: orderId,
    actor: `admin:${String(body.operator ?? "staff").trim() || "staff"}`,
    action: "email_sent",
    metadata: {
      to,
      ...(cc.length > 0 ? { cc } : {}),
      subject: String(body.subject ?? "").slice(0, 200) || null,
      from: "support@realhibachi.com",
    },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
