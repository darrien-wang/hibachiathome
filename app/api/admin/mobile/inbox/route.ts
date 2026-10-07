import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"
import { computeInbox } from "@/lib/inbox"
import { createServerSupabaseClient } from "@/lib/supabase"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 手机 App 的收件箱. The Android shell's foreground service polls this every
// 10 s (foreground) / 30 s (background) with the login-session cookie and
// turns the events into local notifications. The list itself is built in
// lib/inbox.ts, shared with /api/admin/desk, so the phone and the agent's
// desk never disagree on what is open.
export async function GET(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })
  const now = Date.now()
  const { counts, events } = await computeInbox(supabase, now)
  // The extra ids and the desk-only grace flag ride on the desk response; the
  // app keys off `key`/`url` and its payload stays exactly as it was.
  // The app knows three channels: lead / sms (both loud) / everything else
  // (quiet). A customer answering by email or through the website, a message
  // the rules missed, a text that never arrived - all of it is a customer
  // waiting on us, so it rides the loud replies channel (2026-10-07).
  const LOUD_AS_SMS = new Set(["email", "form", "audit", "undelivered"])
  const slim = events.map(({ leadId: _l, phone: _p, orderId: _o, justArrived: _j, ...rest }) => ({
    ...rest,
    kind: LOUD_AS_SMS.has(rest.kind) ? "sms" : rest.kind,
  }))
  return NextResponse.json({
    ok: true,
    serverTime: new Date(now).toISOString(),
    member: { name: actor.name ?? actor.alias, role: actor.role },
    counts,
    events: slim,
  })
}
