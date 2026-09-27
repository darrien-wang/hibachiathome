import { type NextRequest, NextResponse } from "next/server"
import { can, resolveAdminActor } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase"
import { fetchSmsThread, fetchSmsThreads, sendSms, toE164 } from "@/lib/sms-thread"
import { loadLeadEventHint } from "@/lib/lead-event-hint"
import { isOptOutBlock } from "@/lib/sms-opt-out"
import { reconcileThread } from "@/lib/sms-reconcile"
import { getWorkbenchSettings } from "@/lib/workbench-settings"

export const dynamic = "force-dynamic"

// The brake numbers (lifetime cap for a never-replier, daily cap, spacing,
// reply window) are owner-editable in /admin → 设置 → 短信刹车; the code
// defaults in lib/workbench-settings-shared.ts are the values that were
// hard-coded here until 2026-09-21 (leads skill 4.4).

// Staff-only. Same key scheme as the rest of /api/admin:
// owner ADMIN_DASH_KEY, agents AGENT_DASH_KEYS="anna:key1,bob:key2".
async function isAuthorized(request: NextRequest): Promise<boolean> {
  return (await resolveAdminActor(request)) !== null
}

/**
 * GET ?leadId=… (preferred) or ?phone=… -> the SMS conversation, oldest first.
 * With a leadId the thread covers the lead's own number AND the numbers of
 * every lead merged into it, so a customer who texts from a second phone
 * still shows up as one conversation.
 */
export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
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
  // Opening the conversation heals its timeline: anything sent outside the
  // workbench (the app, a script, an agent calling Twilio directly) is copied
  // into lead_touchpoints here, keyed by SID so it only happens once. The
  // thread is already in hand, so this adds no Twilio calls. See
  // lib/sms-reconcile.ts.
  let synced = 0
  if (leadId && /^[0-9a-f-]{36}$/i.test(leadId) && messages.length > 0) {
    const supabase = createServerSupabaseClient()
    if (supabase) {
      try {
        synced = (await reconcileThread(supabase, leadId, messages)).inserted
      } catch (err) {
        console.error("[sms-thread] reconcile failed", err)
      }
    }
  }
  return NextResponse.json({ ok: true, phones: unique, messages, synced })
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

// Context lint (2026-09-27 audit). ASKS_FOR_DATE is how our follow-ups ask for
// a date; MENTIONS_A_DATE is how customers write one ("november 29th",
// "Saturday 12/12 at 6pm", "the 13th Tuesday", "Dec 26-30", "Sunday 2/21").
const ASKS_FOR_DATE =
  /\b(which|what)\s+(weekend|date|dates|day|night|evening)\b|\bwhich\s+(saturday|sunday|friday)\b|\bdid\s+(you|the\s+group|it|the\s+birthday|the\s+date)\s+(land|settle)\s+on\b|\bwhen\s+(is|are)\s+(it|you|the\s+party)\b/i
const MENTIONS_A_DATE =
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(st|nd|rd|th)?\b|\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b|\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\.?,?\s+(the\s+)?\d{1,2}(st|nd|rd|th)?\b|\bthe\s+\d{1,2}(st|nd|rd|th)\b/i

// Sweep brake (2026-09-27 audit): 9 batch sends in 15 days, 55 texts to people
// who had never replied, 10 answers - and the batch that asked three customers
// for a date they had already given. Six unprompted texts inside ten minutes
// is a sweep, not a conversation.
const SWEEP_WINDOW_MS = 10 * 60_000
const SWEEP_CAP = 6

// Answering is not pestering. A customer who asks three things in one text
// gets three short answers, and the follow-up caps must not count them as
// three unprompted messages (2026-09-20: a Temecula lead asked about
// headcount, tofu and rentals; answer 1 went out and answers 2 and 3 were
// refused). Anything sent within this window of an inbound message counts as
// part of the reply, both for this send and when counting history.

export async function POST(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (!can(actor, "sms")) return NextResponse.json({ error: "你的账号没有发短信权限，找管理员开" }, { status: 403 })
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
  const leadIdParam = typeof payload.leadId === "string" && /^[0-9a-f-]{36}$/i.test(payload.leadId) ? payload.leadId : null

  // The conversation, read once from Twilio (the source of truth, whoever sent
  // what): the context lint and the brakes below both work from it.
  const thread = payload.force ? [] : await fetchSmsThread(phone, 100)
  // Set when this send counts as an unprompted follow-up (not an answer); it
  // rides on the touchpoint so the sweep brake can count only those.
  let unprompted = false

  // ---- Context lint (2026-09-27 audit) --------------------------------------
  // On 09-23 one batch asked three customers "which weekend are you looking
  // at?" after each of them had already texted us their date. The thread was
  // right there; nobody read it. So the server reads it: a text that asks for
  // the date is refused when the customer has already given one - in a text,
  // or on the lead (event_hint) - and the refusal quotes what they said.
  // force:true overrides, for the rare "is it still the 13th?" re-confirm.
  if (!payload.force && ASKS_FOR_DATE.test(body)) {
    const said = thread.find((m) => m.direction === "inbound" && MENTIONS_A_DATE.test(m.body))
    let hint: string | null = null
    if (!said) {
      const supabase = createServerSupabaseClient()
      if (supabase) {
        // leads has no date column; the date lives on the timeline (form
        // payloads, the auto quote, "[data]" notes) - lib/lead-event-hint.ts.
        let leadId = leadIdParam
        if (!leadId) {
          const { data } = await supabase
            .from("leads")
            .select("id")
            .eq("normalized_phone", phone.replace(/\D/g, "").slice(-10))
            .is("merged_into", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
          leadId = (data as { id: string } | null)?.id ?? null
        }
        if (leadId) hint = (await loadLeadEventHint(supabase, leadId))?.date ?? null
      }
    }
    if (said || hint) {
      return NextResponse.json(
        {
          error: said
            ? `客人已经说过日期了（${said.at.slice(0, 10)}："${said.body.slice(0, 120)}"），这条却在问日期——先读完对话，接着他说的往下谈`
            : `线索上已经有日期（${hint}），这条却在问日期——先读完对话，接着他说的往下谈`,
          brake: "asked_known_date",
          said: said ? { at: said.at, body: said.body.slice(0, 200) } : null,
          event_hint: hint,
        },
        { status: 409 },
      )
    }
  }

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
    // An opt-out (they texted STOP / CANCEL) holds even against force: texting
    // them again is a compliance problem, and Twilio refuses it anyway (21610).
    if (supabase) {
      const { data: blocked } = await supabase
        .from("leads")
        .select("sms_blocked_reason")
        .eq("normalized_phone", phone.replace(/\D/g, "").slice(-10))
        .not("sms_blocked_at", "is", null)
        .limit(5)
      const optOut = (blocked ?? []).find((b) => isOptOutBlock(b.sms_blocked_reason))
      if (optOut) {
        return NextResponse.json(
          { error: `这个号码已退订短信（${optOut.sms_blocked_reason}），不能再发；对方回 START 才会恢复`, brake: "sms_opted_out" },
          { status: 409 },
        )
      }
      if (!payload.force && blocked && blocked.length > 0) {
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
        unprompted = true
        if (!everReplied && outbound.length >= FOLLOWUP_CAP) {
          return NextResponse.json(
            {
              error: `已发 ${outbound.length} 条、对方从没回过，到上限 ${FOLLOWUP_CAP} 条，停发。挂起等他；派对 7 天内且有新信息才 force 一条（先给老板看）`,
              brake: "cap",
            },
            { status: 409 },
          )
        }
        if (last24h >= brakes.daily_cap) {
          return NextResponse.json({ error: `24 小时内已经主动发过 ${brakes.daily_cap} 条`, brake: "daily" }, { status: 409 })
        }
        if (lastPersonalOut && now - new Date(lastPersonalOut.at).getTime() < brakes.spacing_hours * 3600_000) {
          return NextResponse.json({ error: `距上一条主动消息不到 ${brakes.spacing_hours} 小时`, brake: "spacing" }, { status: 409 })
        }
        if (supabase) {
          const { count } = await supabase
            .from("lead_touchpoints")
            .select("id", { count: "exact", head: true })
            .eq("touchpoint_type", "sms_outbound")
            .eq("touchpoint_source", "workbench")
            .eq("raw_payload_json->>unprompted", "true")
            .gte("occurred_at", new Date(now - SWEEP_WINDOW_MS).toISOString())
          if ((count ?? 0) >= SWEEP_CAP) {
            return NextResponse.json(
              {
                error: `${SWEEP_WINDOW_MS / 60_000} 分钟内已经主动发出 ${count} 条跟进——这是群发。一次只处理一个人，读完他的对话再写`,
                brake: "sweep",
              },
              { status: 409 },
            )
          }
        }
      }
    }
  }

  const sent = await sendSms(phone, body)
  if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 502 })

  const leadId = leadIdParam
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
        raw_payload_json: { to: phone, body, status: sent.status, actor: "workbench", unprompted },
        occurred_at: now,
      })
      await supabase
        .from("leads")
        .update({ latest_message: `我方 ${now.slice(0, 10)} 短信已回（213 线）：${summary}`, last_seen_at: now, updated_at: now })
        .eq("id", leadId)
      // A text from here is a real response, same as an email from
      // send-followup: record the first response once and move 待联系 to
      // 跟进中. Until 2026-09-21 only the email path did this, so a lead we
      // had already texted (Zayda, 11:07) still showed 待联系 / 首响未响应 and
      // every SMS first response was missing from the 7-day response average.
      try {
        const { data: existing } = await supabase
          .from("lead_touchpoints")
          .select("id")
          .eq("lead_id", leadId)
          .eq("touchpoint_type", "agent_first_response")
          .limit(1)
        if (!existing || existing.length === 0) {
          await supabase.from("lead_touchpoints").insert({
            lead_id: leadId,
            touchpoint_type: "agent_first_response",
            touchpoint_source: "admin_dashboard",
            external_touchpoint_id: sent.sid,
            raw_payload_json: { via: "sms", to: phone, sid: sent.sid },
            occurred_at: now,
          })
        }
        await supabase.from("leads").update({ status: "qualified", updated_at: now }).eq("id", leadId).eq("status", "new")
      } catch (error) {
        console.error("[sms-thread] first-response logging failed", { leadId, error })
      }
    }
  }

  return NextResponse.json({ ok: true, sid: sent.sid, status: sent.status })
}
