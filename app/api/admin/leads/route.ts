import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor, publicActor, type AdminActor } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase"
import { upsertLeadFromContact } from "@/lib/leads"
import { fetchLastByPeer, toE164 } from "@/lib/sms-thread"

export const dynamic = "force-dynamic"

const FIRST_RESPONSE_TYPE = "agent_first_response"
const STATUS_CHANGE_TYPE = "agent_status_change"
const EDIT_TYPE = "agent_edit"
const NOTE_TYPE = "agent_note"
const MERGE_TYPE = "agent_merge"
const ALLOWED_STATUSES = ["new", "qualified", "disqualified", "won", "lost"] as const
const MANUAL_CHANNELS = ["phone", "sms", "facebook", "instagram", "wechat", "walk_in", "referral", "other"] as const
const EDITABLE_FIELDS = ["full_name", "phone", "email", "city_or_zip", "guest_count"] as const

type Actor = AdminActor

// Owner key, agent keys and SMS-login sessions all resolve through lib/admin-auth.
const resolveActor = (request: NextRequest) => resolveAdminActor(request)

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
  const actor = await resolveActor(request)
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

  const LIST_COLUMNS =
    "id, created_at, full_name, phone, email, status, lead_source, lead_channel, lead_type, city_or_zip, guest_count, latest_message, utm_source, utm_medium, utm_campaign, utm_term, gclid, referral_code, hear_about_us, touchpoint_count, last_seen_at, hold_until, hold_set_at, acked_until"

  // merged_into arrives with add-lead-merge-fields.sql. Until that migration is
  // applied the column does not exist, and filtering on it would 500 the whole
  // workbench — so fall back to the unfiltered query instead of going down.
  let { data: leads, error } = await supabase
    .from("leads")
    .select(LIST_COLUMNS)
    .is("merged_into", null)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error?.code === "42703") {
    ;({ data: leads, error } = await supabase
      .from("leads")
      .select(LIST_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(limit))
  }
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

  // Who spoke last. The workbench sorts "客人等回复" to the top from this:
  // the latest thing the customer did vs. the latest thing we did, plus the
  // party date they typed into a form, so the list can show "想订 10/3".
  // The timeline alone is not enough - replies sent outside the workbench
  // never wrote a line - so the Twilio thread (the complete record) is
  // merged in below. The automated landing quote is OUR message: it counts
  // as outbound for timing but is labelled "auto" so a lead that only ever
  // got the robot's price still reads as needing a human.
  const INBOUND_TYPES = ["sms_inbound", "call_inbound", "landing_contact", "contact_form", "contact_intent", "quote_book_online", "manual_entry", "planner_unlock"]
  const AUTO_TYPES = ["landing_quote_text"]
  const OUTBOUND_TYPES = ["sms_outbound", FIRST_RESPONSE_TYPE, "sms_failed"]
  const lastInbound: Record<string, string> = {}
  const lastOutbound: Record<string, string> = {}
  const lastPersonal: Record<string, string> = {}
  const lastAuto: Record<string, string> = {}
  const eventHint: Record<string, string> = {}
  if (ids.length > 0) {
    const { data: recent } = await supabase
      .from("lead_touchpoints")
      .select("lead_id, touchpoint_type, occurred_at, raw_payload_json")
      .in("lead_id", ids)
      .in("touchpoint_type", [...INBOUND_TYPES, ...AUTO_TYPES, ...OUTBOUND_TYPES])
      .order("occurred_at", { ascending: false })
      .limit(3000)
    for (const ev of recent ?? []) {
      const t = String(ev.touchpoint_type)
      if (INBOUND_TYPES.includes(t)) {
        if (!lastInbound[ev.lead_id]) lastInbound[ev.lead_id] = ev.occurred_at
        if (!eventHint[ev.lead_id]) {
          const p = (ev.raw_payload_json ?? {}) as Record<string, unknown>
          const d = p.eventDate ?? p.event_date ?? p.partyDate ?? p.date
          if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) eventHint[ev.lead_id] = d.slice(0, 10)
        }
      } else if (AUTO_TYPES.includes(t)) {
        if (!lastAuto[ev.lead_id]) lastAuto[ev.lead_id] = ev.occurred_at
        if (!lastOutbound[ev.lead_id]) lastOutbound[ev.lead_id] = ev.occurred_at
        if (!eventHint[ev.lead_id]) {
          const p = (ev.raw_payload_json ?? {}) as Record<string, unknown>
          const d = p.eventDate ?? p.event_date
          if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) eventHint[ev.lead_id] = d.slice(0, 10)
        }
      } else {
        if (!lastOutbound[ev.lead_id]) lastOutbound[ev.lead_id] = ev.occurred_at
        if (!lastPersonal[ev.lead_id] && t !== "sms_failed") lastPersonal[ev.lead_id] = ev.occurred_at
      }
    }
  }
  // Twilio: newest inbound / outbound per number, whoever sent it.
  const isAutoText = (body: string) => body.trimStart().startsWith("Real Hibachi:")
  const twilio = await fetchLastByPeer().catch(() => new Map())
  const lastPreview: Record<string, { speaker: "customer" | "us" | "auto"; body: string; at: string }> = {}
  for (const l of leads ?? []) {
    const peer = toE164(l.phone)
    const tw = peer ? twilio.get(peer) : undefined
    if (tw) {
      if (tw.lastInAt && (!lastInbound[l.id] || tw.lastInAt > lastInbound[l.id])) lastInbound[l.id] = tw.lastInAt
      if (tw.lastOutAt && (!lastOutbound[l.id] || tw.lastOutAt > lastOutbound[l.id])) lastOutbound[l.id] = tw.lastOutAt
      if (tw.lastOutAt && !isAutoText(tw.last.direction === "outbound" ? tw.last.body : "") && (!lastPersonal[l.id] || tw.lastOutAt > lastPersonal[l.id]) && tw.last.direction === "outbound") lastPersonal[l.id] = tw.lastOutAt
      lastPreview[l.id] = { speaker: tw.last.direction === "inbound" ? "customer" : isAutoText(tw.last.body) ? "auto" : "us", body: tw.last.body, at: tw.last.at }
    }
    // A form or auto quote newer than anything on the phone wins the label.
    const candidates: Array<{ at: string; speaker: "customer" | "us" | "auto" }> = []
    if (lastInbound[l.id]) candidates.push({ at: lastInbound[l.id], speaker: "customer" })
    if (lastAuto[l.id]) candidates.push({ at: lastAuto[l.id], speaker: "auto" })
    if (lastPersonal[l.id]) candidates.push({ at: lastPersonal[l.id], speaker: "us" })
    const top = candidates.sort((a, b) => b.at.localeCompare(a.at))[0]
    if (top && (!lastPreview[l.id] || top.at > lastPreview[l.id].at)) lastPreview[l.id] = { speaker: top.speaker, body: l.latest_message ?? "", at: top.at }
  }

  // A lead that never typed a name but paid a deposit has one on the order
  // (the deposit form asks). Show that name here rather than "未留名";
  // the stored row is backfilled separately, this covers the gap in between.
  const isPlaceholderName = (v: unknown) => {
    const n = typeof v === "string" ? v.trim() : ""
    return !n || /^\+?\d[\d\s().-]{6,}$/.test(n) || /^(unknown contact|unknown|guest|sms lead|caller)$/i.test(n)
  }
  const nameFromOrder: Record<string, string> = {}
  const nameless = (leads ?? []).filter((l) => isPlaceholderName(l.full_name))
  if (nameless.length > 0) {
    const phones = nameless.map((l) => (l.phone ?? "").replace(/\D/g, "").slice(-10)).filter((p) => p.length === 10)
    const { data: orders } = await supabase
      .from("orders")
      .select("customer_name, customer_phone, source_metadata")
      .not("customer_name", "is", null)
      .order("created_at", { ascending: false })
      .limit(300)
    for (const l of nameless) {
      const p = (l.phone ?? "").replace(/\D/g, "").slice(-10)
      const hit = (orders ?? []).find((o) => {
        if (isPlaceholderName(o.customer_name)) return false
        const meta = (o.source_metadata ?? {}) as Record<string, unknown>
        if (meta.lead_id === l.id) return true
        return p.length === 10 && phones.includes(p) && (o.customer_phone ?? "").replace(/\D/g, "").slice(-10) === p
      })
      if (hit?.customer_name) nameFromOrder[l.id] = String(hit.customer_name).trim()
    }
    // Persist what we just recovered (a few at a time), with an audit line, so
    // texts and templates that read leads.full_name get the name too.
    const heal = Object.entries(nameFromOrder).slice(0, 20)
    for (const [id, name] of heal) {
      const before = (leads ?? []).find((l) => l.id === id)?.full_name ?? null
      const { error: upErr } = await supabase.from("leads").update({ full_name: name, updated_at: new Date().toISOString() }).eq("id", id)
      if (!upErr) {
        await supabase.from("lead_touchpoints").insert({
          lead_id: id,
          touchpoint_type: "agent_edit",
          touchpoint_source: "admin_dashboard",
          raw_payload_json: { actor: "system:name_from_order", note: "姓名从订单补回", before: { full_name: before }, after: { full_name: name } },
        })
      }
    }
  }

  const rows = (leads ?? []).map((l) => {
    const firstResponseAt = responses[l.id] ?? null
    const responseSeconds = firstResponseAt
      ? Math.max(0, (new Date(firstResponseAt).getTime() - new Date(l.created_at).getTime()) / 1000)
      : null
    return {
      ...l,
      full_name: nameFromOrder[l.id] ?? l.full_name,
      name_source: nameFromOrder[l.id] ? "order" : "lead",
      first_response_at: firstResponseAt,
      response_seconds: responseSeconds,
      last_inbound_at: lastInbound[l.id] ?? null,
      last_outbound_at: lastOutbound[l.id] ?? null,
      last_speaker: lastPreview[l.id]?.speaker ?? null,
      last_preview: lastPreview[l.id]?.body ?? null,
      last_at: lastPreview[l.id]?.at ?? null,
      // The robot quoted and nobody followed up in person yet.
      needs_followup: !!lastAuto[l.id] && (!lastPersonal[l.id] || lastPersonal[l.id] < lastAuto[l.id]) && (!lastInbound[l.id] || lastInbound[l.id] < lastAuto[l.id]),
      event_hint: eventHint[l.id] ?? null,
    }
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

  return NextResponse.json({ leads: rows, stats, viewer: publicActor(actor) })
}

export async function POST(request: NextRequest) {
  const actor = await resolveActor(request)
  if (!actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  let body: { name?: string; phone?: string; email?: string; channel?: string; message?: string; adRef?: string }
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
    // An [AD-xxxxxx] code from the customer's text ties this manual lead back
    // to the paid click that produced it (GA4 keeps code -> full gclid).
    const adRef = (body.adRef ?? "").trim().toUpperCase().slice(0, 16)
    if (adRef && supabase) {
      await supabase
        .from("leads")
        .update({ utm_source: "google", utm_medium: "cpc", utm_campaign: `sms_ref:${adRef}` })
        .eq("id", result.leadId)
    }
    return NextResponse.json({ ok: true, leadId: result.leadId, deduped: result.deduped })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const actor = await resolveActor(request)
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
    /** set_hold：挂起几天，0 = 撤销。 */
    days?: number
    /** ack_replies：true = 撤销「不用回」。 */
    clear?: boolean
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

  // Merge duplicates that automatic dedupe cannot catch: an inbound call and an
  // email inquiry from the same person share no field to match on.
  // Agents merge too: they are the ones who spot the duplicate while the
  // customer is still on the line, and parking it until the owner logs in
  // leaves a split timeline that the next person answers from blind.
  if (body.action === "merge") {
    const ids = Array.isArray(body.leadIds) ? body.leadIds.filter((x) => typeof x === "string") : []
    if (ids.length < 2 || ids.length > 10) {
      return NextResponse.json({ error: "select between 2 and 10 leads to merge" }, { status: 400 })
    }

    const { data: rows, error: fetchError } = await supabase
      .from("leads")
      .select("*")
      .in("id", ids)
      .is("merged_into", null)
    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }
    if (!rows || rows.length < 2) {
      return NextResponse.json({ error: "leads not found or already merged" }, { status: 400 })
    }

    // Oldest row wins: first-touch attribution and the response-time clock both
    // hang off it, so keeping a newer row would silently distort the metrics.
    const ordered = [...rows].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    const survivor = ordered[0]
    const losers = ordered.slice(1)

    // Fill only the survivor's blanks — never overwrite a value it already has.
    const FILLABLE = [
      "full_name", "phone", "normalized_phone", "email", "city_or_zip", "guest_count",
      "inquiry_reason", "source_page", "hear_about_us", "referral_code", "external_call_id",
      "manual_entry_id", "utm_source", "utm_medium", "utm_campaign", "utm_term",
      "utm_content", "gclid", "wbraid", "gbraid", "oppref",
    ] as const
    const patch: Record<string, unknown> = {}
    for (const field of FILLABLE) {
      if (survivor[field] === null || survivor[field] === undefined || survivor[field] === "") {
        const donor = losers.find((l) => l[field] !== null && l[field] !== undefined && l[field] !== "")
        if (donor) patch[field] = donor[field]
      }
    }
    patch.touchpoint_count = ordered.reduce((sum, r) => sum + (Number(r.touchpoint_count) || 1), 0)
    const latest = [...ordered].sort(
      (a, b) => new Date(b.last_seen_at ?? b.created_at).getTime() - new Date(a.last_seen_at ?? a.created_at).getTime()
    )[0]
    patch.latest_message = latest.latest_message ?? survivor.latest_message
    patch.last_seen_at = latest.last_seen_at ?? survivor.last_seen_at
    patch.updated_at = new Date().toISOString()

    const loserIds = losers.map((l) => String(l.id))

    // Touchpoints move first: if the run dies after this the timeline is still
    // whole on the survivor, and the losers are simply not yet hidden.
    const { error: moveError } = await supabase
      .from("lead_touchpoints")
      .update({ lead_id: survivor.id })
      .in("lead_id", loserIds)
    if (moveError) {
      return NextResponse.json({ error: `touchpoint move failed: ${moveError.message}` }, { status: 500 })
    }

    // external_call_id and manual_entry_id carry unique indexes, and a merged
    // row is hidden rather than deleted, so it keeps holding its value. Handing
    // the same value to the survivor while the loser still has it violates the
    // constraint. They are identity keys — after a merge the survivor is who
    // that CallSid belongs to — so they move rather than copy: clear them off
    // the losers first, in the same write that hides them.
    const surrenderedKeys = losers.map((l) => ({
      id: String(l.id),
      external_call_id: l.external_call_id ?? null,
      manual_entry_id: l.manual_entry_id ?? null,
    }))

    const { error: markError } = await supabase
      .from("leads")
      .update({
        merged_into: survivor.id,
        merged_at: new Date().toISOString(),
        external_call_id: null,
        manual_entry_id: null,
      })
      .in("id", loserIds)
    if (markError) {
      return NextResponse.json({ error: markError.message }, { status: 500 })
    }

    const { error: updateError } = await supabase.from("leads").update(patch).eq("id", survivor.id)
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    await logEvent(supabase, String(survivor.id), MERGE_TYPE, actor, {
      merged_ids: loserIds,
      merged_labels: losers.map((l) => l.full_name || l.phone || l.email || String(l.id)),
      surrendered_keys: surrenderedKeys,
      filled_fields: Object.keys(patch).filter((k) => !["touchpoint_count", "updated_at", "last_seen_at", "latest_message"].includes(k)),
    })

    return NextResponse.json({ ok: true, survivorId: String(survivor.id), mergedCount: loserIds.length })
  }

  // Notes taken while the phone is ringing or connected: the drawer knows the
  // caller's number, not which lead row it belongs to, so resolve by phone the
  // same way dedupe does (last 10 digits) and fall back to creating the lead.
  if (body.action === "call_note") {
    const note = typeof body.note === "string" ? body.note.trim() : ""
    const phone = typeof body.phone === "string" ? body.phone.trim() : ""
    if (!note || !phone) {
      return NextResponse.json({ error: "note and phone required" }, { status: 400 })
    }
    const digits = phone.replace(/\D/g, "")
    const dedupeKey = digits.length > 10 ? digits.slice(-10) : digits
    if (!dedupeKey) {
      return NextResponse.json({ error: "unusable phone" }, { status: 400 })
    }

    const { data: match } = await supabase
      .from("leads")
      .select("id")
      .eq("normalized_phone", dedupeKey)
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    let targetId = match?.id ? String(match.id) : ""
    if (!targetId) {
      const created = await upsertLeadFromContact(supabase, {
        name: phone,
        phone,
        message: "Call note (lead created from the softphone)",
        leadSource: "phone_inbound",
        leadChannel: "phone",
        touchpointType: "call_inbound",
        touchpointSource: "softphone",
      })
      targetId = created.leadId
    }

    await logEvent(supabase, targetId, NOTE_TYPE, actor, {
      note: note.slice(0, 4000),
      during_call: true,
      call_sid: typeof body.callSid === "string" ? body.callSid : undefined,
    })
    return NextResponse.json({ ok: true, leadId: targetId })
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

  // 球给客户（老板 2026-09-23 定）：他说了会回头找我们，这段时间我们不欠回复。
  // 不是一个新状态——漏斗阶段照旧，只是"等谁"这一维翻过去。days=0 撤销。
  if (body.action === "set_hold") {
    const days = Number(body.days)
    if (!Number.isFinite(days) || days < 0 || days > 60) {
      return NextResponse.json({ error: "days must be 0-60" }, { status: 400 })
    }
    const now = new Date()
    const clearing = days === 0
    const { error } = await supabase
      .from("leads")
      .update({
        hold_until: clearing ? null : new Date(now.getTime() + days * 86400_000).toISOString(),
        hold_set_at: clearing ? null : now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", leadId)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    await logEvent(supabase, leadId, NOTE_TYPE, actor, {
      note: clearing ? "撤销「等客户回」" : `等客户回 · ${days} 天（客人说他会回头联系我们）`,
    })
    return NextResponse.json({ ok: true })
  }

  // 「这条不用回」——老板 2026-09-24 定（Natalie 的一句道谢每隔几分钟响一次）。
  // 水位线：这一刻之前的消息都算处理完了，客人再发新的照样响。撤销传 clear:true。
  if (body.action === "ack_replies") {
    const clearing = body.clear === true
    const now = new Date()
    const { error } = await supabase
      .from("leads")
      .update({ acked_until: clearing ? null : now.toISOString(), updated_at: now.toISOString() })
      .eq("id", leadId)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    await logEvent(supabase, leadId, NOTE_TYPE, actor, {
      note: clearing ? "撤销「不用回」" : "标记「不用回」：到此为止的消息都不需要回复（新消息会重新提醒）",
    })
    return NextResponse.json({ ok: true, ackedUntil: clearing ? null : now.toISOString() })
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
