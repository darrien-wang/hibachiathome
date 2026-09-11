import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { fetchSmsThread, sendSms, toE164 } from "@/lib/sms-thread"

export const dynamic = "force-dynamic"

// Staff-only. Same key scheme as the rest of /api/admin:
// owner ADMIN_DASH_KEY, agents AGENT_DASH_KEYS="anna:key1,bob:key2".
function isAuthorized(request: NextRequest): boolean {
  const provided = request.headers.get("x-admin-key") ?? ""
  if (!provided) return false
  if (process.env.ADMIN_DASH_KEY && provided === process.env.ADMIN_DASH_KEY) return true
  for (const entry of (process.env.AGENT_DASH_KEYS ?? "").split(",")) {
    const [alias, key] = entry.split(":").map((s) => s?.trim())
    if (alias && key && provided === key) return true
  }
  return false
}

/** GET ?phone=… -> the SMS conversation with that number, oldest first. */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const phone = toE164(request.nextUrl.searchParams.get("phone"))
  if (!phone) return NextResponse.json({ error: "invalid phone" }, { status: 400 })
  const messages = await fetchSmsThread(phone, 80)
  return NextResponse.json({ ok: true, phone, messages })
}

/**
 * POST { phone, body, leadId? } -> send from the 213 line and write it down:
 * a lead_touchpoints row so the history panel shows it, and the lead's
 * latest_message / last_seen_at so the daily "unanswered leads" sweep knows
 * someone replied (see ~/.claude/scheduled-tasks/ads-daily-report).
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  let payload: { phone?: string; body?: string; leadId?: string }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  const phone = toE164(payload.phone)
  const body = (payload.body ?? "").trim()
  if (!phone) return NextResponse.json({ error: "invalid phone" }, { status: 400 })
  if (!body) return NextResponse.json({ error: "empty message" }, { status: 400 })
  if (body.length > 1200) return NextResponse.json({ error: "message too long" }, { status: 400 })

  const sent = await sendSms(phone, body)
  if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 502 })

  const leadId = typeof payload.leadId === "string" && /^[0-9a-f-]{36}$/i.test(payload.leadId) ? payload.leadId : null
  if (leadId) {
    const supabase = createServerSupabaseClient()
    if (supabase) {
      const now = new Date().toISOString()
      const summary = body.length > 120 ? `${body.slice(0, 117)}…` : body
      await supabase.from("lead_touchpoints").insert({
        lead_id: leadId,
        touchpoint_type: "sms_outbound",
        touchpoint_source: "workbench",
        external_touchpoint_id: sent.sid,
        raw_payload_json: { to: phone, body, status: sent.status, actor: "workbench" },
        occurred_at: now,
      })
      await supabase
        .from("leads")
        .update({ latest_message: `我方 ${now.slice(0, 10)} 短信已回（213 线）：${summary}`, last_seen_at: now, updated_at: now })
        .eq("id", leadId)
    }
  }

  return NextResponse.json({ ok: true, sid: sent.sid, status: sent.status })
}
