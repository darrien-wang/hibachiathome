import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"
import { requestCallback } from "@/lib/callback-ring"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// 请回电 raised by a person (`desk callback <lead>`): the customer wants a call but did not say it
// in words the SMS webhook recognises ("I'm driving", a voice note, an email). Rings the owner's App
// now if due; lead-watch rings again every ten minutes until he presses 1 or 3 (lib/callback-ring.ts).
export async function POST(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })
  let body: { leadId?: unknown; why?: unknown }
  try {
    body = (await request.json()) as { leadId?: unknown; why?: unknown }
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 })
  }
  const leadId = typeof body.leadId === "string" ? body.leadId.trim() : ""
  if (!/^[0-9a-f-]{36}$/i.test(leadId)) return NextResponse.json({ ok: false, error: "leadId required" }, { status: 400 })
  const { data: lead } = await supabase.from("leads").select("id, full_name, phone").eq("id", leadId).maybeSingle()
  if (!lead) return NextResponse.json({ ok: false, error: "lead not found" }, { status: 404 })
  if (!lead.phone) return NextResponse.json({ ok: false, error: "lead has no phone" }, { status: 400 })
  const why = typeof body.why === "string" ? body.why.trim().slice(0, 500) : ""
  const out = await requestCallback(supabase, {
    leadId,
    phone: String(lead.phone),
    name: String(lead.full_name ?? ""),
    why,
    source: `desk:${actor.alias}`,
  })
  return NextResponse.json({ ok: true, ...out })
}
