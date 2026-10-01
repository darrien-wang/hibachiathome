import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"
import { scanLeads } from "@/lib/lead-scan"
import { createServerSupabaseClient } from "@/lib/supabase"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// The lead scan in one call (线索扫描 skill, 2026-10-01): every open lead in a
// bucket with its reason, plus the paid parties inside two weeks that still
// miss an address, a menu or a time. `?write=1` also stores each lead's
// bucket in leads.segment / next_action_at so the workbench and the phone can
// show it. Read-only otherwise; nothing here texts anyone.
export async function GET(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })
  const write = request.nextUrl.searchParams.get("write") === "1"
  const result = await scanLeads(supabase, Date.now(), { write })
  return NextResponse.json({ ok: true, ...result })
}
