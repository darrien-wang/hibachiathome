import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"
import { computeInbox } from "@/lib/inbox"
import { appVersionFromUA, isOpenAsk, mobileEvents, type OwnerAskRow } from "@/lib/owner-asks"
import { createServerSupabaseClient } from "@/lib/supabase"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 手机 App 的收件箱. The Android shell's foreground service polls this every
// 10 s (foreground) / 30 s (background) with the login-session cookie and
// turns the events into local notifications. The list itself is built in
// lib/inbox.ts, shared with /api/admin/desk, so the phone and the agent's
// desk never disagree on what is open.
//
// Since 2026-11-24 (owner: ring me only when you need my reply) the phone gets
// the desk's open questions to the owner on their own channel, plus a safety
// net for anyone the desk has left waiting 30 minutes - not every new lead and
// text, which the desk answers itself. lib/owner-asks.ts has the rules. The
// counts still ride along for the App's silent status line.
export async function GET(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })
  const now = Date.now()
  const [{ counts, events }, asksRes] = await Promise.all([
    computeInbox(supabase, now),
    supabase
      .from("owner_asks")
      .select("id, question, lead_id, order_no, created_at, answered_at")
      .is("answered_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
  ])
  // A failed read of the asks must not silence the safety net: carry on without them.
  const asks = ((asksRes.data ?? []) as OwnerAskRow[]).filter((r) => isOpenAsk(r, now))
  const appVersion = appVersionFromUA(request.headers.get("user-agent"))
  return NextResponse.json({
    ok: true,
    serverTime: new Date(now).toISOString(),
    member: { name: actor.name ?? actor.alias, role: actor.role },
    counts: { ...counts, ownerAsks: asks.length },
    events: mobileEvents(events, asks, { now, appVersion }),
  })
}
