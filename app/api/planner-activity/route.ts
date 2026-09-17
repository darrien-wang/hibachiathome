import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { sendSupportNotificationEmail } from "@/lib/ops-notifications"
import { escapeHtml } from "@/lib/escape-html"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// What a lead is doing in the party planner, written onto their workbench
// timeline (决策日志 D-0917-02).
//
// Until now a planner link left the workbench and went dark: whether the
// customer opened it, played with it, invited their friends or finished the
// menu was invisible, so follow-ups were timed by guesswork. Each of those is
// a row here, and the two that are real buying signals - they shared the party
// with their guests, or the whole menu is picked - also wake ops, because
// that is the moment a short, warm text lands best.
//
// Server-to-server only (shared admin token). The planner app resolves the
// lead id from the private link's own record - the browser never supplies it -
// so nobody can write onto someone else's timeline. One row per event per lead
// per day: the unique (source, external id) index does the de-duplication, so
// a customer who opens their planner six times reads as "opened today", not
// six lines of noise.
const BASE_URL = "https://www.realhibachi.com"

const EVENTS: Record<string, { label: string; wake: boolean }> = {
  planner_opened: { label: "opened their party planner", wake: false },
  planner_edited: { label: "is working on their party in the planner", wake: false },
  planner_shared: { label: "shared the party with their guests", wake: true },
  planner_guest_joined: { label: "had their first guest join the party", wake: false },
  planner_half_joined: { label: "has half the party joined", wake: false },
  planner_menu_complete: { label: "has a complete menu - every guest has picked", wake: true },
}

type Body = {
  leadId?: string
  event?: string
  plannerUrl?: string
  guests?: number
  picked?: number
  joined?: number
  total?: number
  eventDate?: string
}

const asInt = (v: unknown) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n >= 0 && n < 1000 ? n : null
}

export async function POST(request: NextRequest) {
  const expected = process.env.INVOICE_UPDATE_ADMIN_TOKEN?.trim()
  const provided = request.headers.get("x-admin-token")?.trim()
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const leadId = String(body.leadId ?? "").trim()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leadId)) {
    return NextResponse.json({ ok: false, error: "lead_invalid" }, { status: 400 })
  }
  const event = String(body.event ?? "")
  const meta = EVENTS[event]
  if (!meta) return NextResponse.json({ ok: false, error: "event_invalid" }, { status: 400 })

  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "no_database" }, { status: 500 })

  // a merged lead forwards to the survivor, so the line lands where staff look
  const { data: lead } = await supabase.from("leads").select("id, full_name, phone, merged_into").eq("id", leadId).maybeSingle()
  if (!lead) return NextResponse.json({ ok: true, recorded: false, reason: "lead_not_found" })
  const targetId = (lead as { merged_into?: string | null }).merged_into || lead.id

  const guests = asInt(body.guests)
  const picked = asInt(body.picked)
  const joined = asInt(body.joined)
  const total = Number.isFinite(Number(body.total)) && Number(body.total) > 0 ? Math.round(Number(body.total) * 100) / 100 : null
  const plannerUrl = /^https:\/\/party\.realhibachi\.com\/order\?key=ok_[a-z0-9]+$/i.test(String(body.plannerUrl ?? "")) ? String(body.plannerUrl) : null
  const summary = [
    guests !== null ? `${guests} guests` : "",
    picked !== null && guests !== null ? `${picked}/${guests} picked` : "",
    joined ? `${joined} joined` : "",
    total !== null ? `$${total.toFixed(2)}` : "",
  ]
    .filter(Boolean)
    .join(" · ")

  const dayPt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date())
  const { error } = await supabase.from("lead_touchpoints").insert({
    lead_id: targetId,
    touchpoint_type: event,
    touchpoint_source: "order_planner",
    external_touchpoint_id: `${targetId}:${event}:${dayPt}`,
    raw_payload_json: { actor: "planner", note: summary, guests, picked, joined, total, plannerUrl },
  })
  if (error) {
    // 23505 = already recorded today; that is the de-duplication working
    if (error.code === "23505") return NextResponse.json({ ok: true, recorded: false, reason: "already_today" })
    console.error("[planner-activity] insert failed", error.message)
    return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 })
  }

  if (meta.wake) {
    const name = lead.full_name || lead.phone || "A lead"
    const workbench = `${BASE_URL}/admin/leads?lead=${targetId}`
    await sendSupportNotificationEmail({
      subject: `🎪 ${name} ${meta.label}`,
      text: [
        `${name} ${meta.label}.`,
        summary,
        plannerUrl ? `Their plan: ${plannerUrl}` : "",
        `Workbench: ${workbench}`,
        "A good moment for a short, warm hello - they are in the planner right now or were minutes ago.",
      ]
        .filter(Boolean)
        .join("\n"),
      html: `<p><strong>${escapeHtml(name)}</strong> ${escapeHtml(meta.label)}.</p>${summary ? `<p>${escapeHtml(summary)}</p>` : ""}
<p>${plannerUrl ? `<a href="${plannerUrl}">Open their plan</a> · ` : ""}<a href="${workbench}">Open in workbench</a></p>
<p>A good moment for a short, warm hello - they are in the planner right now or were minutes ago.</p>`,
    })
  }

  return NextResponse.json({ ok: true, recorded: true })
}
