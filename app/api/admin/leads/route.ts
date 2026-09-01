import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { upsertLeadFromContact } from "@/lib/leads"

export const dynamic = "force-dynamic"

const FIRST_RESPONSE_TYPE = "agent_first_response"
const STATUS_CHANGE_TYPE = "agent_status_change"
const EDIT_TYPE = "agent_edit"
const NOTE_TYPE = "agent_note"
const ALLOWED_STATUSES = ["new", "qualified", "disqualified", "won", "lost"] as const
const MANUAL_CHANNELS = ["phone", "sms", "facebook", "instagram", "wechat", "walk_in", "referral", "other"] as const
const EDITABLE_FIELDS = ["full_name", "phone", "email", "city_or_zip", "guest_count"] as const

type Actor = { role: "owner" | "agent"; alias: string }

// Owner: ADMIN_DASH_KEY. Agents: AGENT_DASH_KEYS="anna:key1,bob:key2".
function resolveActor(request: NextRequest): Actor | null {
  const provided =
    request.headers.get("x-admin-key") ?? request.nextUrl.searchParams.get("key") ?? ""
  if (!provided) return null
  const owner = process.env.ADMIN_DASH_KEY
  if (owner && provided === owner) return { role: "owner", alias: "owner" }
  for (const entry of (process.env.AGENT_DASH_KEYS ?? "").split(",")) {
    const [alias, key] = entry.split(":").map((s) => s?.trim())
    if (alias && key && provided === key) return { role: "agent", alias }
  }
  return null
}

async function logEvent(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  leadId: string,
  type: string,
  actor: Actor,
  payload: Record<string, unknown> = {}
) {
  await supabase.from("lead_touchpoints").insert({
    lead_id: leadId,
    touchpoint_type: type,
    touchpoint_source: "admin_dashboard",
    raw_payload_json: { ...payload, actor: actor.alias },
  })
}

export async function GET(request: NextRequest) {
  const actor = resolveActor(request)
  if (!actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const supabase = createServerSupabaseClient()

  // Detail mode: full event history for one lead (the audit trail view).
  const detailId = request.nextUrl.searchParams.get("detail")
  if (detailId) {
    const { data: events, error } = await supabase
      .from("lead_touchpoints")
      .select("touchpoint_type, touchpoint_source, occurred_at, raw_payload_json")
      .eq("lead_id", detailId)
      .order("occurred_at", { ascending: false })
      .limit(50)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ events: events ?? [] })
  }

  const limit = Math.min(Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "100", 10) || 100, 300)

  const { data: leads, error } = await supabase
    .from("leads")
    .select(
      "id, created_at, full_name, phone, email, status, lead_source, lead_channel, lead_type, city_or_zip, guest_count, latest_message, utm_source, utm_medium, utm_campaign, utm_term, gclid, referral_code, hear_about_us, touchpoint_count, last_seen_at"
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

  // Stats over the returned window (newest N leads). Disqualified leads are
  // junk/test entries - they stay queryable but never count toward metrics.
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  const counted = rows.filter((r) => r.status !== "disqualified")
  const last7d = counted.filter((r) => now - new Date(r.created_at).getTime() < 7 * dayMs)
  const responded7d = last7d.filter((r) => r.response_seconds !== null)
  const within5m = responded7d.filter((r) => (r.response_seconds ?? Infinity) <= 300)
  const stats = {
    today_leads: counted.filter((r) => now - new Date(r.created_at).getTime() < dayMs).length,
    open_leads: counted.filter((r) => r.status === "new" && r.response_seconds === null).length,
    avg_response_minutes_7d: responded7d.length
      ? Math.round(responded7d.reduce((s, r) => s + (r.response_seconds ?? 0), 0) / responded7d.length / 60)
      : null,
    within_5min_rate_7d: responded7d.length
      ? Math.round((within5m.length / responded7d.length) * 100)
      : null,
    responded_count_7d: responded7d.length,
    leads_7d: last7d.length,
  }

  return NextResponse.json({ leads: rows, stats, viewer: actor })
}

export async function POST(request: NextRequest) {
  const actor = resolveActor(request)
  if (!actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  let body: { name?: string; phone?: string; email?: string; channel?: string; message?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  const name = (body.name ?? "").trim()
  const phone = (body.phone ?? "").trim()
  if (!name && !phone) {
    return NextResponse.json({ error: "name or phone required" }, { status: 400 })
  }
  const channel = MANUAL_CHANNELS.includes((body.channel ?? "") as (typeof MANUAL_CHANNELS)[number])
    ? (body.channel as string)
    : "other"

  const supabase = createServerSupabaseClient()
  try {
    const result = await upsertLeadFromContact(supabase, {
      name: name || phone,
      phone: phone || undefined,
      email: (body.email ?? "").trim() || undefined,
      message: (body.message ?? "").trim() || `Manual entry (${channel})`,
      leadSource: `manual_${channel}`,
      leadChannel: channel,
      touchpointType: "manual_entry",
      touchpointSource: "admin_dashboard",
      rawPayload: { channel, actor: actor.alias },
    })
    return NextResponse.json({ ok: true, leadId: result.leadId, deduped: result.deduped })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const actor = resolveActor(request)
  if (!actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: {
    leadId?: string
    leadIds?: string[]
    action?: string
    status?: string
    fields?: Record<string, unknown>
    note?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  // Bulk archive/status — owner only.
  if (body.action === "bulk_status") {
    if (actor.role !== "owner") {
      return NextResponse.json({ error: "owner only" }, { status: 403 })
    }
    const status = typeof body.status === "string" ? body.status : ""
    const ids = Array.isArray(body.leadIds) ? body.leadIds.filter((x) => typeof x === "string") : []
    if (!ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number]) || ids.length === 0 || ids.length > 100) {
      return NextResponse.json({ error: "invalid bulk request" }, { status: 400 })
    }
    const { error } = await supabase
      .from("leads")
      .update({ status, updated_at: new Date().toISOString() })
      .in("id", ids)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    for (const id of ids) {
      await logEvent(supabase, id, STATUS_CHANGE_TYPE, actor, { status, bulk: true })
    }
    return NextResponse.json({ ok: true, count: ids.length })
  }

  const leadId = typeof body.leadId === "string" ? body.leadId : ""
  if (!leadId) {
    return NextResponse.json({ error: "leadId required" }, { status: 400 })
  }

  if (body.action === "mark_contacted") {
    // Idempotent: only the first agent_first_response event counts.
    const { data: existing } = await supabase
      .from("lead_touchpoints")
      .select("id")
      .eq("lead_id", leadId)
      .eq("touchpoint_type", FIRST_RESPONSE_TYPE)
      .limit(1)
    if (!existing || existing.length === 0) {
      await logEvent(supabase, leadId, FIRST_RESPONSE_TYPE, actor)
    }
    // First human touch moves a fresh lead into the pipeline.
    await supabase
      .from("leads")
      .update({ status: "qualified", updated_at: new Date().toISOString() })
      .eq("id", leadId)
      .eq("status", "new")
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
    await logEvent(supabase, leadId, STATUS_CHANGE_TYPE, actor, { status })
    return NextResponse.json({ ok: true })
  }

  // Field corrections (typos in name/phone/etc). Full before/after audit trail.
  if (body.action === "update_fields") {
    const fields = body.fields ?? {}
    const updates: Record<string, unknown> = {}
    for (const key of EDITABLE_FIELDS) {
      if (key in fields) {
        updates[key] = key === "guest_count" ? Number(fields[key]) || null : String(fields[key] ?? "").trim() || null
      }
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "no editable fields" }, { status: 400 })
    }
    const { data: before } = await supabase
      .from("leads")
      .select(EDITABLE_FIELDS.join(", "))
      .eq("id", leadId)
      .single()
    const { error } = await supabase
      .from("leads")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", leadId)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    await logEvent(supabase, leadId, EDIT_TYPE, actor, { before, after: updates })
    return NextResponse.json({ ok: true })
  }

  if (body.action === "add_note") {
    const note = (body.note ?? "").trim()
    if (!note) {
      return NextResponse.json({ error: "note required" }, { status: 400 })
    }
    await logEvent(supabase, leadId, NOTE_TYPE, actor, { note: note.slice(0, 2000) })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 })
}
