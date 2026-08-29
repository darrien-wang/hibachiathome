import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

const FIRST_RESPONSE_TYPE = "agent_first_response"
const STATUS_CHANGE_TYPE = "agent_status_change"
const ALLOWED_STATUSES = ["new", "qualified", "disqualified", "won", "lost"] as const

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.ADMIN_DASH_KEY
  if (!expected) return false
  const provided =
    request.headers.get("x-admin-key") ?? request.nextUrl.searchParams.get("key") ?? ""
  return provided === expected
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const supabase = createServerSupabaseClient()
  const limit = Math.min(Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "100", 10) || 100, 300)

  const { data: leads, error } = await supabase
    .from("leads")
    .select(
      "id, created_at, full_name, phone, email, status, lead_source, lead_channel, lead_type, city_or_zip, guest_count, latest_message, utm_source, utm_medium, utm_campaign, utm_term, gclid, touchpoint_count, last_seen_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const ids = (leads ?? []).map((l) => l.id)
  const responses: Record<string, string> = {}
  if (ids.length > 0) {
    const { data: events } = await supabase
      .from("lead_touchpoints")
      .select("lead_id, occurred_at")
      .eq("touchpoint_type", FIRST_RESPONSE_TYPE)
      .in("lead_id", ids)
      .order("occurred_at", { ascending: true })
    for (const ev of events ?? []) {
      if (!responses[ev.lead_id]) responses[ev.lead_id] = ev.occurred_at
    }
  }

  const rows = (leads ?? []).map((l) => {
    const firstResponseAt = responses[l.id] ?? null
    const responseSeconds = firstResponseAt
      ? Math.max(0, (new Date(firstResponseAt).getTime() - new Date(l.created_at).getTime()) / 1000)
      : null
    return { ...l, first_response_at: firstResponseAt, response_seconds: responseSeconds }
  })

  // Stats over the returned window (newest N leads).
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  const last7d = rows.filter((r) => now - new Date(r.created_at).getTime() < 7 * dayMs)
  const responded7d = last7d.filter((r) => r.response_seconds !== null)
  const within5m = responded7d.filter((r) => (r.response_seconds ?? Infinity) <= 300)
  const stats = {
    today_leads: rows.filter((r) => now - new Date(r.created_at).getTime() < dayMs).length,
    open_leads: rows.filter((r) => r.status === "new" && r.response_seconds === null).length,
    avg_response_minutes_7d: responded7d.length
      ? Math.round(responded7d.reduce((s, r) => s + (r.response_seconds ?? 0), 0) / responded7d.length / 60)
      : null,
    within_5min_rate_7d: responded7d.length
      ? Math.round((within5m.length / responded7d.length) * 100)
      : null,
    responded_count_7d: responded7d.length,
    leads_7d: last7d.length,
  }

  return NextResponse.json({ leads: rows, stats })
}

export async function PATCH(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: { leadId?: string; action?: string; status?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  const leadId = typeof body.leadId === "string" ? body.leadId : ""
  if (!leadId) {
    return NextResponse.json({ error: "leadId required" }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  if (body.action === "mark_contacted") {
    // Idempotent: only the first agent_first_response event counts.
    const { data: existing } = await supabase
      .from("lead_touchpoints")
      .select("id")
      .eq("lead_id", leadId)
      .eq("touchpoint_type", FIRST_RESPONSE_TYPE)
      .limit(1)
    if (!existing || existing.length === 0) {
      const { error } = await supabase.from("lead_touchpoints").insert({
        lead_id: leadId,
        touchpoint_type: FIRST_RESPONSE_TYPE,
        touchpoint_source: "admin_dashboard",
        raw_payload_json: {},
      })
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }
    // First human touch moves a fresh lead into the pipeline.
    await supabase.from("leads").update({ status: "qualified", updated_at: new Date().toISOString() }).eq("id", leadId).eq("status", "new")
    return NextResponse.json({ ok: true })
  }

  if (body.action === "set_status") {
    const status = typeof body.status === "string" ? body.status : ""
    if (!ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number])) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 })
    }
    const { error } = await supabase
      .from("leads")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", leadId)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    await supabase.from("lead_touchpoints").insert({
      lead_id: leadId,
      touchpoint_type: STATUS_CHANGE_TYPE,
      touchpoint_source: "admin_dashboard",
      raw_payload_json: { status },
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 })
}
