import { type NextRequest, NextResponse } from "next/server"
import { publicActor, resolveAdminActor } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export type PasskeySummary = { id: string; device_name: string | null; created_at: string; last_used_at: string | null }

// GET -> { ok, viewer, passkeys } for whoever holds a valid key or session cookie.
export async function GET(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  let passkeys: PasskeySummary[] = []
  if (actor.memberId) {
    const supabase = createServerSupabaseClient()
    const { data } = supabase
      ? await supabase.from("workbench_passkeys").select("id, device_name, created_at, last_used_at").eq("member_id", actor.memberId).order("created_at", { ascending: false })
      : { data: [] }
    passkeys = (data ?? []) as PasskeySummary[]
  }
  return NextResponse.json({ ok: true, viewer: publicActor(actor), passkeys })
}
