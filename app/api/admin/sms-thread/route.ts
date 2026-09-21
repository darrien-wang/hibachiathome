import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { fetchSmsThread, fetchSmsThreads, sendSms, toE164 } from "@/lib/sms-thread"
import { getWorkbenchSettings } from "@/lib/workbench-settings"

export const dynamic = "force-dynamic"

// The brake numbers (lifetime cap for a never-replier, daily cap, spacing,
// reply window) are owner-editable in /admin → 设置 → 短信刹车; the code
// defaults in lib/workbench-settings-shared.ts are the values that were
// hard-coded here until 2026-09-21 (leads skill 4.4).

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
// Automated texts (the instant quote, deposit confirmation, planner notices)
// all open with the house signature "Real Hibachi:" - planner-notify refuses
// anything else. Personal messages open with "Hi, it's Bling" / "It's Bling".
function isAutomatedText(body: string): boolean {
  return body.trimStart().startsWith("Real Hibachi:")
}

// Answering is not pestering. A customer who asks three things in one text
// gets three short answers, and the follow-up caps must not count them as
// three unprompted messages (2026-09-20: a Temecula lead asked about
// headcount, tofu and rentals; answer 1 went out and answers 2 and 3 were
// refused). Anything sent within this window of an inbound message counts as
// part of the reply, both for this send and when counting history.

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
    // A customer who has paid a deposit is not a lead being chased: address,
    // planner and day-of texts must never be capped (2026-09-21, a paid
    // customer was braked because the automatic deposit confirmation counted
    // toward the daily limit). The dead-number block below still applies.
    let isCustomer = false
    if (supabase) {
      const digits = phone.replace(/\D/g, "").slice(-10)
      const { data: paid } = await supabase
        .from("orders")
        .select("id")
        .ilike("customer_phone", `%${digits}`)
        .eq("deposit_status", "paid_verified")
        .limit(1)
      isCustomer = (paid?.length ?? 0) > 0
    }
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
    if (!payload.force && !isCustomer) {
      const brakes = (await getWorkbenchSettings()).sms_brakes
      const FOLLOWUP_CAP = brakes.followup_cap
      const REPLY_WINDOW_MS = brakes.reply_window_minutes * 60_000
      const REPLY_BURST_CAP = brakes.reply_burst_cap
      const thread = await fetchSmsThread(phone, 100)
      const last = thread[thread.length - 1]
      const customerSpokeLast = last?.direction === "inbound"
      const now = Date.now()
      const inboundTimes = thread.filter((m) => m.direction === "inbound").map((m) => new Date(m.at).getTime())
      const lastInbound = inboundTimes.length > 0 ? Math.max(...inboundTimes) : null
      // Still answering the customer's last message.
      const inReplyWindow = lastInbound !== null && now - lastInbound < REPLY_WINDOW_MS
      const repliesInWindow = thread.filter(
        (m) => m.direction === "outbound" && lastInbound !== null && new Date(m.at).getTime() > lastInbound,
      ).length
      if (!customerSpokeLast && inReplyWindow && repliesInWindow < REPLY_BURST_CAP) {
        // Let the rest of the answer through.
      } else if (!customerSpokeLast) {
        const answeredAt = (m: { at: string }) => {
          const t = new Date(m.at).getTime()
          return inboundTimes.some((i) => t >= i && t - i < REPLY_WINDOW_MS)
        }
        // Only messages that were not answers count against the caps.
        const outbound = thread.filter((m) => m.direction === "outbound" && !answeredAt(m))
        const everReplied = thread.some((m) => m.direction === "inbound")
        const last24h = outbound.filter((m) => now - new Date(m.at).getTime() < 24 * 3600_000).length
        // Spacing is about a person texting twice in a row. An automated
        // quote reads as automatic, so a personal first message right after
        // it is fine (owner, 2026-09-19: a new lead waited two hours because
        // the instant quote had gone out 110 minutes earlier). Automated
        // texts still count toward the daily and lifetime caps above.
        const lastPersonalOut = [...outbound].reverse().find((m) => !isAutomatedText(m.body))
        if (!everReplied && outbound.length >= FOLLOWUP_CAP) {
          return NextResponse.json(
            { error: `已发 ${outbound.length} 条、对方从没回过，到上限 ${FOLLOWUP_CAP} 条，停发`, brake: "cap" },
            { status: 409 },
          )
        }
        if (last24h >= brakes.daily_cap) {
          return NextResponse.json({ error: `24 小时内已经主动发过 ${brakes.daily_cap} 条`, brake: "daily" }, { status: 409 })
        }
        if (lastPersonalOut && now - new Date(lastPersonalOut.at).getTime() < brakes.spacing_hours * 3600_000) {
          return NextResponse.json({ error: `距上一条主动消息不到 ${brakes.spacing_hours} 小时`, brake: "spacing" }, { status: 409 })
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
