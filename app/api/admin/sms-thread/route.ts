import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { fetchSmsThread, fetchSmsThreads, sendSms, toE164 } from "@/lib/sms-thread"

export const dynamic = "force-dynamic"

/** Most unprompted texts a lead who has never replied can get, auto quote included (leads skill 4.4). */
const FOLLOWUP_CAP = 6

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

/**
 * GET ?leadId=… (preferred) or ?phone=… -> the SMS conversation, oldest first.
 * With a leadId the thread covers the lead's own number AND the numbers of
 * every lead merged into it, so a customer who texts from a second phone
 * still shows up as one conversation.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const phones: string[] = []
  const phoneParam = toE164(request.nextUrl.searchParams.get("phone"))
  if (phoneParam) phones.push(phoneParam)
  const leadId = request.nextUrl.searchParams.get("leadId")?.trim()
  if (leadId && /^[0-9a-f-]{36}$/i.test(leadId)) {
    const supabase = createServerSupabaseClient()
    if (supabase) {
      const { data } = await supabase.from("leads").select("phone").or(`id.eq.${leadId},merged_into.eq.${leadId}`)
      for (const row of data ?? []) {
        const p = toE164((row as { phone: string | null }).phone)
        if (p) phones.push(p)
      }
    }
  }
  const unique = Array.from(new Set(phones))
  if (unique.length === 0) return NextResponse.json({ error: "no phone for this lead" }, { status: 400 })
  const messages = await fetchSmsThreads(unique, 80)
  return NextResponse.json({ ok: true, phones: unique, messages })
}

/**
 * POST { phone, body, leadId? } -> send from the 213 line and write it down:
 * a lead_touchpoints row so the history panel shows it, and the lead's
 * latest_message / last_seen_at so the daily "unanswered leads" sweep knows
 * someone replied (see ~/.claude/scheduled-tasks/ads-daily-report).
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  let payload: { phone?: string; body?: string; leadId?: string; force?: boolean }
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

  // ---- Brakes (owner, 2026-09-19) ------------------------------------------
  // Replies are never braked: when the customer spoke last, answer at once.
  // Unprompted follow-ups to someone who has never answered are capped, so a
  // silent lead cannot be texted into a STOP or a spam report that drags down
  // the 213 line's standing for every deposit and chef text. The thread is
  // read from Twilio, so the count includes texts sent from anywhere.
  // force:true is the owner overriding on purpose.
  {
    const supabase = createServerSupabaseClient()
    if (supabase && !payload.force) {
      const { data: blocked } = await supabase
        .from("leads")
        .select("sms_blocked_reason")
        .eq("phone", phone)
        .not("sms_blocked_at", "is", null)
        .limit(1)
      if (blocked && blocked.length > 0) {
        return NextResponse.json(
          { error: `这个号码收不到短信（${blocked[0].sms_blocked_reason ?? "unreachable"}），已停发，改用邮件`, brake: "sms_blocked" },
          { status: 409 },
        )
      }
    }
    if (!payload.force) {
      const thread = await fetchSmsThread(phone, 100)
      const last = thread[thread.length - 1]
      const customerSpokeLast = last?.direction === "inbound"
      if (!customerSpokeLast) {
        const outbound = thread.filter((m) => m.direction === "outbound")
        const everReplied = thread.some((m) => m.direction === "inbound")
        const now = Date.now()
        const last24h = outbound.filter((m) => now - new Date(m.at).getTime() < 24 * 3600_000).length
        const lastOut = outbound[outbound.length - 1]
        if (!everReplied && outbound.length >= FOLLOWUP_CAP) {
          return NextResponse.json(
            { error: `已发 ${outbound.length} 条、对方从没回过，到上限 ${FOLLOWUP_CAP} 条，停发`, brake: "cap" },
            { status: 409 },
          )
        }
        if (last24h >= 2) {
          return NextResponse.json({ error: "24 小时内已经主动发过 2 条", brake: "daily" }, { status: 409 })
        }
        if (lastOut && now - new Date(lastOut.at).getTime() < 3 * 3600_000) {
          return NextResponse.json({ error: "距上一条主动消息不到 3 小时", brake: "spacing" }, { status: 409 })
        }
      }
    }
  }

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
